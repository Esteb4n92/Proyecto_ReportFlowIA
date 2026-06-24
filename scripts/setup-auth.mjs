// Cierra el setup de autenticación en un solo comando:
//   1. (si hay SUPABASE_ACCESS_TOKEN) aplica la migración 0002 vía Management API.
//      Si no hay PAT, asume que la tabla `profiles` ya existe (corrida a mano en
//      el dashboard) y sigue.
//   2. Crea/asegura el usuario admin con role='admin' (service role).
//   3. Verifica: login con password, lectura de role bajo RLS, y que el dev
//      server bloquee sin sesión (401 en API).
//
// Uso:
//   node scripts/setup-auth.mjs <email> [password]
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. Opcional: SUPABASE_ACCESS_TOKEN (sb_pat_…).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// --- cargar .env.local ---
try {
  const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAT = process.env.SUPABASE_ACCESS_TOKEN
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const email = process.argv[2]
let password = process.argv[3]

if (!email) {
  console.error('Uso: node scripts/setup-auth.mjs <email> [password]')
  process.exit(1)
}
if (!SUPA_URL || !ANON || !SERVICE) {
  console.error('Faltan vars de Supabase en .env.local.')
  process.exit(1)
}

let generated = false
if (!password) {
  password = crypto.randomBytes(14).toString('base64').replace(/[+/=]/g, '').slice(0, 16) + 'A9!'
  generated = true
}

const ref = new URL(SUPA_URL).hostname.split('.')[0]

const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

function ok(msg) {
  console.log('  ✅ ' + msg)
}
function fail(msg) {
  console.log('  ❌ ' + msg)
}

// --- paso 1: migración ---
console.log('\n[1/3] Migración de profiles')
if (PAT) {
  const sqlPath = path.join('supabase', 'migrations', '0002_profiles_and_roles.sql')
  const query = fs.readFileSync(sqlPath, 'utf8')
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (r.ok) ok('migración aplicada vía Management API')
  else {
    fail(`Management API ${r.status}: ${(await r.text()).slice(0, 200)}`)
    process.exit(1)
  }
} else {
  console.log('  (sin SUPABASE_ACCESS_TOKEN — asumo que ya corriste el SQL en el dashboard)')
}

// --- paso 2: admin ---
console.log('\n[2/3] Cuenta admin')
async function findUser(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const f = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (f) return f
    if (data.users.length < 200) break
  }
  return null
}

let userId
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (createErr) {
  const existing = await findUser(email)
  if (!existing) {
    fail('no se pudo crear ni encontrar el usuario: ' + createErr.message)
    process.exit(1)
  }
  userId = existing.id
  ok(`usuario ya existía (${userId})`)
  if (generated) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) {
      generated = false
      password = '(sin cambios)'
    } else ok('contraseña reseteada al nuevo valor')
  }
} else {
  userId = created.user.id
  ok(`usuario creado (${userId})`)
}

const { error: profErr } = await admin
  .from('profiles')
  .upsert({ id: userId, role: 'admin' }, { onConflict: 'id' })
if (profErr) {
  fail('no se pudo setear role=admin: ' + profErr.message + ' (¿aplicaste la migración?)')
  process.exit(1)
}
ok('role=admin asignado en profiles')

// --- paso 3: verificación ---
console.log('\n[3/3] Verificación')
// 3a) login con password
const userClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({ email, password })
if (signErr) fail('login con password falló: ' + signErr.message)
else ok('login con email/password OK')

// 3b) leer role bajo RLS como el propio usuario
if (signIn?.session) {
  const { data: prof, error } = await userClient.from('profiles').select('role').eq('id', userId).single()
  if (error) fail('lectura de profiles bajo RLS falló: ' + error.message)
  else if (prof?.role === 'admin') ok("RLS: el usuario lee su propio role = 'admin'")
  else fail('role inesperado: ' + JSON.stringify(prof))
}

// 3c) dev server bloquea sin sesión
try {
  const apiRes = await fetch(`${BASE}/api/excel-flow/report/none`, { redirect: 'manual' })
  if (apiRes.status === 401) ok('sin sesión: /api/excel-flow/* → 401')
  else fail(`sin sesión: API devolvió ${apiRes.status} (esperado 401)`)
  const pageRes = await fetch(`${BASE}/excel-flow`, { redirect: 'manual' })
  if (pageRes.status === 307 || pageRes.status === 302) ok(`sin sesión: /excel-flow → ${pageRes.status} (redirect a login)`)
  else fail(`sin sesión: /excel-flow devolvió ${pageRes.status} (esperado 307)`)
} catch (e) {
  console.log('  (dev server no responde en ' + BASE + ' — levantá `pnpm dev` para 3c)')
}

console.log('\n=== Credenciales admin ===')
console.log('Email:    ', email)
console.log('Password: ', password)
if (generated) console.log('(generada — cámbiala después de entrar)')
console.log('Login:    ', BASE + '/login')
console.log('\nListo. El login admin en el navegador es la última confirmación manual.')
