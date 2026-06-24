import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import { ReportPDF } from '@/lib/excel-flow/pdf-report'
import type { Approval, Report } from '@/lib/excel-flow/types'

// Variante PÚBLICA del export PDF para la página de aprobación. Vive fuera de
// /api/excel-flow a propósito: el aprobador es externo y no tiene sesión, así
// que no pasa por el proxy admin. La autorización es el token único de la fila
// de approval (igual que el resto de /api/approve/**).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: approval } = await supabaseAdmin
    .from('approvals')
    .select('report_id')
    .eq('token', token)
    .single<Pick<Approval, 'report_id'>>()

  if (!approval) {
    return NextResponse.json({ error: 'Enlace de aprobación inválido' }, { status: 404 })
  }

  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', approval.report_id)
    .single<Report>()

  if (!report) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  // ReportPDF es una función pura sin hooks: llamarla directo devuelve el
  // elemento <Document> con las props que renderToBuffer espera.
  const buffer = await renderToBuffer(ReportPDF({ report }))

  const baseName = report.filename.replace(/\.(xlsx|xls|csv|json)$/i, '')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}-ReportFlowIA.pdf"`,
    },
  })
}
