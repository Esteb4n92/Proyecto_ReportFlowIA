import type { ReportStatus } from '@/lib/excel-flow/types'

// Etiquetas y estilos de estado, compartidos por el dashboard del reporte y el
// historial (antes estaban duplicados en cada página).
export const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: 'Pendiente',
  analyzing: 'Analizando',
  ready: 'Analizado',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export const STATUS_STYLE: Record<ReportStatus, { badge: string; dot: string }> = {
  pending: { badge: 'border-slate-700 bg-slate-800/60 text-slate-400', dot: 'bg-slate-400' },
  analyzing: { badge: 'border-sky-500/20 bg-sky-500/10 text-sky-400', dot: 'bg-sky-400' },
  ready: { badge: 'border-green-500/20 bg-green-500/10 text-green-400', dot: 'bg-green-400' },
  sent: { badge: 'border-amber-500/20 bg-amber-500/10 text-amber-400', dot: 'bg-amber-400' },
  approved: { badge: 'border-green-500/20 bg-green-500/10 text-green-400', dot: 'bg-green-400' },
  rejected: { badge: 'border-red-500/20 bg-red-500/10 text-red-400', dot: 'bg-red-400' },
}

// Badge de estado. `pulse` añade el punto que late (para el estado en vivo del
// reporte); en listas largas se deja apagado.
export function StatusBadge({ status, pulse = false }: { status: ReportStatus; pulse?: boolean }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badge}`}
    >
      <span className="relative flex size-1.5">
        {pulse && (
          <span
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${style.dot}`}
          />
        )}
        <span className={`relative inline-flex size-1.5 rounded-full ${style.dot}`} />
      </span>
      {STATUS_LABEL[status]}
    </span>
  )
}
