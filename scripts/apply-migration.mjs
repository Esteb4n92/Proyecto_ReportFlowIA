// Aplica un archivo .sql contra la base de Supabase usando la Management API.
//
// Requiere un Personal Access Token (sb_pat_...) en SUPABASE_ACCESS_TOKEN
// (en .env.local o como variable de entorno). Crear uno en:
//   https://supabase.com/dashboard/account/tokens
//
// Uso:
//   node scripts/apply-migration.mjs supabase/migrations/0002_profiles_and_roles.sql
import fs from 'node:fs'
import path from 'node:path'

// cargar .env.local a mano
try {
  const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // .env.local opcional si las vars ya están en el entorno
}

const token = process.env.SUPABASE_ACCESS_TOKEN
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const sqlPath = process.argv[2]

if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN (Personal Access Token sb_pat_...).')
  process.exit(1)
}
if (!url) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL.')
  process.exit(1)
}
if (!sqlPath) {
  console.error('Uso: node scripts/apply-migration.mjs <ruta-al-sql>')
  process.exit(1)
}

const ref = new URL(url).hostname.split('.')[0]
const query = fs.readFileSync(path.resolve(sqlPath), 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
})

const body = await res.text()
if (!res.ok) {
  console.error(`Error ${res.status} aplicando ${sqlPath}:`)
  console.error(body)
  process.exit(1)
}

console.log(`Migración aplicada OK: ${sqlPath}`)
if (body && body !== '[]') console.log(body)
