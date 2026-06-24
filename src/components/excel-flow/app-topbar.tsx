'use client'

import { List } from '@phosphor-icons/react'

// Barra superior del shell: título de la página (prop) + botón hamburguesa que
// abre el drawer en móvil + chip con el email del admin. Sin campana ni
// engranaje (serían decorativos sin backend).
export function AppTopbar({
  title,
  email,
  onMenu,
}: {
  title: string
  email: string | null
  onMenu: () => void
}) {
  const initial = (email?.trim()[0] ?? '?').toUpperCase()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-800/70 bg-slate-950/80 px-4 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Abrir menú"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-slate-200 md:hidden"
      >
        <List weight="bold" className="size-5" />
      </button>

      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-slate-100">
        {title}
      </h1>

      <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 py-1 pl-1 pr-1 sm:pr-3">
        <div className="flex size-7 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-300">
          {initial}
        </div>
        <span className="hidden max-w-[200px] truncate text-xs text-slate-300 sm:inline">
          {email ?? 'Sesión admin'}
        </span>
      </div>
    </header>
  )
}
