'use client'

import { motion } from 'motion/react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChartBar, ChartLine, ChartLineUp, ChartDonut, ChartScatter } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { ChartConfig } from '@/lib/excel-flow/types'
import { renderableCharts } from '@/lib/excel-flow/report-summary'

// Paleta de series: colores del logo (azul / verde / naranja) + navy
const SERIES_COLORS = ['#3b82f6', '#7ec936', '#ff8a1e', '#475590']
const PIE_COLORS = ['#3b82f6', '#7ec936', '#ff8a1e', '#2b3766']

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0a1233',
    border: '1px solid #1a2450',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#d9dff2',
    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
  },
  labelStyle: { color: '#8e9cc8', marginBottom: 4 },
  itemStyle: { color: '#d9dff2', padding: '1px 0' },
}

const AXIS_TICK = { fill: '#6674a8', fontSize: 12 }

// Abrevia magnitudes para que el eje Y no se corte: 30000 → 30k, 1500000 → 1.5M
function trimDecimal(n: number): string {
  return Number(n.toFixed(1)).toString()
}
function formatAxisNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${trimDecimal(value / 1_000_000)}M`
  if (abs >= 1_000) return `${trimDecimal(value / 1_000)}k`
  return trimDecimal(value)
}

// Props compartidas del eje Y: formateo abreviado + ancho fijo suficiente para
// que el texto nunca se corte, sea cual sea la magnitud de los números.
const Y_AXIS_PROPS = {
  tick: AXIS_TICK,
  axisLine: false as const,
  tickLine: false as const,
  width: 48,
  tickFormatter: formatAxisNumber,
}

const TYPE_ICON: Record<ChartConfig['type'], Icon> = {
  bar: ChartBar,
  line: ChartLine,
  area: ChartLineUp,
  pie: ChartDonut,
  scatter: ChartScatter,
}

// charts_config → filas que entiende Recharts
function toRows(config: ChartConfig): Record<string, string | number>[] {
  return config.labels.map((label, i) => {
    const row: Record<string, string | number> = { label }
    config.datasets.forEach((ds) => {
      row[ds.label] = ds.data[i] ?? 0
    })
    return row
  })
}

function ChartBody({ config, colorOffset }: { config: ChartConfig; colorOffset: number }) {
  const rows = toRows(config)
  const keys = config.datasets.map((d) => d.label)
  // color principal del gráfico: rota según su posición para distinguirlos
  const colorAt = (i: number) => SERIES_COLORS[(colorOffset + i) % SERIES_COLORS.length]

  if (config.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap="28%" barGap={4} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1a2450" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
          <YAxis {...Y_AXIS_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(43,55,102,.30)' }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colorAt(i)} radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (config.type === 'line' || config.type === 'area') {
    const fillId = `areaFill-${colorOffset}`
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorAt(0)} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colorAt(0)} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2450" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" />
          <YAxis {...Y_AXIS_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} cursor={{ stroke: '#2b3766' }} />
          {keys.map((k, i) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={colorAt(i)}
              strokeWidth={2}
              fill={config.type === 'area' && i === 0 ? `url(#${fillId})` : 'transparent'}
              dot={false}
              activeDot={{ r: 4, fill: colorAt(i), stroke: '#000000', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (config.type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#1a2450" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={config.xLabel || 'X'}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatAxisNumber}
            dy={6}
          />
          <YAxis type="number" dataKey="y" name={config.yLabel || 'Y'} {...Y_AXIS_PROPS} />
          <ZAxis range={[55, 55]} />
          <Tooltip {...TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3', stroke: '#2b3766' }} />
          {config.datasets.map((ds, i) => (
            <Scatter
              key={ds.label}
              name={ds.label}
              data={(ds.points ?? []).filter(
                (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
              )}
              fill={colorAt(i)}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (config.type === 'pie') {
    const ds = config.datasets[0]
    const pieData = config.labels.map((label, i) => ({ name: label, value: ds?.data[i] ?? 0 }))
    const total = pieData.reduce((acc, d) => acc + d.value, 0) || 1
    const sliceColor = (i: number) => PIE_COLORS[(colorOffset + i) % PIE_COLORS.length]
    return (
      <div className="flex h-full items-center gap-2">
        <div className="h-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip {...TOOLTIP_STYLE} cursor={false} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={3}
                stroke="#000000"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={sliceColor(i)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex shrink-0 flex-col gap-2 pr-1">
          {pieData.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="size-2 rounded-full" style={{ backgroundColor: sliceColor(i) }} />
              <span className="text-slate-300">{d.name}</span>
              <span className="ml-auto pl-2 tabular-nums text-slate-500">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
}

function ChartCard({ config, className, index }: { config: ChartConfig; className?: string; index: number }) {
  const TypeIcon = TYPE_ICON[config.type] ?? ChartBar
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.38 + index * 0.11 }}
      className={
        'flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-colors duration-300 hover:border-slate-700 ' +
        (className || '')
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-100">{config.title}</h2>
          {config.subtitle && <p className="mt-0.5 text-xs text-slate-500">{config.subtitle}</p>}
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-500">
          <TypeIcon className="size-3.5" />
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ChartBody config={config} colorOffset={index} />
      </div>
    </motion.section>
  )
}

// Grid bento: la forma depende de cuántos gráficos devolvió la IA.
// Solo se renderizan los charts válidos (nunca una card vacía).
export function ReportCharts({ charts }: { charts: ChartConfig[] }) {
  const valid = renderableCharts(charts)
  if (valid.length === 0) return null

  const n = valid.length
  const span = (i: number) => {
    if (n === 1) return 'lg:col-span-3 h-80'
    if (n === 2) return i === 0 ? 'lg:col-span-2 h-72' : 'lg:col-span-1 h-72'
    return i === 0 ? 'lg:col-span-2 h-72' : i === 1 ? 'lg:col-span-1 h-72' : 'lg:col-span-3 h-60'
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {valid.map((config, i) => (
        <ChartCard key={`${config.title}-${i}`} config={config} className={span(i)} index={i} />
      ))}
    </div>
  )
}
