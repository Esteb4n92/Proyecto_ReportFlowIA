'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import {
  FileXls,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  ClockCounterClockwise,
  Plus,
  Eye,
} from '@phosphor-icons/react'
import type { ReportStatus } from '@/lib/excel-flow/types'
import { StatusBadge } from './status-badge'
import { DownloadMenu } from './download-menu'

const EASE = [0.22, 1, 0.36, 1] as const

// Fila ya moldeada por el server (datos reales de la tabla reports + approvals).
export interface DashboardReport {
  id: string
  filename: string
  status: ReportStatus
  created_at: string
  rows: number
  insights: number
  approved: number
  rejected: number
  total: number
}

type Filter = 'todos' | 'aprobados' | 'pendientes'

// Estados con análisis: solo en estos tiene sentido descargar (los exports
// operan sobre el análisis ya generado).
const DOWNLOADABLE: ReportStatus[] = ['ready', 'sent', 'approved', 'rejected']

const TABS: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'aprobados', label: 'Aprobados' },
  { key: 'pendientes', label: 'Pendientes' },
]

export function DashboardClient({ reports }: { reports: DashboardReport[] }) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [query, setQuery] = useState('')

  // Conteos por estado real (para los chips de cada tab).
  const counts = useMemo(
    () => ({
      todos: reports.length,
      aprobados: reports.filter((r) => r.status === 'approved').length,
      pendientes: reports.filter((r) => r.status === 'sent').length,
    }),
    [reports]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return reports.filter((r) => {
      if (filter === 'aprobados' && r.status !== 'approved') return false
      if (filter === 'pendientes' && r.status !== 'sent') return false
      if (q && !r.filename.toLowerCase().includes(q)) return false
      return true
    })
  }, [reports, filter, query])

  return (
    <div>
      {/* tabs + buscador (filtran en cliente, sobre datos reales) */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const active = filter === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                aria-pressed={active}
                className={
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 ' +
                  (active
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200')
                }
              >
                {t.label}
                <span
                  className={
                    'rounded-full px-1.5 text-[11px] tabular-nums ' +
                    (active ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500')
                  }
                >
                  {counts[t.key]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative sm:w-64">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar reportes por nombre"
            className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-3 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasReports={reports.length > 0} query={query} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((report, i) => (
            <ReportCard key={report.id} report={report} index={i} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportCard({ report, index }: { report: DashboardReport; index: number }) {
  const date = new Date(report.created_at).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const canDownload = DOWNLOADABLE.includes(report.status)

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.04, 0.3) }}
      className="flex flex-col gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 transition-colors duration-200 hover:border-slate-700 hover:bg-slate-900/80"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
          <FileXls weight="fill" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold tracking-tight text-slate-100">{report.filename}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {date}
            {report.rows > 0 && ` · ${report.rows.toLocaleString('es')} filas`}
            {report.insights > 0 && ` · ${report.insights} hallazgo${report.insights > 1 ? 's' : ''}`}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {report.total > 0 && (
        <p className="flex items-center gap-1.5 text-xs">
          {report.rejected > 0 ? (
            <span className="inline-flex items-center gap-1 text-red-400">
              <XCircle weight="fill" className="size-3.5" />
              {report.rejected} rechazó
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <CheckCircle weight="fill" className="size-3.5 text-green-400" />
              {report.approved}/{report.total} aprobó
            </span>
          )}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2">
        <Link
          href={`/excel-flow/report/${report.id}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/80 text-sm font-medium text-slate-200 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800"
        >
          <Eye className="size-4" />
          Ver
        </Link>
        {canDownload && <DownloadMenu reportId={report.id} />}
      </div>
    </motion.li>
  )
}

function EmptyState({ hasReports, query }: { hasReports: boolean; query: string }) {
  const searching = query.trim().length > 0
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/60 text-slate-400">
        <ClockCounterClockwise weight="fill" className="size-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-100">
        {searching ? 'Sin coincidencias' : hasReports ? 'Nada en este filtro' : 'Aún no has creado reportes'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        {searching
          ? `No hay reportes que coincidan con "${query.trim()}".`
          : hasReports
          ? 'Prueba con otro filtro para ver tus reportes.'
          : 'Sube un archivo para generar tu primer reporte con IA. Aquí verás el historial y el estado de cada uno.'}
      </p>
      {!hasReports && !searching && (
        <Link
          href="/excel-flow"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-400 active:scale-[.98]"
        >
          <Plus weight="bold" className="size-4" />
          Crear un reporte
        </Link>
      )}
    </div>
  )
}
