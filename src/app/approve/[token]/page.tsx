import { FileXls, Lightbulb, LinkBreak, CheckCircle, XCircle, FilePdf } from '@phosphor-icons/react/dist/ssr'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import { resolveKeyInsights } from '@/lib/excel-flow/report-summary'
import { ReportCharts } from '@/components/excel-flow/report-charts'
import { ApprovalActions } from '@/components/excel-flow/approval-actions'
import { BackgroundFX } from '@/components/excel-flow/background-fx'
import type { Approval, Report } from '@/lib/excel-flow/types'

export const dynamic = 'force-dynamic'

// Tarjeta centrada para los estados terminales (link inválido / ya respondido).
function CenteredCard({
  icon,
  title,
  children,
  tone = 'slate',
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  tone?: 'slate' | 'green' | 'red'
}) {
  const toneCls =
    tone === 'green'
      ? 'border-green-500/25 bg-green-500/10 text-green-400'
      : tone === 'red'
        ? 'border-red-500/25 bg-red-500/10 text-red-400'
        : 'border-slate-700 bg-slate-800/60 text-slate-400'
  return (
    <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <div className={`flex size-14 items-center justify-center rounded-2xl border ${toneCls}`}>{icon}</div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-100">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{children}</p>
    </div>
  )
}

export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: approval } = await supabaseAdmin
    .from('approvals')
    .select('*')
    .eq('token', token)
    .single<Approval>()

  if (!approval) {
    return (
      <div className="relative min-h-[100dvh]">
        <BackgroundFX />
        <CenteredCard icon={<LinkBreak weight="fill" className="size-7" />} title="Enlace no válido">
          Este enlace de aprobación no existe o expiró. Pide a quien te lo envió que vuelva a compartirlo.
        </CenteredCard>
      </div>
    )
  }

  // Ya respondido: mostramos el resultado sin volver a permitir acción.
  if (approval.status !== 'pending') {
    const approved = approval.status === 'approved'
    return (
      <div className="relative min-h-[100dvh]">
        <BackgroundFX />
        <CenteredCard
          icon={approved ? <CheckCircle weight="fill" className="size-7" /> : <XCircle weight="fill" className="size-7" />}
          title={approved ? 'Ya aprobaste este reporte' : 'Ya rechazaste este reporte'}
          tone={approved ? 'green' : 'red'}
        >
          Tu respuesta quedó registrada{approval.responded_at ? ` el ${new Date(approval.responded_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Ya puedes cerrar esta página.
        </CenteredCard>
      </div>
    )
  }

  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', approval.report_id)
    .single<Report>()

  if (!report) {
    return (
      <div className="relative min-h-[100dvh]">
        <BackgroundFX />
        <CenteredCard icon={<LinkBreak weight="fill" className="size-7" />} title="Reporte no disponible">
          El reporte asociado a este enlace ya no está disponible.
        </CenteredCard>
      </div>
    )
  }

  const insights = resolveKeyInsights(report, 4)
  const date = new Date(report.created_at).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const rows = report.raw_data?.length ?? 0

  return (
    <div className="relative min-h-[100dvh]">
      <BackgroundFX />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* marca */}
        <div className="mb-6 flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-slate-200">
            ReportFlow <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">IA</span>
          </span>
        </div>

        {/* encabezado del reporte */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <FileXls weight="fill" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-100">{report.filename}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {date}
              {rows > 0 && ` · ${rows.toLocaleString('es')} filas`} · Te pidieron revisar este reporte
            </p>
          </div>
          <a
            href={`/api/approve/${token}/pdf`}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 text-[13px] font-medium text-slate-300 transition-colors duration-200 hover:border-slate-700 hover:text-slate-100"
          >
            <FilePdf weight="fill" className="size-4 text-red-400" />
            <span className="hidden sm:inline">Descargar PDF</span>
          </a>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* resumen */}
          <div className="space-y-4">
            {insights.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                      <Lightbulb weight="fill" className="size-4" />
                    </div>
                    {insight.value && insight.label && (
                      <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {insight.label}
                      </p>
                    )}
                    <p className="mt-1 text-base font-semibold leading-snug tracking-tight text-slate-100">
                      {insight.value || insight.label}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{insight.description}</p>
                  </div>
                ))}
              </div>
            )}

            {report.charts_config && report.charts_config.length > 0 && (
              <ReportCharts charts={report.charts_config} />
            )}
          </div>

          {/* panel de decisión (sticky en desktop) */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ApprovalActions token={token} />
          </div>
        </div>
      </div>
    </div>
  )
}
