// Crea (o reutiliza) un usuario en Supabase Auth y lo deja con role = 'admin'
// en public.profiles. Requiere que la migración 0002 ya esté aplicada.
//
// Usa el SUPABASE_SERVICE_ROLE_KEY (admin) — corre solo del lado servidor.
//
// Uso:
//   node scripts/create-admin.mjs <email> [password]
// Si no se pasa password, se genera una segura y se imprime.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// cargar .env.local a mano
try {
  const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const email = process.argv[2]
let password = process.argv[3]

if (!email) {
  console.error('Uso: node scripts/create-admin.mjs <email> [password]')
  process.exit(1)
}

function generatePassword() {
  // 18 chars base64url-ish, fácil de copiar
  return crypto.randomBytes(14).toString('base64').replace(/[+/=]/g, '').slice(0, 18) + 'A9!'
}

let generated = false
if (!password) {
  password = generatePassword()
  generated = true
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function findUserByEmail(targetEmail) {
  // Pagina por la lista de usuarios (la API admin no filtra por email directo).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())
    if (found) return found
    if (data.users.length < 200) break
  }
  return null
}

// 1) crear o reutilizar el usuario
let userId
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (createErr) {
  // probablemente ya existe
  const existing = await findUserByEmail(email)
  if (!existing) {
    console.error('No se pudo crear ni encontrar el usuario:', createErr.message)
    process.exit(1)
  }
  userId = existing.id
  console.log(`Usuario ya existía: ${email} (${userId})`)
  if (generated) {
    // si lo generamos pero el usuario ya existía, resetear la contraseña al valor nuevo
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password })
    if (updErr) {
      console.warn('No se pudo resetear la contraseña:', updErr.message)
      password = '(sin cambios — el usuario ya tenía contraseña)'
      generated = false
    } else {
      console.log('Contraseña reseteada al nuevo valor generado.')
    }
  }
} else {
  userId = created.user.id
  console.log(`Usuario creado: ${email} (${userId})`)
}

// 2) asegurar profile con role = 'admin' (upsert por si el trigger no corrió)
const { error: profileErr } = await supabase
  .from('profiles')
  .upsert({ id: userId, role: 'admin' }, { onConflict: 'id' })

if (profileErr) {
  console.error('Error seteando role=admin en profiles:', profileErr.message)
  console.error('¿Aplicaste la migración 0002_profiles_and_roles.sql?')
  process.exit(1)
}

console.log('Role admin asignado en public.profiles.')
console.log('')
console.log('=== Credenciales ===')
console.log('Email:    ', email)
console.log('Password: ', password)
if (generated) console.log('(contraseña generada — cámbiala después de entrar)')
console.log('Login:    ', (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000') + '/login')
