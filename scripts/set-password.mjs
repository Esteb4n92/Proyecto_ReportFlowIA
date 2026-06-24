// Cambia la contraseña de un usuario (Admin API, service role).
// Uso: node scripts/set-password.mjs <email> <nueva-password>
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const email = process.argv[2]
const password = process.argv[3]
if (!email || !password) {
  console.error('Uso: node scripts/set-password.mjs <email> <nueva-password>')
  process.exit(1)
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let user = null
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error('ERR listUsers:', error.message)
    process.exit(1)
  }
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (user || data.users.length < 200) break
}
if (!user) {
  console.error('No se encontró el usuario:', email)
  process.exit(1)
}

const { error } = await admin.auth.admin.updateUserById(user.id, { password })
if (error) {
  console.error('ERR updateUser:', error.message)
  process.exit(1)
}
console.log('Contraseña actualizada para', email)
