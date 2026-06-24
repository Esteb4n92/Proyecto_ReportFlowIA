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
