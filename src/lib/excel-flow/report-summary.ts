// Utilidades compartidas entre dashboard, export Excel y PDF: resolución de
// hallazgos clave (campo estructurado con fallback al markdown) y parsing
// liviano del markdown del análisis a bloques renderizables.

import type { ChartConfig, KeyInsight, Report } from './types'

const SUPPORTED_CHART_TYPES = new Set<ChartConfig['type']>(['bar', 'line', 'area', 'pie', 'scatter'])

/**
 * Valida que un ChartConfig sea renderizable: tipo soportado + datos completos
 * y coherentes con ese tipo. Fuente única para web/PDF/Excel — así NUNCA se
 * renderiza (ni exporta) un gráfico vacío cuando Claude devuelve un config
 * malformado o de un tipo que no calza con su forma de datos.
 */
export function isRenderableChart(config: ChartConfig | null | undefined): config is ChartConfig {
  if (!config || typeof config !== 'object') return false
  if (!SUPPORTED_CHART_TYPES.has(config.type)) return false
  if (!Array.isArray(config.datasets) || config.datasets.length === 0) return false

  if (config.type === 'scatter') {
    // necesita al menos un dataset con pares {x, y} numéricos válidos
    return config.datasets.some(
      (ds) =>
        Array.isArray(ds.points) &&
        ds.points.length > 0 &&
        ds.points.every(
          (p) => p != null && Number.isFinite(p.x) && Number.isFinite(p.y)
        )
    )
  }

  // bar/line/area/pie: necesitan labels y al menos un dataset con datos numéricos
  if (!Array.isArray(config.labels) || config.labels.length === 0) return false
  return config.datasets.some(
    (ds) => Array.isArray(ds.data) && ds.data.some((v) => Number.isFinite(v))
  )
}

/** Filtra una lista de charts dejando solo los renderizables. */
export function renderableCharts(charts: ChartConfig[] | null | undefined): ChartConfig[] {
  return (charts ?? []).filter(isRenderableChart)
}

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; index: number; text: string }

/** Quita énfasis/código/links inline del markdown, dejando texto plano. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
}

/** Parsea el análisis markdown a bloques simples (headings, párrafos, listas). */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: stripInlineMarkdown(paragraph.join(' ')) })
      paragraph = []
    }
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: stripInlineMarkdown(heading[2]),
      })
      continue
    }
    const bullet = line.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      blocks.push({ type: 'bullet', text: stripInlineMarkdown(bullet[1]) })
      continue
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (numbered) {
      flushParagraph()
      blocks.push({
        type: 'numbered',
        index: parseInt(numbered[1], 10),
        text: stripInlineMarkdown(numbered[2]),
      })
      continue
    }
    paragraph.push(line)
  }
  flushParagraph()
  return blocks
}

/**
 * Extrae los hallazgos clave del análisis: prioriza bullets/items numerados;
 * si no hay listas, cae a los primeros párrafos.
 */
export function extractKeyInsights(analysis: string, max = 10): string[] {
  const blocks = parseMarkdownBlocks(analysis)
  const listItems = blocks
    .filter((b) => b.type === 'bullet' || b.type === 'numbered')
    .map((b) => b.text)
    .filter((t) => t.length > 8)

  if (listItems.length > 0) return listItems.slice(0, max)

  return blocks
    .filter((b) => b.type === 'paragraph')
    .map((b) => b.text)
    .filter((t) => t.length > 20)
    .slice(0, Math.min(max, 5))
}

// Extrae un "valor destacado" (porcentaje, monto o número) del texto de un
// hallazgo para usarlo como dato grande de la tarjeta en el fallback.
function extractHighlight(text: string): string {
  const match =
    text.match(/[$€]?\s?\d[\d.,]*\s?%/) || // porcentaje
    text.match(/[$€]\s?\d[\d.,]*\s?(?:[kKmM]|millones?|mil)?/) || // monto
    text.match(/\b\d[\d.,]*\s?(?:[kKmM]|millones?|mil)\b/) // número con magnitud
  return match ? match[0].replace(/\s+/g, ' ').trim() : ''
}

/** Convierte hallazgos en texto (markdown) a la forma estructurada KeyInsight. */
function deriveInsightsFromMarkdown(analysis: string, max = 5): KeyInsight[] {
  return extractKeyInsights(analysis, max).map((text) => {
    const value = extractHighlight(text)
    return { label: '', value, description: text }
  })
}

/**
 * Fuente única de hallazgos para dashboard/PDF/Excel: usa el campo
 * estructurado `key_insights` si está presente; si no (migración aún no
 * aplicada), lo deriva del markdown del análisis.
 */
export function resolveKeyInsights(report: Report, max = 5): KeyInsight[] {
  if (report.key_insights && report.key_insights.length > 0) {
    return report.key_insights.slice(0, max)
  }
  if (report.analysis) return deriveInsightsFromMarkdown(report.analysis, max)
  return []
}
