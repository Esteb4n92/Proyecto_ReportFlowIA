'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Plus, SquaresFour } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { LogoutButton } from './logout-button'

// Navegación REAL: solo lo que tiene páginas con datos. Nada de Team/Files/
// Settings (no hay backend para eso).
const NAV: { href: string; label: string; icon: Icon; isActive: (p: string) => boolean }[] = [
  {
    href: '/excel-flow/dashboard',
    label: 'Reportes',
    icon: SquaresFour,
    isActive: (p) => p.startsWith('/excel-flow/dashboard') || p.startsWith('/excel-flow/report'),
  },
]

export function AppSidebar({
  email,
  open,
  onClose,
}: {
  email: string | null
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const newActive = pathname === '/excel-flow'
  const initial = (email?.trim()[0] ?? '?').toUpperCase()

  return (
    <aside
      className={
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/70 bg-slate-950/95 backdrop-blur-xl transition-transform duration-300 motion-reduce:transition-none md:translate-x-0 ' +
        (open ? 'translate-x-0' : '-translate-x-full')
      }
    >
      {/* marca */}
      <div className="flex items-center gap-3 border-b border-slate-800/60 px-5 py-4">
        <Image
          src="/logo-icon.png"
          alt="ReportFlow IA"
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-xl border border-slate-800/60 shadow-[0_0_24px_rgba(59,130,246,.28)]"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-100">
            ReportFlow{' '}
            <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
              IA
            </span>
          </p>
          <p className="truncate text-[11px] text-slate-500">Intelligence Center</p>
        </div>
      </div>

      {/* navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <Link
          href="/excel-flow"
          onClick={onClose}
          aria-current={newActive ? 'page' : undefined}
          className={
            'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[.99] ' +
            (newActive
              ? 'bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,.25)]'
              : 'bg-blue-500 text-white hover:bg-blue-400 hover:shadow-[0_0_24px_rgba(59,130,246,.25)]')
          }
        >
          <Plus weight="bold" className="size-4" />
          Nuevo análisis
        </Link>

        <p className="px-2 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
          Navegación
        </p>
        <ul className="space-y-1">
          {NAV.map((item) => {
            const ItemIcon = item.icon
            const active = item.isActive(pathname)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ' +
                    (active
                      ? 'border border-slate-700/60 bg-slate-800/70 text-slate-100'
                      : 'border border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200')
                  }
                >
                  <ItemIcon className="size-[18px]" weight={active ? 'fill' : 'regular'} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* sesión */}
      <div className="space-y-3 border-t border-slate-800/60 px-3 py-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-300">
            {initial}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
            {email ?? 'Sesión admin'}
          </span>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
