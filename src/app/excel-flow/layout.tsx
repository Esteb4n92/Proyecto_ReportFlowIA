import { createSupabaseServerClient } from '@/lib/excel-flow/supabase-server'
import { AppShell } from '@/components/excel-flow/app-shell'

// Layout de las rutas autenticadas (/excel-flow/**). La protección de sesión/rol
// la hace src/proxy.ts; acá solo leemos el email del admin para el shell.
export default async function ExcelFlowLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <AppShell email={user?.email ?? null}>{children}</AppShell>
}
