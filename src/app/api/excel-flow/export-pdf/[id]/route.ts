import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import { ReportPDF } from '@/lib/excel-flow/pdf-report'
import type { Report } from '@/lib/excel-flow/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single<Report>()

  if (error || !data) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  // ReportPDF es una función pura sin hooks: llamarla directo devuelve el
  // elemento <Document> con las props que renderToBuffer espera
  const buffer = await renderToBuffer(ReportPDF({ report: data }))

  const baseName = data.filename.replace(/\.(xlsx|xls)$/i, '')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}-ReportFlowIA.pdf"`,
    },
  })
}
