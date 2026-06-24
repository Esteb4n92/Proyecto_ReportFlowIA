import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const FROM = process.env.RESEND_FROM_EMAIL || 'ReportFlow IA <onboarding@resend.dev>'

interface ApprovalEmailParams {
  to: string
  /** nombre del archivo del reporte, para el asunto y el cuerpo */
  reportName: string
  /** token único de esta aprobación (define el link público) */
  token: string
  /** mensaje opcional que escribe quien envía */
  message?: string | null
}

// Escapa texto para interpolarlo seguro dentro del HTML del correo.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Envía a un aprobador el correo con el link a la página pública de aprobación.
 * Devuelve { ok } y, si falla, el mensaje de error (no lanza: el caller decide
 * qué hacer con los envíos que fallan).
 */
export async function sendApprovalEmail({
  to,
  reportName,
  token,
  message,
}: ApprovalEmailParams): Promise<{ ok: boolean; error?: string }> {
  const link = `${BASE_URL}/approve/${token}`
  const safeName = escapeHtml(reportName)
  const safeMessage = message?.trim() ? escapeHtml(message.trim()) : null

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;">
                <span style="font-size:18px;font-weight:600;color:#e2e8f0;letter-spacing:-.01em;">ReportFlow <span style="color:#60a5fa;">IA</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:600;color:#f8fafc;letter-spacing:-.01em;">Te pidieron revisar un reporte</h1>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">
                  Se generó el reporte <strong style="color:#cbd5e1;">${safeName}</strong> y necesita tu aprobación.
                </p>
              </td>
            </tr>
            ${
              safeMessage
                ? `<tr><td style="padding:16px 32px 0;">
                     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;border:1px solid #1e293b;border-left:3px solid #3b82f6;border-radius:8px;">
                       <tr><td style="padding:12px 16px;">
                         <p style="margin:0;font-size:13px;line-height:1.6;color:#cbd5e1;white-space:pre-wrap;">${safeMessage}</p>
                       </td></tr>
                     </table>
                   </td></tr>`
                : ''
            }
            <tr>
              <td style="padding:24px 32px;">
                <a href="${link}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">
                  Revisar y responder
                </a>
                <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                  Verás el resumen del reporte y podrás aprobarlo o rechazarlo con un comentario. Si el botón no abre, copia este enlace:<br>
                  <a href="${link}" style="color:#60a5fa;word-break:break-all;">${link}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #1e293b;">
                <p style="margin:0;font-size:11px;color:#475569;">Enviado por ReportFlow IA · Si no esperabas este correo, puedes ignorarlo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Aprobación requerida — ${reportName}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al enviar el correo' }
  }
}

interface ResultEmailParams {
  to: string
  /** nombre del archivo del reporte */
  reportName: string
  /** correo del aprobador que respondió */
  approverEmail: string
  /** resultado de la respuesta */
  result: 'approved' | 'rejected'
  /** comentario opcional del aprobador */
  comment?: string | null
  /** id del reporte, para enlazar al dashboard del admin */
  reportId: string
}

/**
 * Notifica al admin que envió el reporte cuando un aprobador responde.
 * Devuelve { ok } y, si falla, el mensaje de error (no lanza).
 */
export async function sendApprovalResultEmail({
  to,
  reportName,
  approverEmail,
  result,
  comment,
  reportId,
}: ResultEmailParams): Promise<{ ok: boolean; error?: string }> {
  const approved = result === 'approved'
  const link = `${BASE_URL}/excel-flow/report/${reportId}`
  const safeName = escapeHtml(reportName)
  const safeApprover = escapeHtml(approverEmail)
  const safeComment = comment?.trim() ? escapeHtml(comment.trim()) : null
  const accent = approved ? '#22c55e' : '#ef4444'
  const verbo = approved ? 'aprobó' : 'rechazó'
  const titulo = approved ? 'Reporte aprobado' : 'Reporte rechazado'

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;">
                <span style="font-size:18px;font-weight:600;color:#e2e8f0;letter-spacing:-.01em;">ReportFlow <span style="color:#60a5fa;">IA</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <span style="display:inline-block;font-size:12px;font-weight:600;color:${accent};border:1px solid ${accent}40;background:${accent}1a;border-radius:999px;padding:4px 12px;">${titulo}</span>
                <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#94a3b8;">
                  <strong style="color:#cbd5e1;">${safeApprover}</strong> ${verbo} el reporte <strong style="color:#cbd5e1;">${safeName}</strong>.
                </p>
              </td>
            </tr>
            ${
              safeComment
                ? `<tr><td style="padding:16px 32px 0;">
                     <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;">Comentario</p>
                     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;border:1px solid #1e293b;border-left:3px solid ${accent};border-radius:8px;">
                       <tr><td style="padding:12px 16px;">
                         <p style="margin:0;font-size:13px;line-height:1.6;color:#cbd5e1;white-space:pre-wrap;">${safeComment}</p>
                       </td></tr>
                     </table>
                   </td></tr>`
                : ''
            }
            <tr>
              <td style="padding:24px 32px;">
                <a href="${link}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">
                  Ver el reporte
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #1e293b;">
                <p style="margin:0;font-size:11px;color:#475569;">Notificación automática de ReportFlow IA.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `${titulo} — ${reportName}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al enviar el correo' }
  }
}
