// Verificación end-to-end de los fixes de gráficos:
//  - inserta un reporte real (bar con magnitudes grandes, scatter, y charts
//    inválidos que deben descartarse) y devuelve su id
//  - opcionalmente ejercita los exports y valida que el .xlsx tenga gráficos
//    nativos (incluido scatterChart) y que abra sin corromperse
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

// cargar .env.local a mano
const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const charts_config = [
  {
    type: 'bar',
    title: 'Popularidad en Redes Sociales',
    subtitle: 'seguidores por plataforma',
    labels: ['Instagram', 'TikTok', 'Facebook', 'X'],
    datasets: [{ label: 'Seguidores', data: [30000, 1500000, 250000, 4200] }],
  },
  {
    type: 'scatter',
    title: 'Ocupación Hotelera vs. Satisfacción Cliente',
    subtitle: 'cada punto = un hotel',
    labels: [],
    xLabel: 'Ocupación (%)',
    yLabel: 'Satisfacción (1-5)',
    datasets: [
      {
        label: 'Hoteles',
        points: [
          { x: 45, y: 3.1 }, { x: 52, y: 3.4 }, { x: 60, y: 3.8 },
          { x: 68, y: 4.0 }, { x: 75, y: 4.2 }, { x: 82, y: 4.5 },
          { x: 90, y: 4.7 }, { x: 95, y: 4.8 },
        ],
      },
    ],
  },
  // INVÁLIDO 1: scatter sin points → debe descartarse (no card vacía)
  { type: 'scatter', title: 'Roto: scatter sin puntos', labels: [], datasets: [{ label: 'X', data: [] }] },
  // INVÁLIDO 2: tipo no soportado → debe descartarse
  { type: 'radar', title: 'Roto: tipo radar', labels: ['A'], datasets: [{ label: 'X', data: [1] }] },
  // INVÁLIDO 3: bar sin labels → debe descartarse
  { type: 'bar', title: 'Roto: bar sin labels', labels: [], datasets: [{ label: 'X', data: [1, 2] }] },
]

const report = {
  filename: 'verificacion-graficos.xlsx',
  raw_data: [
    { plataforma: 'Instagram', seguidores: 30000, ocupacion: 45, satisfaccion: 3.1 },
    { plataforma: 'TikTok', seguidores: 1500000, ocupacion: 82, satisfaccion: 4.5 },
  ],
  instructions: null,
  analysis: '## Resumen\n\nDatos de prueba para verificar gráficos.\n\n- TikTok domina en alcance.\n- A mayor ocupación, mayor satisfacción.',
  charts_config,
  status: 'ready',
}

const { data, error } = await supabase.from('reports').insert(report).select('id').single()
if (error) {
  console.error('INSERT ERROR:', error.message)
  process.exit(1)
}
const id = data.id
console.log('REPORT_ID=' + id)

// Si se pasa --export, valida el xlsx generado por el endpoint corriendo
if (process.argv.includes('--export')) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const res = await fetch(`${base}/api/excel-flow/export/${id}`)
  if (!res.ok) {
    console.error('EXPORT HTTP', res.status)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'verify-out.xlsx'), buf)

  // 1) abre sin corromperse con exceljs
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  console.log('SHEETS=' + wb.worksheets.map((w) => w.name).join(', '))

  // 2) cuenta charts nativos inyectados + busca scatterChart
  const zip = await JSZip.loadAsync(buf)
  const chartFiles = Object.keys(zip.files).filter((f) => /xl\/charts\/chart\d+\.xml$/.test(f))
  console.log('NATIVE_CHART_FILES=' + chartFiles.length + ' (' + chartFiles.sort().join(', ') + ')')
  let hasScatter = false
  for (const f of chartFiles) {
    const xml = await zip.file(f).async('string')
    if (xml.includes('<c:scatterChart')) hasScatter = true
  }
  console.log('HAS_SCATTER_CHART=' + hasScatter)
  console.log('EXPECT: 2 native charts (bar+scatter), scatter present, 3 inválidos descartados')
}
