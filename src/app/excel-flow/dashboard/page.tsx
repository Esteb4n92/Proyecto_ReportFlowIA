import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import type { Approval, Report } from '@/lib/excel-flow/types'
import { DashboardClient, type DashboardReport } from '@/components/excel-flow/dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { data: reportsData } = await supabaseAdmin
    .from('reports')
    .select('id, filename, status, key_insights, raw_data, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const reports = (reportsData ?? []) as Pick<
    Report,
    'id' | 'filename' | 'status' | 'key_insights' | 'raw_data' | 'created_at'
  >[]

  // Trae todas las aprobaciones de estos reportes en una sola consulta y las
  // agrupa por report_id para mostrar el progreso (aprobadas / total) en cada card.
  const ids = reports.map((r) => r.id)
  const approvalsByReport = new Map<string, Approval['status'][]>()
  if (ids.length > 0) {
    const { data: approvalsData } = await supabaseAdmin
      .from('approvals')
      .select('report_id, status')
      .in('report_id', ids)
    for (const a of approvalsData ?? []) {
      const list = approvalsByReport.get(a.report_id) ?? []
      list.push(a.status)
      approvalsByReport.set(a.report_id, list)
    }
  }

  const rows: DashboardReport[] = reports.map((r) => {
    const aps = approvalsByReport.get(r.id) ?? []
    return {
      id: r.id,
      filename: r.filename,
      status: r.status,
      created_at: r.created_at,
      rows: r.raw_data?.length ?? 0,
      insights: r.key_insights?.length ?? 0,
      approved: aps.filter((s) => s === 'approved').length,
      rejected: aps.filter((s) => s === 'rejected').length,
      total: aps.length,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
          Historial de reportes
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Todos los análisis generados y su estado de aprobación.
        </p>
      </div>

      {/* El resumen de actividad vive dentro de DashboardClient para que se
          recalcule en el cliente al eliminar un reporte (sin recargar). */}
      <DashboardClient reports={rows} />
    </div>
  )
}
