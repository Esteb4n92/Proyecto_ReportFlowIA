'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import {
  CaretRight,
  PaperPlaneTilt,
  EnvelopeSimple,
  CheckCircle,
  WarningCircle,
  SpinnerGap,
} from '@phosphor-icons/react'

const EASE = [0.22, 1, 0.36, 1] as const

interface SendResult {
  sent: number
  failed: { email: string; error?: string }[]
}

export default function SendReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [emails, setEmails] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

  const submit = async () => {
    if (!emails.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/excel-flow/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, emails, message: message.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el reporte')
      setResult(data as SendResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/excel-flow/dashboard" className="shrink-0 transition-colors hover:text-slate-300">
          Reportes
        </Link>
        <CaretRight weight="bold" className="size-3 shrink-0 text-slate-600" />
        <Link href={`/excel-flow/report/${id}`} className="shrink-0 transition-colors hover:text-slate-300">
          Reporte
        </Link>
        <CaretRight weight="bold" className="size-3 shrink-0 text-slate-600" />
        <span className="shrink-0 text-slate-400">Enviar a aprobación</span>
      </nav>

      <div>
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8"
              >
                <div className="flex size-12 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10 text-green-400">
                  <CheckCircle weight="fill" className="size-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-100">
                  {result.sent > 0
                    ? `Reporte enviado a ${result.sent} aprobador${result.sent > 1 ? 'es' : ''}`
                    : 'No se pudo enviar a ningún aprobador'}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                  Cuando respondan, el estado del reporte se actualizará automáticamente.
                </p>

                {result.failed.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[.07] p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
                      <WarningCircle weight="fill" className="size-4" />
                      Estos correos no se pudieron enviar:
                    </p>
                    <ul className="mt-2 space-y-1 pl-6 text-xs text-amber-200/80">
                      {result.failed.map((f) => (
                        <li key={f.email} className="list-disc">
                          {f.email}
                          {f.error ? ` — ${f.error}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/excel-flow/report/${id}`)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-400 active:scale-[.98]"
                  >
                    Volver al reporte
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setEmails('')
                      setMessage('')
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/80 px-4 text-sm font-medium text-slate-200 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800"
                  >
                    Enviar a otros
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8"
              >
                <div>
                  <label htmlFor="emails" className="text-sm font-medium text-slate-200">
                    Correo(s) del aprobador
                  </label>
                  <p className="mb-2 mt-0.5 text-xs text-slate-500">
                    Separa varios con coma. Cada uno recibe su propio enlace.
                  </p>
                  <div className="relative">
                    <EnvelopeSimple className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-500" />
                    <textarea
                      id="emails"
                      value={emails}
                      onChange={(e) => setEmails(e.target.value)}
                      rows={2}
                      disabled={loading}
                      placeholder="ana@empresa.com, carlos@empresa.com"
                      className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <label htmlFor="message" className="text-sm font-medium text-slate-200">
                      Mensaje
                    </label>
                    <span className="text-xs text-slate-600">opcional</span>
                  </div>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    disabled={loading}
                    placeholder="Ej: Hola, ¿puedes revisar este reporte antes del viernes? Gracias."
                    className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 overflow-hidden rounded-xl border border-red-500/15 bg-red-500/[.08] px-4 py-3 text-xs text-red-400"
                    >
                      <WarningCircle weight="fill" className="size-4 shrink-0" />
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!emails.trim() || loading}
                    className={
                      'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 sm:flex-none sm:px-6 ' +
                      (emails.trim() && !loading
                        ? 'bg-blue-500 text-white hover:bg-blue-400 hover:shadow-[0_0_28px_rgba(59,130,246,.28)] active:scale-[.98]'
                        : 'cursor-not-allowed border border-slate-800 bg-slate-900/60 text-slate-600')
                    }
                  >
                    {loading ? (
                      <>
                        <SpinnerGap className="size-4 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <PaperPlaneTilt weight="bold" className="size-4" />
                        Enviar a aprobación
                      </>
                    )}
                  </button>
                  <Link
                    href={`/excel-flow/report/${id}`}
                    className="inline-flex h-11 items-center px-3 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
                  >
                    Cancelar
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </div>
  )
}
