import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile } from '@/lib/excel-flow/excel-parser'
import { parseJsonData } from '@/lib/excel-flow/json-parser'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const instructions = formData.get('instructions') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const isJson = /\.json$/i.test(file.name)
    const rawData = isJson
      ? parseJsonData(await file.text())
      : parseExcelFile(await file.arrayBuffer())

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('reports')
      .insert({
        filename: file.name,
        raw_data: rawData,
        instructions: instructions?.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ reportId: data.id })
  } catch (err) {
    console.error('Error en upload:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al procesar el archivo' },
      { status: 500 }
    )
  }
}
