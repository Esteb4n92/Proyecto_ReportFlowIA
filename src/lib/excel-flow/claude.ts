import Anthropic from '@anthropic-ai/sdk'
import type { ChartConfig, KeyInsight } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AnalysisResult {
  analysis: string
  charts_config: ChartConfig[]
  key_insights: KeyInsight[]
}

// CSV compacto: no repite los nombres de columna por fila como el JSON,
// lo que reduce mucho los tokens de entrada (y el costo por análisis)
function toCsv(data: Record<string, unknown>[]): string {
  const headers = Object.keys(data[0] ?? {})
  const lines = [headers.join(',')]
  for (const row of data) {
    lines.push(headers.map((h) => String(row[h] ?? '')).join(','))
  }
  return lines.join('\n')
}

// Palabras que delatan un "insight" sobre el sistema/reporte (metadata) en
// vez de sobre el contenido de los datos. Se descartan antes de guardar.
const METADATA_PATTERNS = [
  /\binforme/i,
  /\breporte/i,
  /\bfilas?\b/i,
  /\bcolumnas?\b/i,
  /\bregistros?\b/i,
  /\bgenerad/i,
  /\bgráficos?\s+(generad|cread)/i,
  /\barchivo\b/i,
  /\bdataset\b/i,
  /\bhojas?\b/i,
]

function looksLikeMetadata(insight: KeyInsight): boolean {
  // Solo miramos label + value: ahí vive la metadata real ("Total de filas" = "6").
  // NO escaneamos la description: es prosa donde palabras como "registro",
  // "columna" o "informe" aparecen de forma legítima ("entre el segundo y tercer
  // registro…") y descartarían hallazgos válidos.
  const haystack = `${insight.label} ${insight.value}`
  return METADATA_PATTERNS.some((re) => re.test(haystack))
}

/** Filtra insights vacíos o de metadata; deja entre 0 y 4. */
function sanitizeInsights(insights: unknown): KeyInsight[] {
  if (!Array.isArray(insights)) return []
  return insights
    .filter(
      (i): i is KeyInsight =>
        !!i &&
        typeof i.label === 'string' &&
        typeof i.value === 'string' &&
        typeof i.description === 'string' &&
        i.label.trim().length > 0 &&
        i.value.trim().length > 0
    )
    .filter((i) => !looksLikeMetadata(i))
    .slice(0, 4)
}

const MAX_SCATTER_POINTS = 40

/**
 * Red de seguridad: aunque el prompt pide máximo 40 puntos por scatter, el
 * modelo a veces se pasa. Recortamos a 40 con un muestreo uniforme (conserva
 * el rango y la forma de la nube) para que el JSON no crezca de más ni truncar.
 */
function capScatterPoints(charts: ChartConfig[]): ChartConfig[] {
  for (const chart of charts) {
    if (chart.type !== 'scatter') continue
    for (const ds of chart.datasets ?? []) {
      const pts = ds.points
      if (!Array.isArray(pts) || pts.length <= MAX_SCATTER_POINTS) continue
      const step = pts.length / MAX_SCATTER_POINTS
      ds.points = Array.from({ length: MAX_SCATTER_POINTS }, (_, i) => pts[Math.floor(i * step)])
    }
  }
  return charts
}

const PROMPT_RULES = `Eres un analista de datos senior. Te paso datos extraídos de un archivo (CSV; puede ser una muestra si el archivo es grande). Tu trabajo es encontrar lo que un humano NO ve de un vistazo a la tabla.

PASO 1 — Entiende las columnas. Antes de nada, clasifica mentalmente cada columna en: categórica (texto/etiquetas), numérica/medible, o temporal/secuencial (fechas, meses, semanas). Esto guía todo lo demás.

PASO 2 — Hallazgos clave (key_insights). Reglas estrictas:
- Cada hallazgo DEBE salir de un patrón real en los datos: comparaciones (X vs Y), tendencias temporales, concentración/outliers ("el 80% viene de 3 productos"), variaciones porcentuales, correlaciones evidentes, máximos/mínimos con contexto.
- PROHIBIDO: hallazgos sobre el propio sistema o archivo — cantidad de filas, columnas, gráficos generados, "este es el informe N", fechas de generación, nombre de archivo, o cualquier dato que no provenga del CONTENIDO analizado. Eso NO es un insight.
- Cada hallazgo debe ser accionable o revelador: si alguien lo lee, aprende algo no obvio. Nada de frases genéricas ("los datos muestran variabilidad", "hay diferencias entre categorías").
- Formato: "value" = el dato concreto (número/porcentaje/comparación); "description" = una frase con el patrón + por qué importa.
- Si NO encuentras suficientes hallazgos genuinos, devuelve MENOS (mínimo 2, máximo 4). Nunca rellenes con trivialidades.

PASO 3 — Gráficos (charts_config). Reglas:
- Comparación entre categorías (ventas por región/producto) → "bar".
- Evolución en el tiempo → "line" o "area".
- Composición/proporción de un total (pocas categorías, máx ~6) → "pie".
- RELACIÓN entre DOS variables numéricas (correlación/dispersión, ej. "ocupación vs. satisfacción", "precio vs. demanda") → "scatter". NUNCA fuerces este caso en un "bar"/"line": un scatter usa pares {x, y}, no labels + data.
- Scatter: MÁXIMO 40 puntos por dataset. Si hay más observaciones, elige una muestra representativa (que conserve el rango y la forma de la nube), no las listes todas.
- Si hay más de una métrica numérica relevante sobre la misma dimensión → considera 2 gráficos distintos (ej. totales y variación %).
- Cada gráfico debe estar ligado a uno de los hallazgos (nada decorativo sin insight asociado).
- NO hagas un "pie" con más de 6-7 categorías (ilegible): agrupa el resto como "Otros".
- Genera hasta 3-4 gráficos si los datos lo justifican; no fuerces la cantidad.
- "subtitle": contexto corto (período, unidad).

REGLA CRÍTICA de forma de datos (respétala SIEMPRE, si no el gráfico sale vacío):
- "bar", "line", "area", "pie": usa "labels" (eje X / categorías) y "datasets[].data" (mismos largos que "labels"). Deja "points", "xLabel", "yLabel" sin usar.
- "scatter": usa "datasets[].points" = arreglo de pares { "x": number, "y": number } (cada punto = una observación). Define "xLabel" y "yLabel" con el nombre de cada variable. Deja "labels" como [] y NO uses "datasets[].data".
- LÍMITE DURO de scatter: NUNCA más de 40 puntos por dataset. Si la muestra tiene más filas, ELIGE 40 representativas (que conserven el rango y la forma de la nube) y descarta el resto. Pasarte de 40 puntos hace que la respuesta se trunque: no lo hagas.
- Todo "x"/"y"/"data" debe ser NÚMERO real (no texto, no null). Si una variable es categórica, NO uses scatter.

PASO 4 — Análisis (analysis). Markdown en español neutro (sin voseo), CONCISO (~200-300 palabras): un breve resumen ejecutivo (2-3 frases) + 3-5 bullets de tendencias + 2-3 recomendaciones accionables. Nada de secciones largas ni relleno. Coherente con los hallazgos.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin \`\`\`) con esta forma EXACTA:
{
  "analysis": "string en markdown",
  "key_insights": [
    { "label": "etiqueta corta", "value": "dato concreto", "description": "frase: patrón + por qué importa" }
  ],
  "charts_config": [
    {
      "type": "bar" | "line" | "area" | "pie",
      "title": "string",
      "subtitle": "string",
      "labels": ["string", ...],
      "datasets": [{ "label": "string", "data": [number, ...] }]
    },
    {
      "type": "scatter",
      "title": "string",
      "subtitle": "string",
      "labels": [],
      "xLabel": "nombre del eje X",
      "yLabel": "nombre del eje Y",
      "datasets": [{ "label": "string", "points": [{ "x": number, "y": number }, ...] }]
    }
  ]
}`

// Tope duro para la llamada a Claude. Si se excede, abortamos la request (sin
// reintentos del SDK) para que la ruta nunca quede colgada y pueda resetear el
// status. Se mantiene por debajo del tope de polling de la página (~60s) para
// que el server resuelva antes de que el cliente ofrezca "Reintentar".
const CLAUDE_TIMEOUT_MS = 45_000

/**
 * Llama a Claude con un prompt, con timeout y parseo robusto del JSON.
 * Centraliza el manejo compartido por `analyzeExcelData` y `refineReport`:
 * - aborta a los 45s (maxRetries: 0 para que el timeout no se multiplique),
 * - quita las fences ```json si las hubiera,
 * - si el texto no es JSON válido, loguea el crudo y lanza un error claro.
 */
async function runClaude(prompt: string): Promise<AnalysisResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS)

  let response
  try {
    response = await anthropic.messages.create(
      {
        model: 'claude-haiku-4-5',
        // 8192 es solo el techo (colchón para que el JSON completo quepa y no se
        // trunque con archivos anchos); no encarece por sí solo. El costo/latencia
        // reales los baja el PROMPT_RULES limitando el volumen de salida.
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal, maxRetries: 0 }
    )
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`La IA tardó más de ${CLAUDE_TIMEOUT_MS / 1000}s en responder`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  // Si la respuesta se cortó por tope de tokens, el JSON viene truncado y el
  // parse va a fallar: avisamos claro para no confundirlo con un error de formato.
  if (response.stop_reason === 'max_tokens') {
    console.error(
      '[claude] Respuesta truncada por max_tokens: el JSON está incompleto. ' +
        'Reduce el volumen de salida (puntos del scatter, gráficos) o sube max_tokens.'
    )
  }

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Respuesta inesperada de Claude')

  let raw = block.text.trim()
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(json)?/, '').replace(/```$/, '').trim()
  }

  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(raw) as AnalysisResult
  } catch {
    // Logueamos el texto crudo para depurar cuando Claude no devuelve JSON válido.
    console.error('[claude] La respuesta no es JSON válido. Texto crudo:\n' + raw)
    throw new Error('La IA no devolvió el análisis en un formato válido')
  }

  return {
    analysis: parsed.analysis,
    charts_config: capScatterPoints(parsed.charts_config ?? []),
    key_insights: sanitizeInsights(parsed.key_insights),
  }
}

export async function analyzeExcelData(
  data: Record<string, unknown>[],
  instructions: string | null
): Promise<AnalysisResult> {
  const sample = data.slice(0, 60)

  const prompt = `${PROMPT_RULES}

${instructions ? `Instrucciones del usuario (priorízalas): ${instructions}\n` : ''}
Datos:
${toCsv(sample)}`

  return runClaude(prompt)
}

/**
 * Refina un reporte ya analizado a partir de un pedido del usuario.
 * Recibe el estado actual (análisis + gráficos + hallazgos) y los datos,
 * y devuelve el set completo actualizado (sobreescribe, no acumula).
 */
export async function refineReport(
  data: Record<string, unknown>[],
  current: { analysis: string | null; charts_config: ChartConfig[] | null; key_insights: KeyInsight[] | null },
  userRequest: string
): Promise<AnalysisResult> {
  const sample = data.slice(0, 60)

  const prompt = `${PROMPT_RULES}

Este reporte YA fue analizado. El usuario pide un ajuste sobre el resultado actual. Aplica el pedido y devuelve el JSON COMPLETO actualizado (análisis + key_insights + charts_config), respetando todas las reglas anteriores. Mantén lo que sigue siendo válido y cambia solo lo necesario para cumplir el pedido.

Pedido del usuario: ${userRequest}

Estado actual del reporte (JSON):
${JSON.stringify({
  analysis: current.analysis,
  key_insights: current.key_insights,
  charts_config: current.charts_config,
})}

Datos originales:
${toCsv(sample)}`

  return runClaude(prompt)
}
