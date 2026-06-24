'use client'

import { useEffect, useMemo, useRef, useState, use } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  ArrowUp,
  CaretDown,
  CaretRight,
  Lightbulb,
  MagicWand,
  PaperPlaneTilt,
  Sparkle,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react'
import type { Report, KeyInsight } from '@/lib/excel-flow/types'
import { resolveKeyInsights } from '@/lib/excel-flow/report-summary'
import { ReportCharts } from '@/components/excel-flow/report-charts'
import { StatusBadge } from '@/components/excel-flow/status-badge'
import { DownloadMenu } from '@/components/excel-flow/download-menu'

const INSIGHT_ACCENTS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', glow: 'group-hover:bg-blue-500/10' },
  { bg: 'bg-green-500/10', text: 'text-green-400', glow: 'group-hover:bg-green-500/10' },
  { bg: 'bg-orange-500/10', text: 'text-orange-400', glow: 'group-hover:bg-orange-500/10' },
  { bg: 'bg-violet-500/10', text: 'text-violet-400', glow: 'group-hover:bg-violet-500/10' },
]

const EASE = [0.22, 1, 0.36, 1] as const


// Tiempo relativo REAL calculado de created_at (no inventamos un "hace 12 min").
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const min = Math.round(diffMs / 60000)
  const hr = Math.round(diffMs / 3600000)
  const day = Math.round(diffMs / 86400000)
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  if (min < 1) return 'hace un momento'
  if (min < 60) return rtf.format(-min, 'minute')
  if (hr < 24) return rtf.format(-hr, 'hour')
  if (day < 30) return rtf.format(-day, 'day')
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------- encabezado de contenido del reporte ----------

function ContentHeader({ report }: { report: Report }) {
  const rows = report.raw_data?.length ?? 0
  const shortId = report.id.slice(0, 8)
  // Acciones (descargar / enviar) solo cuando el reporte ya tiene análisis.
  // En 'pending'/'analyzing' los exports y el envío operarían sobre un reporte
  // sin datos y romperían, así que las ocultamos hasta que esté listo.
  const ready =
    report.status === 'ready' ||
    report.status === 'sent' ||
    report.status === 'approved' ||
    report.status === 'rejected'

  return (
    <div className="mb-6 flex items-start gap-3">
      <Link
        href="/excel-flow/dashboard"
        aria-label="Volver"
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 transition-colors duration-200 hover:border-slate-700 hover:text-slate-200"
      >
        <ArrowLeft weight="bold" className="size-4" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <nav className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
        <Link href="/excel-flow/dashboard" className="shrink-0 transition-colors hover:text-slate-300">
          Reportes
        </Link>
        <CaretRight weight="bold" className="size-3 shrink-0 text-slate-600" />
        <span className="min-w-0 truncate text-slate-400">{report.filename}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 max-w-full truncate text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
              {report.filename}
            </h1>
            <StatusBadge status={report.status} pulse />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-mono text-slate-600">ID {shortId}</span>
            <span className="text-slate-700">·</span>
            <span>Actualizado {relativeTime(report.created_at)}</span>
            {rows > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span>{rows.toLocaleString('es')} filas</span>
              </>
            )}
          </p>
        </div>

        {ready && (
          <div className="flex shrink-0 items-center gap-2.5">
            <DownloadMenu reportId={report.id} />
            <Link
              href={`/excel-flow/report/${report.id}/send`}
              aria-label="Enviar a aprobación"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-500 px-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-400 hover:shadow-[0_0_24px_rgba(59,130,246,.25)] active:scale-[.98] sm:px-3.5"
            >
              <PaperPlaneTilt weight="bold" className="size-4" />
              <span className="hidden sm:inline">Enviar a aprobación</span>
            </Link>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// ---------- insight cards (hallazgos clave de la IA) ----------

function InsightCard({ insight, index }: { insight: KeyInsight; index: number }) {
  const accent = INSIGHT_ACCENTS[index % INSIGHT_ACCENTS.length]
  // Jerarquía de lectura: el label corto es el título legible de la card; el
  // value (la cifra/dato concreto) va como métrica secundaria en color de acento;
  // la description apoya en gris. Si no hay label, el value sube a título.
  const title = insight.label || insight.value
  const metric = insight.label ? insight.value : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE, delay: 0.08 + index * 0.07 }}
      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-slate-900"
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-transparent blur-2xl transition-colors duration-500 ${accent.glow}`}
      />
      <div className={`flex size-9 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}>
        <Lightbulb weight="fill" className="size-[18px]" />
      </div>
      {title && (
        <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-100">
          {title}
        </h3>
      )}
      {metric && (
        <p className={`mt-2 line-clamp-3 text-sm font-semibold leading-snug ${accent.text}`}>{metric}</p>
      )}
      {insight.description && (
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{insight.description}</p>
      )}
    </motion.div>
  )
}

// ---------- análisis completo (colapsable) ----------

function AnalysisSection({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE, delay: 0.72 }}
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <Sparkle className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">Análisis completo</h2>
            <p className="text-xs text-slate-500">Generado por Claude a partir del archivo</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900 px-3 text-xs font-medium text-slate-300 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800"
        >
          {open ? 'Ocultar análisis' : 'Ver análisis completo'}
          <CaretDown
            weight="bold"
            className={'size-[11px] transition-transform duration-300' + (open ? ' rotate-180' : '')}
          />
        </button>
      </div>
      <div className="relative">
        <div
          className="overflow-hidden transition-[max-height] duration-500 ease-in-out"
          style={{ maxHeight: open ? '4000px' : '168px' }}
        >
          <div className="max-w-[76ch] px-5 py-5 text-sm leading-[1.7] text-slate-400 sm:px-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h2 className="mt-6 mb-2.5 border-t border-slate-800/80 pt-5 text-[15px] font-semibold tracking-tight text-slate-100 first:mt-0 first:border-t-0 first:pt-0">
                    {children}
                  </h2>
                ),
                h2: ({ children }) => (
                  <h2 className="mt-6 mb-2.5 border-t border-slate-800/80 pt-5 text-[15px] font-semibold tracking-tight text-slate-100 first:mt-0 first:border-t-0 first:pt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-4 mb-1.5 text-sm font-semibold text-slate-200 first:mt-0">{children}</h3>
                ),
                p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-slate-200">{children}</strong>,
                ul: ({ children }) => (
                  <ul className="my-2.5 flex list-disc flex-col gap-1.5 pl-5 marker:text-blue-400">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-2.5 flex list-decimal flex-col gap-1.5 pl-5 marker:text-blue-400">{children}</ol>
                ),
                code: ({ children }) => (
                  <code className="rounded-md border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs text-blue-300">
                    {children}
                  </code>
                ),
                table: ({ children }) => (
                  <table className="my-4 w-full border-collapse text-[13px]">{children}</table>
                ),
                th: ({ children }) => (
                  <th className="border-b border-slate-800 py-1.5 pr-3 text-left text-xs font-medium text-slate-500">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-slate-800/60 py-2 pr-3 text-slate-300">{children}</td>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
        {!open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
        )}
      </div>
    </motion.section>
  )
}

// ---------- follow-up con la IA ----------

const REFINE_SUGGESTIONS = [
  'Agrega un gráfico de tendencia en el tiempo',
  'Explica más el hallazgo principal',
  'Enfócate en los valores atípicos',
]

interface RefineResult {
  analysis: string
  charts_config: Report['charts_config']
  key_insights: KeyInsight[]
}

function RefineSection({ reportId, onUpdated }: { reportId: string; onUpdated: (r: RefineResult) => void }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/excel-flow/refine/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo refinar el reporte')
      onUpdated(data as RefineResult)
      setPrompt('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE, delay: 0.82 }}
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <MagicWand className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">Pedir un ajuste a la IA</h2>
            <p className="text-xs text-slate-500">Refina el análisis, los gráficos o los hallazgos</p>
          </div>
        </div>
        <CaretDown
          weight="bold"
          className={'size-[11px] shrink-0 text-slate-500 transition-transform duration-300' + (open ? ' rotate-180' : '')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800/70 px-5 py-4">
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
                  }}
                  rows={2}
                  disabled={loading}
                  placeholder="Ej: agrega un gráfico de ventas por mes y explica la caída de junio…"
                  className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 pr-12 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/15 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!prompt.trim() || loading}
                  aria-label="Enviar pedido"
                  className={
                    'absolute bottom-2.5 right-2.5 flex size-8 items-center justify-center rounded-lg transition-all duration-200 ' +
                    (prompt.trim() && !loading
                      ? 'bg-violet-500 text-white hover:bg-violet-400 active:scale-95'
                      : 'cursor-not-allowed bg-slate-800 text-slate-600')
                  }
                >
                  {loading ? <SpinnerGap className="size-4 animate-spin" /> : <ArrowUp weight="bold" className="size-4" />}
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {REFINE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => setPrompt(s)}
                    className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-400 transition-all duration-200 hover:-translate-y-px hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-60"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {loading && (
                <p className="mt-3 flex items-center gap-2 text-xs text-violet-300">
                  <Sparkle weight="fill" className="size-3.5" />
                  La IA está recalculando el reporte…
                </p>
              )}
              {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ---------- estados de carga ----------

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-800 bg-slate-900/50" />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-slate-800 bg-slate-900/50" />
      <div className="h-48 rounded-xl border border-slate-800 bg-slate-900/50" />
    </div>
  )
}

function AnalyzingState({ filename }: { filename: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-28 text-center">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="flex size-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10"
      >
        <Sparkle weight="fill" className="size-5 text-blue-400" />
      </motion.div>
      <div>
        <p className="text-sm font-medium text-slate-100">Analizando con IA</p>
        <p className="mt-1 text-xs text-slate-500">{filename} — esto puede tardar unos segundos</p>
      </div>
    </div>
  )
}

// ---------- página ----------

// ~60s de polling (40 × 1.5s) antes de dar el análisis por "demorado".
const MAX_POLLS = 40
const POLL_MS = 1500

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // dedupe del disparo de análisis (evita el doble montaje de React en dev)
  const firedFor = useRef<string>('')

  useEffect(() => {
    let cancelled = false
    let polls = 0

    // Marca un fallo y detiene el polling (cancelled corta el próximo tick).
    const fail = (msg: string) => {
      if (cancelled) return
      cancelled = true
      setError(msg)
    }

    // Arrancamos el análisis de inmediato, en paralelo con el primer fetch
    // (no esperamos el round-trip del GET). El endpoint es idempotente, así
    // que es seguro llamarlo aunque el reporte ya esté analizado/en curso.
    // En un reintento (attempt > 0) mandamos force para que el server
    // re-corra aunque el reporte haya quedado colgado en 'analyzing'.
    const key = `${id}:${attempt}`
    if (firedFor.current !== key) {
      firedFor.current = key
      fetch('/api/excel-flow/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, force: attempt > 0 }),
      })
        .then(async (res) => {
          // Si el análisis falla (Claude colgado, JSON inválido, etc.) mostramos
          // el error y el botón "Reintentar" sin esperar a que se agote el polling.
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            fail(data.error || 'No se pudo analizar el reporte. Vuelve a intentarlo.')
          }
        })
        .catch(() => {
          /* error de red en el disparo: el polling lo cubre */
        })
    }

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/excel-flow/report/${id}`)
        if (cancelled) return
        if (!res.ok) {
          fail('No se encontró el reporte')
          return
        }
        const data: Report = await res.json()
        setReport(data)

        if (data.status === 'pending' || data.status === 'analyzing') {
          polls += 1
          if (polls > MAX_POLLS) {
            fail('El análisis está tardando más de lo normal. Vuelve a intentarlo.')
            return
          }
          setTimeout(poll, POLL_MS)
        }
      } catch {
        fail('Error al cargar el reporte. Vuelve a intentarlo.')
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const retry = () => {
    setError(null)
    setAttempt((a) => a + 1)
  }

  const insights = useMemo(() => (report ? resolveKeyInsights(report) : []), [report])

  const analyzing = !!report && (report.status === 'pending' || report.status === 'analyzing')
  // Con error no mostramos ni "Analizando" ni el dashboard: solo el bloque de
  // error + "Reintentar" (un reporte 'pending' en error no debe renderizar nada).
  const isAnalyzing = !error && analyzing
  const isReady = !error && !!report && !analyzing

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {report && <ContentHeader report={report} />}

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/[.08] px-4 py-3 text-sm text-red-400">
          <WarningCircle weight="fill" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-medium text-red-300 transition-colors duration-200 hover:bg-red-500/20"
          >
            <SpinnerGap className="size-3.5" />
            Reintentar
          </button>
        </div>
      )}

      {!error && !report && <Skeleton />}

      {isAnalyzing && <AnalyzingState filename={report.filename} />}

      {isReady && (
        <div className="space-y-4">
          {/* Hallazgos clave (insights reales de la IA) */}
            {insights.length > 0 && (
              <div
                className={
                  'grid grid-cols-1 gap-4 sm:grid-cols-2 ' +
                  (insights.length >= 4 ? 'lg:grid-cols-4' : insights.length === 3 ? 'lg:grid-cols-3' : '')
                }
              >
                {insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} index={i} />
                ))}
              </div>
            )}

            {/* Bento de gráficos */}
            {report.charts_config && report.charts_config.length > 0 && (
              <ReportCharts charts={report.charts_config} />
            )}

            {/* Análisis completo, colapsable */}
            {report.analysis && <AnalysisSection markdown={report.analysis} />}

            {/* Follow-up con la IA */}
            <RefineSection
              reportId={report.id}
              onUpdated={(r) =>
                setReport((prev) =>
                  prev
                    ? { ...prev, analysis: r.analysis, charts_config: r.charts_config, key_insights: r.key_insights }
                    : prev
                )
              }
            />

          <p className="pb-4 pt-2 text-center text-xs text-slate-600">
            Reporte generado automáticamente · ReportFlow IA
          </p>
        </div>
      )}
    </div>
  )
}
