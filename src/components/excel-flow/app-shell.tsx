'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { SquaresFour } from '@phosphor-icons/react'
import { BackgroundFX } from './background-fx'
import { AppSidebar } from './app-sidebar'
import { AppTopbar } from './app-topbar'
import { LogoutButton } from './logout-button'

// Título de la barra superior según la ruta actual. El contenido de cada página
// trae su propio encabezado (filename, etc.); esto es solo el rótulo de sección.
function titleFor(pathname: string): string {
  if (pathname.startsWith('/excel-flow/dashboard')) return 'Reportes'
  if (pathname.endsWith('/send')) return 'Enviar a aprobación'
  if (pathname.startsWith('/excel-flow/report/')) return 'Reporte'
  return 'ReportFlow IA'
}

// Chrome ligero para el upload index (/excel-flow): sin sidebar (el ítem "Nuevo
// análisis" sería redundante aquí). Top bar con marca + botón "Reportes" arriba,
// y la cuenta (email + logout) discreta en la esquina inferior izquierda.
function UploadChrome({ email, children }: { email: string | null; children: React.ReactNode }) {
  const initial = (email?.trim()[0] ?? '?').toUpperCase()
  return (
    <div className="relative z-10 flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link href="/excel-flow" className="flex items-center gap-2.5">
          <Image
            src="/logo-icon.png"
            alt="ReportFlow IA"
            width={36}
            height={36}
            className="size-9 rounded-xl border border-slate-800/60 shadow-[0_0_24px_rgba(59,130,246,.28)]"
          />
          <span className="text-[15px] font-semibold tracking-tight text-slate-200">
            ReportFlow{' '}
            <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
              IA
            </span>
          </span>
        </Link>
        <Link
          href="/excel-flow/dashboard"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 text-[13px] font-medium text-slate-300 transition-colors duration-200 hover:border-slate-700 hover:text-slate-100"
        >
          <SquaresFour className="size-4" />
          Reportes
        </Link>
      </header>

      {/* una sola pantalla: sin scroll. El contenido se centra y entra completo;
          pb deja aire para la cuenta fija de la esquina inferior izquierda. */}
      <main className="flex min-h-0 flex-1 items-center overflow-hidden px-1 pb-12">
        {children}
      </main>

      <div className="fixed bottom-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 backdrop-blur-xl">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-300">
            {initial}
          </div>
          <span className="hidden max-w-[160px] truncate text-xs text-slate-300 sm:inline">
            {email ?? 'Sesión admin'}
          </span>
        </div>
        <LogoutButton compact />
      </div>
    </div>
  )
}

// Shell de la app autenticada. El upload index usa el chrome ligero; el historial
// y el dashboard del reporte usan el sidebar fijo (drawer en móvil) + top bar.
export function AppShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Cerrar el drawer al navegar (clic en un link del sidebar cambia la ruta).
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const isUpload = pathname === '/excel-flow'

  return (
    <div className="relative min-h-[100dvh]">
      <BackgroundFX />

      {isUpload ? (
        <UploadChrome email={email}>{children}</UploadChrome>
      ) : (
        <>
          <AppSidebar email={email} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

          {/* backdrop del drawer (solo móvil) */}
          {drawerOpen && (
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
          )}

          <div className="relative z-10 flex min-h-[100dvh] flex-col md:pl-64">
            <AppTopbar title={titleFor(pathname)} email={email} onMenu={() => setDrawerOpen(true)} />
            <main className="flex-1">{children}</main>
          </div>
        </>
      )}
    </div>
  )
}
