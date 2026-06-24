import { NextRequest, NextResponse } from 'next/server'
import { analyzeExcelData } from '@/lib/excel-flow/claude'
import { persistAnalysis } from '@/lib/excel-flow/persist-analysis'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import type { Report } from '@/lib/excel-flow/types'

export async function POST(req: NextRequest) {
  try {
    const { reportId, force } = await req.json()
    if (!reportId) {
      return NextResponse.json({ error: 'Falta reportId' }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single<Report>()

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    // Si ya está analizado (o más allá), nunca re-analizamos automáticamente:
    // evita pisar el resultado y el doble cobro.
    const DONE: Report['status'][] = ['ready', 'sent', 'approved', 'rejected']
    if (DONE.includes(report.status)) {
      return NextResponse.json({ success: true, skipped: true })
    }

    // Idempotente contra el doble montaje de React en dev: si ya está
    // 'analyzing' (otra llamada en vuelo) salimos, salvo que sea un reintento
    // explícito (`force`). El reintento SÍ re-corre para recuperar reportes
    // que quedaron colgados en 'analyzing' (ej. el server se reinició a mitad
    // del análisis en dev, o un timeout). Solo llegamos acá con 'pending' o
    // 'analyzing'.
    if (report.status === 'analyzing' && !force) {
      return NextResponse.json({ success: true, skipped: true })
    }

    await supabaseAdmin.from('reports').update({ status: 'analyzing' }).eq('id', reportId)

    try {
      const result = await analyzeExcelData(report.raw_data, report.instructions)
      await persistAnalysis(reportId, result)
      return NextResponse.json({ success: true })
    } catch (analysisError) {
      // Si Claude o el parseo del JSON fallan, volvemos a 'pending' para que el
      // reporte no quede atascado en 'analyzing' (polling infinito en la UI) y
      // se pueda reintentar.
      await supabaseAdmin.from('reports').update({ status: 'pending' }).eq('id', reportId)
      throw analysisError
    }
  } catch (err) {
    console.error('Error en analyze:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al analizar el reporte' },
      { status: 500 }
    )
  }
}
