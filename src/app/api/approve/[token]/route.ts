import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import { sendApprovalResultEmail } from '@/lib/excel-flow/email'
import { resolveBaseUrl } from '@/lib/excel-flow/request-url'
import type { Approval, Report, ReportStatus } from '@/lib/excel-flow/types'

// Esta ruta vive FUERA de /api/excel-flow a propósito: el aprobador es externo
// y no tiene sesión, así que no debe pasar por el proxy admin. Toda la
// autorización es el token único (inguessable) de la fila de approval.

/**
 * Recalcula el estado del reporte a partir de sus aprobaciones:
 * - si alguna fue rechazada → 'rejected'
 * - si todas fueron aprobadas → 'approved'
 * - si quedan pendientes      → 'sent'
 */
function deriveReportStatus(statuses: Approval['status'][]): ReportStatus {
  if (statuses.some((s) => s === 'rejected')) return 'rejected'
  if (statuses.every((s) => s === 'approved')) return 'approved'
  return 'sent'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const { action, comment } = await req.json()

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const { data: approval, error: findError } = await supabaseAdmin
      .from('approvals')
      .select('id, report_id, status, approver_email')
      .eq('token', token)
      .single<Pick<Approval, 'id' | 'report_id' | 'status' | 'approver_email'>>()

    if (findError || !approval) {
      return NextResponse.json({ error: 'Enlace de aprobación inválido' }, { status: 404 })
    }
    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue respondida', status: approval.status },
        { status: 409 }
      )
    }

    const newStatus: Approval['status'] = action === 'approve' ? 'approved' : 'rejected'

    const { error: updateError } = await supabaseAdmin
      .from('approvals')
      .update({
        status: newStatus,
        comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', approval.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Recalcular el estado del reporte con TODAS sus aprobaciones (ya actualizada).
    const { data: siblings } = await supabaseAdmin
      .from('approvals')
      .select('status')
      .eq('report_id', approval.report_id)

    const reportStatus = deriveReportStatus((siblings ?? []).map((s) => s.status))
    await supabaseAdmin.from('reports').update({ status: reportStatus }).eq('id', approval.report_id)

    // Notificar por correo al admin que envió el reporte. No bloquea la respuesta:
    // si el correo falla, la decisión ya quedó registrada igual.
    const { data: report } = await supabaseAdmin
      .from('reports')
      .select('filename, sender_email')
      .eq('id', approval.report_id)
      .single<Pick<Report, 'filename' | 'sender_email'>>()

    if (report?.sender_email) {
      await sendApprovalResultEmail({
        to: report.sender_email,
        reportName: report.filename,
        approverEmail: approval.approver_email,
        result: newStatus,
        comment: typeof comment === 'string' ? comment : null,
        reportId: approval.report_id,
        baseUrl: resolveBaseUrl(req),
      })
    }

    return NextResponse.json({ status: newStatus, reportStatus })
  } catch (err) {
    console.error('Error en approve:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al procesar la respuesta' },
      { status: 500 }
    )
  }
}
