import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import { createSupabaseServerClient } from '@/lib/excel-flow/supabase-server'
import { sendApprovalEmail } from '@/lib/excel-flow/email'
import { resolveBaseUrl } from '@/lib/excel-flow/request-url'
import type { Report } from '@/lib/excel-flow/types'

// Estados en los que el reporte ya tiene análisis y se puede enviar a aprobación.
const SENDABLE: Report['status'][] = ['ready', 'sent', 'approved', 'rejected']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Acepta los correos como arreglo o como string separado por coma/;/espacio/salto.
function parseEmails(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.join(',') : typeof input === 'string' ? input : ''
  const seen = new Set<string>()
  const out: string[] = []
  for (const piece of raw.split(/[,;\s]+/)) {
    const email = piece.trim().toLowerCase()
    if (!email) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { reportId, emails, message } = await req.json()
    if (!reportId) {
      return NextResponse.json({ error: 'Falta reportId' }, { status: 400 })
    }

    const parsed = parseEmails(emails)
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Agrega al menos un correo de aprobador' }, { status: 400 })
    }
    const invalid = parsed.filter((e) => !EMAIL_RE.test(e))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Correo(s) inválido(s): ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const { data: report, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('id, filename, status')
      .eq('id', reportId)
      .single<Pick<Report, 'id' | 'filename' | 'status'>>()

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }
    if (!SENDABLE.includes(report.status)) {
      return NextResponse.json(
        { error: 'El reporte aún no está listo para enviar a aprobación' },
        { status: 409 }
      )
    }

    // 1) Crear una fila de approval por correo, con token único e inguessable.
    const rows = parsed.map((email) => ({
      report_id: reportId,
      approver_email: email,
      token: crypto.randomBytes(24).toString('base64url'),
      status: 'pending' as const,
    }))
    const { data: created, error: insertError } = await supabaseAdmin
      .from('approvals')
      .insert(rows)
      .select('approver_email, token')

    if (insertError || !created) {
      return NextResponse.json(
        { error: insertError?.message || 'No se pudieron crear las aprobaciones' },
        { status: 500 }
      )
    }

    // 2) Marcar el reporte como enviado y guardar el correo del admin que envía,
    // para poder notificarle cuando un aprobador responda. El proxy ya garantizó
    // que es un admin con sesión; leemos su correo de la sesión.
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabaseAdmin
      .from('reports')
      .update({ status: 'sent', sender_email: user?.email ?? null })
      .eq('id', reportId)

    // 3) Enviar los correos. Si alguno falla, lo reportamos pero no abortamos:
    // la fila de approval ya existe y el envío se puede reintentar. El baseUrl
    // sale del request real (no de build-time), así el link usa el dominio
    // correcto en local y en producción.
    const baseUrl = resolveBaseUrl(req)
    const results = await Promise.all(
      created.map(async (row) => ({
        email: row.approver_email,
        ...(await sendApprovalEmail({
          to: row.approver_email,
          reportName: report.filename,
          token: row.token,
          baseUrl,
          message,
        })),
      }))
    )

    const failed = results.filter((r) => !r.ok).map((r) => ({ email: r.email, error: r.error }))
    return NextResponse.json({ sent: results.length - failed.length, failed })
  } catch (err) {
    console.error('Error en send-report:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al enviar el reporte' },
      { status: 500 }
    )
  }
}
