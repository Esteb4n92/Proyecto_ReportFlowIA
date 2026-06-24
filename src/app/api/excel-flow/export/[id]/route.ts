import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { supabaseAdmin } from '@/lib/excel-flow/supabase-admin'
import { renderableCharts, resolveKeyInsights } from '@/lib/excel-flow/report-summary'
import {
  injectNativeCharts,
  colLetter,
  type NativeChartSpec,
} from '@/lib/excel-flow/xlsx-native-charts'
import type { Report, ChartConfig } from '@/lib/excel-flow/types'

export const runtime = 'nodejs'

// Paleta de marca (colores del logo) en hex sin '#'
const PALETTE = ['3B82F6', '7EC936', 'FF8A1E', '475590', '8B5CF6', '0EA5E9']
const SLATE = 'F8FAFC'

const SHEET = 'Gráficos'

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF334155' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SLATE}` } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
  })
}

/** Hoja "Resumen": título + hallazgos clave en tabla. */
function buildResumen(wb: ExcelJS.Workbook, report: Report) {
  const ws = wb.addWorksheet('Resumen', { properties: { defaultColWidth: 18 } })
  ws.columns = [{ width: 5 }, { width: 26 }, { width: 30 }, { width: 70 }]

  const titleCell = ws.getCell('A1')
  titleCell.value = 'ReportFlow IA — Resumen ejecutivo'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } }
  ws.mergeCells('A1:D1')

  const sub = ws.getCell('A2')
  sub.value = `${report.filename}  ·  ${new Date(report.created_at).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`
  sub.font = { color: { argb: 'FF64748B' }, size: 10 }
  ws.mergeCells('A2:D2')

  const insights = resolveKeyInsights(report)
  if (insights.length > 0) {
    ws.addRow([])
    const head = ws.addRow(['HALLAZGOS CLAVE'])
    head.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF2563EB' } }
    const cols = ws.addRow(['#', 'Métrica', 'Dato', 'Detalle'])
    styleHeaderRow(cols)
    insights.forEach((ins, i) => {
      const row = ws.addRow([i + 1, ins.label || '—', ins.value, ins.description])
      row.getCell(3).font = { bold: true, color: { argb: 'FF0F172A' } }
      row.alignment = { vertical: 'top', wrapText: true }
    })
  }
}

// --- Layout tipo dashboard: grid de 2 columnas (como el bento de la web) ---
const GRID_COLS = 2
const BLOCK_W = 15 // columnas que ocupa cada bloque (tabla a la izq + gráfico a la der)
const CHART_ROWS = 16 // alto del gráfico nativo, en filas
const ROW_GAP = 2 // filas de aire entre filas del grid

/** Cantidad de puntos/categorías que aporta un chart (define el alto de su tabla). */
function dataCount(chart: ChartConfig): number {
  if (chart.type === 'scatter') {
    return Math.max(0, ...chart.datasets.map((ds) => ds.points?.length ?? 0))
  }
  return chart.labels.length
}

/** Hoja "Gráficos": dashboard en grid (2 col) — tabla + gráfico nativo por chart. */
function buildGraficos(wb: ExcelJS.Workbook, charts: ChartConfig[]): NativeChartSpec[] {
  const ws = wb.addWorksheet(SHEET, { properties: { defaultColWidth: 14 } })
  // columna de categoría/X ancha en cada columna del grid
  for (let c = 0; c < GRID_COLS; c++) ws.getColumn(c * BLOCK_W + 1).width = 22

  const specs: NativeChartSpec[] = []
  const ref = (col: number, row: number) => `'${SHEET}'!$${colLetter(col)}$${row}`
  const range = (col: number, r1: number, r2: number) =>
    `'${SHEET}'!$${colLetter(col)}$${r1}:$${colLetter(col)}$${r2}`

  // 1) precalcular la fila base (0-based) de cada bloque del grid: el alto de
  //    cada fila del grid se ajusta al gráfico (16 filas) o a la tabla más alta.
  const baseRowOf: number[] = []
  let rowCursor = 0
  for (let i = 0; i < charts.length; i += GRID_COLS) {
    const rowCharts = charts.slice(i, i + GRID_COLS)
    rowCharts.forEach(() => baseRowOf.push(rowCursor))
    const tallestTable = Math.max(...rowCharts.map((c) => 2 + dataCount(c))) // título+header+datos
    rowCursor += Math.max(CHART_ROWS + 1, tallestTable + 1) + ROW_GAP
  }

  charts.forEach((chart, idx) => {
    const baseCol = (idx % GRID_COLS) * BLOCK_W // 0-based: columna del bloque
    const baseRow = baseRowOf[idx] // 0-based
    const titleRow = baseRow + 1 // 1-based (exceljs)
    const headerRow = titleRow + 1
    const firstData = headerRow + 1
    const n = dataCount(chart)
    const lastData = firstData + Math.max(0, n - 1)
    const color = (j: number) => PALETTE[(specs.length + j) % PALETTE.length]

    // título del bloque (en la primera columna del bloque)
    const tCell = ws.getCell(`${colLetter(baseCol)}${titleRow}`)
    tCell.value = chart.subtitle ? `${chart.title} — ${chart.subtitle}` : chart.title
    tCell.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } }

    const header = ws.getRow(headerRow)
    let spec: NativeChartSpec

    if (chart.type === 'scatter') {
      // tabla: por cada dataset, par de columnas (X, Y); rows = puntos
      chart.datasets.forEach((ds, j) => {
        const xCol = baseCol + 1 + 2 * j // 1-based
        const yCol = baseCol + 2 + 2 * j
        header.getCell(xCol).value = chart.xLabel || 'X'
        header.getCell(yCol).value = ds.label || chart.yLabel || 'Y'
        const pts = ds.points ?? []
        for (let i = 0; i < n; i++) {
          const p = pts[i]
          ws.getRow(firstData + i).getCell(xCol).value = p ? p.x : null
          ws.getRow(firstData + i).getCell(yCol).value = p ? p.y : null
        }
      })
      spec = {
        type: 'scatter',
        title: chart.title,
        catRef: '',
        series: chart.datasets.map((ds, j) => ({
          nameRef: ref(baseCol + 1 + 2 * j, headerRow), // celda del header Y
          xRef: range(baseCol + 2 * j, firstData, lastData),
          valRef: range(baseCol + 1 + 2 * j, firstData, lastData),
          color: color(j),
        })),
        anchor: { fromCol: baseCol + 5, fromRow: baseRow, toCol: baseCol + 14, toRow: baseRow + CHART_ROWS },
      }
    } else {
      // bar/line/area/pie: columna de categoría + una columna por dataset
      header.getCell(baseCol + 1).value = 'Categoría'
      chart.datasets.forEach((ds, j) => {
        header.getCell(baseCol + 2 + j).value = ds.label
      })
      chart.labels.forEach((label, i) => {
        const row = ws.getRow(firstData + i)
        row.getCell(baseCol + 1).value = label
        chart.datasets.forEach((ds, j) => {
          row.getCell(baseCol + 2 + j).value = ds.data[i] ?? 0
        })
      })
      const isPie = chart.type === 'pie'
      spec = {
        type: chart.type,
        title: chart.title,
        catRef: range(baseCol, firstData, lastData),
        series: chart.datasets.map((ds, j) => ({
          nameRef: ref(baseCol + 1 + j, headerRow),
          valRef: range(baseCol + 1 + j, firstData, lastData),
          color: color(j),
        })),
        pointColors: isPie ? chart.labels.map((_, i) => PALETTE[i % PALETTE.length]) : undefined,
        anchor: { fromCol: baseCol + 5, fromRow: baseRow, toCol: baseCol + 14, toRow: baseRow + CHART_ROWS },
      }
    }

    styleHeaderRow(header)
    specs.push(spec)
  })

  return specs
}

/** Hoja "Datos": raw_data crudo. */
function buildDatos(wb: ExcelJS.Workbook, rawData: Record<string, unknown>[]) {
  const ws = wb.addWorksheet('Datos')
  if (rawData.length === 0) return
  const headers = Object.keys(rawData[0])
  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.min(32, Math.max(12, h.length + 4)) }))
  styleHeaderRow(ws.getRow(1))
  rawData.forEach((r) => ws.addRow(headers.map((h) => r[h] ?? '')))
}

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

  const wb = new ExcelJS.Workbook()
  wb.creator = 'ReportFlow IA'
  wb.created = new Date()

  buildResumen(wb, data) // sheet1
  const charts = renderableCharts(data.charts_config) // descarta charts vacíos/malformados
  const specs = buildGraficos(wb, charts) // sheet2
  buildDatos(wb, data.raw_data ?? []) // sheet3

  let out: Buffer = Buffer.from(await wb.xlsx.writeBuffer())

  // Inyectar gráficos nativos en la hoja "Gráficos" (sheet2.xml por orden de
  // creación). Si algo falla, devolvemos el workbook con los datos igual.
  if (specs.length > 0) {
    try {
      out = await injectNativeCharts(out, 'sheet2.xml', specs)
    } catch (err) {
      console.error('[export] no se pudieron inyectar gráficos nativos:', err)
    }
  }

  const baseName = data.filename.replace(/\.(xlsx|xls)$/i, '')
  return new NextResponse(new Uint8Array(out), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}-ReportFlowIA.xlsx"`,
    },
  })
}
