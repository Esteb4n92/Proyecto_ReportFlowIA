// Documento PDF del reporte: look "documento imprimible" sobre fondo blanco,
// con los acentos de marca (azul + colores del logo) en headers, badges y
// gráficos. Los gráficos se dibujan con primitivas SVG de react-pdf, sin
// navegador headless — apto para serverless.
import { Fragment } from 'react'
import path from 'path'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
  Rect,
  Line,
  Circle,
  Polyline,
  Text as SvgText,
} from '@react-pdf/renderer'
import type { Report, ChartConfig } from './types'
import { parseMarkdownBlocks, renderableCharts, resolveKeyInsights } from './report-summary'

// Paleta de series: colores del logo (azul / verde / naranja) + extras
const PALETTE = ['#3b82f6', '#16a34a', '#ea7a17', '#475590', '#8b5cf6', '#0ea5e9']

// Tema claro de documento: las claves conservan su rol semántico
// (white = texto más oscuro/titulares, zinc300 = cuerpo, etc.)
const COLORS = {
  bg: '#ffffff',
  card: '#f8fafc',
  border: '#e2e8f0',
  white: '#0f172a',
  zinc300: '#334155',
  zinc400: '#475569',
  zinc500: '#64748b',
  zinc600: '#94a3b8',
  accent: '#2563eb',
  grid: '#e2e8f0',
}

// Chip oscuro detrás del logo (el ícono está diseñado para fondo navy)
const LOGO_CHIP = '#0a1233'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-icon.png')

const STATUS_LABEL: Record<Report['status'], string> = {
  pending: 'Pendiente',
  analyzing: 'Analizando',
  ready: 'Analizado',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

const STATUS_COLOR: Record<Report['status'], string> = {
  pending: '#64748b',
  analyzing: '#0284c7',
  ready: '#16a34a',
  sent: '#d97706',
  approved: '#16a34a',
  rejected: '#dc2626',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    color: COLORS.zinc300,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandChip: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: LOGO_CHIP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMark: { width: 13, height: 13 },
  brandText: { fontSize: 9.5, color: COLORS.white, fontFamily: 'Helvetica-Bold' },
  badge: {
    fontSize: 7.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: 'Helvetica-Bold',
  },
  date: { fontSize: 8, color: COLORS.zinc500, marginBottom: 4 },
  title: { fontSize: 17, color: COLORS.white, fontFamily: 'Helvetica-Bold', marginBottom: 20 },
  sectionTitle: {
    fontSize: 8,
    color: COLORS.zinc500,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  insightRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  insightDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: 3.5,
  },
  insightText: { fontSize: 8.5, lineHeight: 1.5, flex: 1, color: COLORS.zinc300 },
  insightValue: { fontFamily: 'Helvetica-Bold', color: COLORS.white },
  chartTitle: { fontSize: 9.5, color: COLORS.zinc300, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 6, height: 6, borderRadius: 1.5 },
  legendText: { fontSize: 7.5, color: COLORS.zinc400 },
  analysisHeading: {
    fontSize: 10.5,
    color: COLORS.white,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 4,
  },
  analysisSubheading: {
    fontSize: 9,
    color: COLORS.zinc300,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 3,
  },
  analysisParagraph: { fontSize: 8.5, lineHeight: 1.55, marginBottom: 6, color: COLORS.zinc300 },
  analysisListRow: { flexDirection: 'row', gap: 5, marginBottom: 3, paddingLeft: 8 },
  analysisListMarker: { fontSize: 8.5, color: COLORS.zinc500 },
  analysisListText: { fontSize: 8.5, lineHeight: 1.5, flex: 1, color: COLORS.zinc300 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: COLORS.zinc600 },
})

function formatValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  const norm = v / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return nice * mag
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// ---------- Gráficos SVG ----------

const CHART_W = 487
const CHART_H = 170
const PLOT_LEFT = 34
const PLOT_BOTTOM = 18
const PLOT_TOP = 6

function CartesianBase({ max, children }: { max: number; children: React.ReactNode }) {
  const plotH = CHART_H - PLOT_BOTTOM - PLOT_TOP
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <Svg width={CHART_W} height={CHART_H}>
      {ticks.map((t) => {
        const y = PLOT_TOP + plotH * (1 - t)
        return (
          <Line
            key={`g${t}`}
            x1={PLOT_LEFT}
            y1={y}
            x2={CHART_W}
            y2={y}
            stroke={COLORS.grid}
            strokeWidth={0.5}
          />
        )
      })}
      {ticks.map((t) => {
        const y = PLOT_TOP + plotH * (1 - t)
        return (
          <SvgText
            key={`l${t}`}
            x={PLOT_LEFT - 5}
            y={y + 2}
            style={{ fontSize: 6, fill: COLORS.zinc500 }}
            textAnchor="end"
          >
            {formatValue(max * t)}
          </SvgText>
        )
      })}
      {children}
    </Svg>
  )
}

function XLabels({ labels, xFor }: { labels: string[]; xFor: (i: number) => number }) {
  const step = Math.ceil(labels.length / 10)
  return (
    <>
      {labels.map((label, i) =>
        i % step === 0 ? (
          <SvgText
            key={i}
            x={xFor(i)}
            y={CHART_H - 6}
            style={{ fontSize: 6, fill: COLORS.zinc500 }}
            textAnchor="middle"
          >
            {truncate(label, 12)}
          </SvgText>
        ) : null
      )}
    </>
  )
}

function BarChartPdf({ config }: { config: ChartConfig }) {
  const plotW = CHART_W - PLOT_LEFT
  const plotH = CHART_H - PLOT_BOTTOM - PLOT_TOP
  const max = niceMax(Math.max(...config.datasets.flatMap((ds) => ds.data), 0))
  const groups = config.labels.length || 1
  const groupW = plotW / groups
  const barW = Math.min(16, (groupW * 0.65) / config.datasets.length)
  const groupCenter = (i: number) => PLOT_LEFT + groupW * i + groupW / 2

  return (
    <CartesianBase max={max}>
      {config.labels.map((_, i) =>
        config.datasets.map((ds, d) => {
          const v = ds.data[i] ?? 0
          const h = Math.max(0, (v / max) * plotH)
          const x = groupCenter(i) - (barW * config.datasets.length) / 2 + d * barW
          return (
            <Rect
              key={`${i}-${d}`}
              x={x}
              y={PLOT_TOP + plotH - h}
              width={Math.max(barW - 1.5, 1)}
              height={h}
              fill={PALETTE[d % PALETTE.length]}
              rx={1.5}
            />
          )
        })
      )}
      <XLabels labels={config.labels} xFor={groupCenter} />
    </CartesianBase>
  )
}

function LineAreaChartPdf({ config }: { config: ChartConfig }) {
  const plotW = CHART_W - PLOT_LEFT
  const plotH = CHART_H - PLOT_BOTTOM - PLOT_TOP
  const max = niceMax(Math.max(...config.datasets.flatMap((ds) => ds.data), 0))
  const n = config.labels.length
  const xFor = (i: number) => (n <= 1 ? PLOT_LEFT + plotW / 2 : PLOT_LEFT + (plotW * i) / (n - 1))
  const yFor = (v: number) => PLOT_TOP + plotH - (Math.max(0, v) / max) * plotH

  return (
    <CartesianBase max={max}>
      {config.datasets.map((ds, d) => {
        const color = PALETTE[d % PALETTE.length]
        const points = config.labels.map((_, i) => `${xFor(i)},${yFor(ds.data[i] ?? 0)}`).join(' ')
        return (
          <Fragment key={ds.label}>
            {config.type === 'area' && (
              <Path
                d={`M ${xFor(0)} ${PLOT_TOP + plotH} L ${config.labels
                  .map((_, i) => `${xFor(i)} ${yFor(ds.data[i] ?? 0)}`)
                  .join(' L ')} L ${xFor(n - 1)} ${PLOT_TOP + plotH} Z`}
                fill={color}
                fillOpacity={0.15}
              />
            )}
            <Polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
            />
          </Fragment>
        )
      })}
      <XLabels labels={config.labels} xFor={xFor} />
    </CartesianBase>
  )
}

// Scatter: relación entre dos variables numéricas (pares {x, y}). Escala los
// ejes al rango real de los datos (no fuerza el 0 como base).
function ScatterChartPdf({ config }: { config: ChartConfig }) {
  const plotW = CHART_W - PLOT_LEFT
  const plotH = CHART_H - PLOT_BOTTOM - PLOT_TOP
  const pts = config.datasets.flatMap((ds, d) =>
    (ds.points ?? [])
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      .map((p) => ({ x: p.x, y: p.y, color: PALETTE[d % PALETTE.length] }))
  )
  if (pts.length === 0) return null

  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  const xFor = (x: number) => PLOT_LEFT + ((x - xMin) / xSpan) * plotW
  const yFor = (y: number) => PLOT_TOP + plotH - ((y - yMin) / ySpan) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {ticks.map((t) => {
        const y = PLOT_TOP + plotH * (1 - t)
        return (
          <Line key={`g${t}`} x1={PLOT_LEFT} y1={y} x2={CHART_W} y2={y} stroke={COLORS.grid} strokeWidth={0.5} />
        )
      })}
      {ticks.map((t) => {
        const y = PLOT_TOP + plotH * (1 - t)
        return (
          <SvgText
            key={`l${t}`}
            x={PLOT_LEFT - 5}
            y={y + 2}
            style={{ fontSize: 6, fill: COLORS.zinc500 }}
            textAnchor="end"
          >
            {formatValue(yMin + ySpan * t)}
          </SvgText>
        )
      })}
      {pts.map((p, i) => (
        <Circle key={i} cx={xFor(p.x)} cy={yFor(p.y)} r={2.2} fill={p.color} fillOpacity={0.8} />
      ))}
      <SvgText x={PLOT_LEFT} y={CHART_H - 6} style={{ fontSize: 6, fill: COLORS.zinc500 }} textAnchor="start">
        {`${config.xLabel ? config.xLabel + ': ' : ''}${formatValue(xMin)}`}
      </SvgText>
      <SvgText x={CHART_W} y={CHART_H - 6} style={{ fontSize: 6, fill: COLORS.zinc500 }} textAnchor="end">
        {formatValue(xMax)}
      </SvgText>
    </Svg>
  )
}

function donutSlice(cx: number, cy: number, rOut: number, rIn: number, start: number, end: number) {
  const clampedEnd = Math.min(end, start + Math.PI * 2 - 0.001)
  const large = clampedEnd - start > Math.PI ? 1 : 0
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
  return [
    `M ${p(rOut, start)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p(rOut, clampedEnd)}`,
    `L ${p(rIn, clampedEnd)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${p(rIn, start)}`,
    'Z',
  ].join(' ')
}

function PieChartPdf({ config }: { config: ChartConfig }) {
  const ds = config.datasets[0]
  if (!ds) return null
  const values = config.labels.map((_, i) => Math.max(0, ds.data[i] ?? 0))
  const total = values.reduce((a, b) => a + b, 0) || 1
  const cx = 90
  const cy = CHART_H / 2
  let angle = -Math.PI / 2

  const slices = values.map((v, i) => {
    const start = angle
    const sweep = (v / total) * Math.PI * 2
    angle += sweep
    return { d: donutSlice(cx, cy, 62, 36, start, start + sweep), color: PALETTE[i % PALETTE.length] }
  })

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {slices.map((s, i) => (
        <Path key={i} d={s.d} fill={s.color} />
      ))}
      {config.labels.map((label, i) => {
        const y = 18 + i * 14
        if (y > CHART_H - 6) return null
        return (
          <Fragment key={label + i}>
            <Rect x={185} y={y - 5} width={6} height={6} rx={1.5} fill={PALETTE[i % PALETTE.length]} />
            <SvgText x={196} y={y} style={{ fontSize: 7, fill: COLORS.zinc400 }}>
              {`${truncate(label, 34)} — ${formatValue(values[i])} (${((values[i] / total) * 100).toFixed(1)}%)`}
            </SvgText>
          </Fragment>
        )
      })}
    </Svg>
  )
}

function ChartCard({ config }: { config: ChartConfig }) {
  return (
    <View style={styles.card} wrap={false}>
      <Text style={styles.chartTitle}>{config.title}</Text>
      {config.type === 'pie' ? (
        <PieChartPdf config={config} />
      ) : config.type === 'bar' ? (
        <BarChartPdf config={config} />
      ) : config.type === 'scatter' ? (
        <ScatterChartPdf config={config} />
      ) : (
        <LineAreaChartPdf config={config} />
      )}
      {config.type !== 'pie' && config.datasets.length > 1 && (
        <View style={styles.legendRow}>
          {config.datasets.map((ds, i) => (
            <View key={ds.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
              <Text style={styles.legendText}>{ds.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ---------- Documento ----------

function BrandMark() {
  return (
    <View style={styles.brandChip}>
      <Image src={LOGO_PATH} style={styles.brandMark} />
    </View>
  )
}

function AnalysisBlocks({ analysis }: { analysis: string }) {
  const blocks = parseMarkdownBlocks(analysis)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <Text key={i} style={block.level <= 2 ? styles.analysisHeading : styles.analysisSubheading}>
              {block.text}
            </Text>
          )
        }
        if (block.type === 'bullet' || block.type === 'numbered') {
          return (
            <View key={i} style={styles.analysisListRow}>
              <Text style={styles.analysisListMarker}>
                {block.type === 'bullet' ? '•' : `${block.index}.`}
              </Text>
              <Text style={styles.analysisListText}>{block.text}</Text>
            </View>
          )
        }
        return (
          <Text key={i} style={styles.analysisParagraph}>
            {block.text}
          </Text>
        )
      })}
    </>
  )
}

export function ReportPDF({ report }: { report: Report }) {
  const insights = resolveKeyInsights(report, 6)
  const statusColor = STATUS_COLOR[report.status]
  const date = new Date(report.created_at).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document title={`${report.filename} — ReportFlow IA`} creator="ReportFlow IA">
      <Page size="A4" style={styles.page}>
        {/* Top bar */}
        <View style={styles.topBar} fixed>
          <View style={styles.brandRow}>
            <BrandMark />
            <Text style={styles.brandText}>ReportFlow IA</Text>
          </View>
          <Text style={[styles.badge, { color: statusColor, borderColor: statusColor }]}>
            {STATUS_LABEL[report.status]}
          </Text>
        </View>

        {/* Header */}
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.title}>{report.filename}</Text>

        {/* Hallazgos clave */}
        {insights.length > 0 && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Hallazgos clave</Text>
            <View style={styles.card}>
              {insights.map((insight, i) => (
                <View key={i} style={[styles.insightRow, i === insights.length - 1 ? { marginBottom: 0 } : {}]}>
                  <View style={styles.insightDot} />
                  <Text style={styles.insightText}>
                    {insight.value ? <Text style={styles.insightValue}>{insight.value} — </Text> : null}
                    {insight.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Gráficos */}
        {renderableCharts(report.charts_config).length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Gráficos</Text>
            {renderableCharts(report.charts_config).map((config, i) => (
              <ChartCard key={i} config={config} />
            ))}
          </View>
        )}

        {/* Análisis completo */}
        {report.analysis && (
          <View>
            <Text style={styles.sectionTitle}>Análisis</Text>
            <View style={styles.card}>
              <AnalysisBlocks analysis={report.analysis} />
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Reporte generado automáticamente · ReportFlow IA</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
