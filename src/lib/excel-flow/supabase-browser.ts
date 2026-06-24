import { createBrowserClient } from '@supabase/ssr'

// Cliente de Supabase para componentes de cliente (login, logout).
// Maneja la sesión vía cookies para que el middleware (server) la lea.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
