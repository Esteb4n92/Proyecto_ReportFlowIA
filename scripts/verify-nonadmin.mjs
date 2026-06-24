// Verifica el gateo de un usuario NO admin: crea un user temporal (role='user'
// por el trigger), confirma que cae en /restricted y que las APIs le dan 403,
// y lo borra. Uso: node scripts/verify-nonadmin.mjs
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const { createChunks } = require('@supabase/ssr/dist/main/utils/chunker.js')

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const ref = new URL(URL_).hostname.split('.')[0]
const KEY = `sb-${ref}-auth-token`

const admin = createClient(URL_, SVC, { auth: { persistSession: false } })
const email = `tmp-user-${Date.now()}@example.com`
const pw = 'TmpUser123!aZ'

const c = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true })
if (c.error) {
  console.log('createUser ERR', c.error.message)
  process.exit(1)
}
const id = c.data.user.id

const p = await admin.from('profiles').select('role').eq('id', id).single()
console.log('trigger creó profile con role =', p.data ? p.data.role : 'ERR ' + p.error.message)

const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
const s = await sb.auth.signInWithPassword({ email, password: pw })
const val = 'base64-' + Buffer.from(JSON.stringify(s.data.session), 'utf8').toString('base64url')
const cookie = createChunks(KEY, val).map((x) => `${x.name}=${x.value}`).join('; ')

const r1 = await fetch(`${BASE}/excel-flow`, { redirect: 'manual', headers: { cookie } })
console.log('non-admin /excel-flow ->', r1.status, 'loc=', r1.headers.get('location'))
const r2 = await fetch(`${BASE}/api/excel-flow/report/none`, { redirect: 'manual', headers: { cookie } })
console.log('non-admin /api/excel-flow/* ->', r2.status)

await admin.auth.admin.deleteUser(id)
console.log('usuario temporal borrado')
