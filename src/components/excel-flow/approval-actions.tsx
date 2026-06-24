'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CheckCircle, XCircle, SpinnerGap, WarningCircle, Sparkle } from '@phosphor-icons/react'

const EASE = [0.22, 1, 0.36, 1] as const

type Done = { action: 'approve' | 'reject' } | null

export function ApprovalActions({ token }: { token: string }) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done>(null)

  const respond = async (action: 'approve' | 'reject') => {
    if (loading) return
    setLoading(action)
    setError(null)
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar tu respuesta')
      setDone({ action })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    const approved = done.action === 'approve'
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center sm:p-8"
      >
        <div
          className={
            'mx-auto flex size-14 items-center justify-center rounded-2xl border ' +
            (approved
              ? 'border-green-500/25 bg-green-500/10 text-green-400'
              : 'border-red-500/25 bg-red-500/10 text-red-400')
          }
        >
          {approved ? <CheckCircle weight="fill" className="size-7" /> : <XCircle weight="fill" className="size-7" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-100">
          {approved ? 'Reporte aprobado' : 'Reporte rechazado'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">
          Gracias por tu respuesta. Quien envió el reporte verá el resultado actualizado. Ya puedes
          cerrar esta página.
        </p>
      </motion.div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7">
      <h2 className="text-base font-semibold tracking-tight text-slate-100">Tu decisión</h2>
      <p className="mt-1 text-sm text-slate-500">
        Aprueba o rechaza el reporte. Puedes dejar un comentario (opcional).
      </p>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        disabled={!!loading}
        placeholder="Comentario para quien envió el reporte…"
        className="mt-4 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60"
      />

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 overflow-hidden rounded-xl border border-red-500/15 bg-red-500/[.08] px-4 py-3 text-xs text-red-400"
          >
            <WarningCircle weight="fill" className="size-4 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => respond('approve')}
          disabled={!!loading}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-400 hover:shadow-[0_0_28px_rgba(34,197,94,.28)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'approve' ? (
            <SpinnerGap className="size-4 animate-spin" />
          ) : (
            <CheckCircle weight="bold" className="size-4" />
          )}
          Aprobar
        </button>
        <button
          type="button"
          onClick={() => respond('reject')}
          disabled={!!loading}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-300 transition-all duration-200 hover:bg-red-500/20 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'reject' ? (
            <SpinnerGap className="size-4 animate-spin" />
          ) : (
            <XCircle weight="bold" className="size-4" />
          )}
          Rechazar
        </button>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-600">
        <Sparkle weight="fill" className="size-3" />
        Reporte generado con ReportFlow IA
      </p>
    </div>
  )
}
