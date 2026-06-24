'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DownloadSimple,
  CaretDown,
  FilePdf,
  FileXls,
  ArrowDownRight,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const EASE = [0.22, 1, 0.36, 1] as const

// Menú de descarga (PDF / Excel) reutilizado por el dashboard del reporte y las
// cards del historial. Apunta a los endpoints de export existentes.
export function DownloadMenu({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const options: { icon: Icon; label: string; hint: string; href: string }[] = [
    {
      icon: FilePdf,
      label: 'Reporte en PDF',
      hint: 'Gráficos + análisis completo',
      href: `/api/excel-flow/export-pdf/${reportId}`,
    },
    {
      icon: FileXls,
      label: 'Reporte en Excel',
      hint: 'Resumen + datos + análisis',
      href: `/api/excel-flow/export/${reportId}`,
    },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Descargar"
        className={
          'inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-medium transition-colors duration-200 active:scale-[.98] sm:gap-2 sm:px-3.5 ' +
          (open
            ? 'border-slate-600 bg-slate-800 text-slate-100'
            : 'border-slate-700/70 bg-slate-900/80 text-slate-200 hover:border-slate-600 hover:bg-slate-800')
        }
      >
        <DownloadSimple className="size-4 text-slate-400" />
        <span className="hidden sm:inline">Descargar</span>
        <CaretDown
          weight="bold"
          className={'size-[11px] text-slate-500 transition-transform duration-200' + (open ? ' rotate-180' : '')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,.55)]"
          >
            {options.map((opt) => {
              const OptIcon = opt.icon
              return (
                <a
                  key={opt.label}
                  role="menuitem"
                  href={opt.href}
                  onClick={() => setOpen(false)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-slate-800"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 transition-colors duration-150 group-hover:border-blue-500/30 group-hover:text-blue-400">
                    <OptIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-200">{opt.label}</span>
                    <span className="block truncate text-xs text-slate-500">{opt.hint}</span>
                  </span>
                  <ArrowDownRight
                    weight="bold"
                    className="ml-auto size-3 text-slate-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  />
                </a>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
