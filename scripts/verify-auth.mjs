// Verificación end-to-end del sistema de auth contra el dev server.
//   - Sin sesión: /api/excel-flow/* → 401, /excel-flow → 307 a /login
//   - Con sesión admin (cookie forjada igual que @supabase/ssr): /excel-flow → 200,
//     /api/excel-flow/* → pasa el proxy (no 401/403)
//   - RLS: el admin lee su propio profile y role = 'admin'
//
// Uso: node scripts/verify-auth.mjs <email> <password>
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const { createChunks } = require('@supabase/ssr/dist/main/utils/chunker.js')

try {
  const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const ref = new URL(URL_).hostname.split('.')[0]
const STORAGE_KEY = `sb-${ref}-auth-token`

const email = process.argv[2]
const password = process.argv[3]
if (!email || !password) {
  console.error('Uso: node scripts/verify-auth.mjs <email> <password>')
  process.exit(1)
}

let pass = 0
let failCount = 0
function check(cond, label, extra = '') {
  if (cond) {
    pass++
    console.log('  ✅ ' + label)
  } else {
    failCount++
    console.log('  ❌ ' + label + (extra ? ' — ' + extra : ''))
  }
}

// 1) login
const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({ email, password })
console.log('\n[1] Login con email/password')
check(!signErr && !!signIn?.session, 'signInWithPassword OK', signErr?.message)
if (!signIn?.session) {
  console.log('\nNo hay sesión, no puedo seguir.')
  process.exit(1)
}

// 2) RLS: leer propio role
console.log('\n[2] RLS — leer propio profile')
const { data: prof, error: profErr } = await sb
  .from('profiles')
  .select('role')
  .eq('id', signIn.user.id)
  .single()
check(!profErr && prof?.role === 'admin', "role = 'admin' legible bajo RLS", profErr?.message || JSON.stringify(prof))

// forjar cookie como @supabase/ssr: base64-<base64url(JSON.stringify(session))>, chunked
const value = 'base64-' + Buffer.from(JSON.stringify(signIn.session), 'utf8').toString('base64url')
const chunks = createChunks(STORAGE_KEY, value)
const cookieHeader = chunks.map((c) => `${c.name}=${c.value}`).join('; ')

async function probe(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', ...opts })
  return res.status
}

// 3) sin sesión
console.log('\n[3] Sin sesión')
check((await probe(`${BASE}/api/excel-flow/report/none`)) === 401, '/api/excel-flow/* → 401')
const noSessPage = await probe(`${BASE}/excel-flow`)
check(noSessPage === 307 || noSessPage === 302, '/excel-flow → redirect a /login', 'status ' + noSessPage)

// 4) con sesión admin
console.log('\n[4] Con sesión admin (cookie forjada)')
const adminPage = await probe(`${BASE}/excel-flow`, { headers: { cookie: cookieHeader } })
check(adminPage === 200, '/excel-flow → 200 (entra normal)', 'status ' + adminPage)
const adminApi = await probe(`${BASE}/api/excel-flow/report/none`, { headers: { cookie: cookieHeader } })
check(adminApi !== 401 && adminApi !== 403, '/api/excel-flow/* → pasa el proxy (no 401/403)', 'status ' + adminApi)

console.log(`\n=== ${pass} OK, ${failCount} fallos ===`)
process.exit(failCount > 0 ? 1 : 0)
