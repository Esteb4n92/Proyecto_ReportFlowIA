import { NextRequest, NextResponse } from 'next/server'
import { refineReport } from '@/lib/excel-flow/claude'
import { persistAnalysis } from '@/lib/excel-flow/persist-analysis'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import type { Report } from '@/lib/excel-flow/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Falta el pedido para la IA' }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', id)
      .single<Report>()

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    const result = await refineReport(
      report.raw_data,
      {
        analysis: report.analysis,
        charts_config: report.charts_config,
        key_insights: report.key_insights,
      },
      prompt.trim()
    )

    await persistAnalysis(id, result)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Error en refine:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al refinar el reporte' },
      { status: 500 }
    )
  }
}
