import type { NextRequest } from 'next/server'

// Resuelve la URL base pública para los links de los correos EN TIEMPO DE
// REQUEST. NEXT_PUBLIC_BASE_URL se incrusta en build-time y, si no estaba al
// compilar, cae a localhost en producción. Prioridad:
//   1) APP_URL del servidor (override explícito), si no apunta a localhost
//   2) el origin real del request (host + x-forwarded-proto)
//   3) localhost (solo dev)
export function resolveBaseUrl(req: NextRequest): string {
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '')
  if (appUrl && !/localhost|127\.0\.0\.1/.test(appUrl)) return appUrl

  const host = req.headers.get('host')?.trim()
  if (host) {
    const proto =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return req.nextUrl.origin || 'http://localhost:3000'
}
