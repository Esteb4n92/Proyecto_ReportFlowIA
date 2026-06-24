import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
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

  return NextResponse.json(data)
}

// Elimina un reporte del historial. La ruta /api/excel-flow ya está protegida
// para admin por src/proxy.ts. La FK approvals.report_id → reports.id es
// ON DELETE CASCADE, así que al borrar el reporte se borran también sus
// aprobaciones automáticamente.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('reports')
      .select('id')
      .eq('id', id)
      .maybeSingle<Pick<Report, 'id'>>()

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin.from('reports').delete().eq('id', id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar reporte:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al eliminar el reporte' },
      { status: 500 }
    )
  }
}
