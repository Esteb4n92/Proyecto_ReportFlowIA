import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Proxy (antes "middleware" — renombrado en Next.js 16) que protege
// /excel-flow/** (páginas) y /api/excel-flow/** (APIs):
//   - Sin sesión → /login (páginas) o 401 (APIs)
//   - Con sesión pero role != 'admin' → /restricted (páginas) o 403 (APIs)
//   - Con sesión admin → pasa, refrescando la sesión
//
// El chequeo de rol consulta public.profiles como el usuario autenticado
// (RLS: solo puede leer su propia fila), así que el rol siempre está fresco.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  // Respuesta base; el cliente de Supabase escribe acá las cookies de refresh.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // No correr lógica entre createServerClient y getUser (recomendación Supabase).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    if (pathname && pathname !== '/') loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    if (isApi) {
      return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
    }
    const restrictedUrl = request.nextUrl.clone()
    restrictedUrl.pathname = '/restricted'
    restrictedUrl.search = ''
    const redirectResponse = NextResponse.redirect(restrictedUrl)
    // Conservar las cookies de sesión refrescadas en el redirect.
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: ['/excel-flow/:path*', '/api/excel-flow/:path*'],
}
