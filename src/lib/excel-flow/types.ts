export type ReportStatus = 'pending' | 'analyzing' | 'ready' | 'sent' | 'approved' | 'rejected'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Report {
  id: string
  filename: string
  raw_data: Record<string, unknown>[]
  instructions: string | null
  analysis: string | null
  charts_config: ChartConfig[] | null
  key_insights: KeyInsight[] | null
  status: ReportStatus
  /** correo del admin que envió el reporte a aprobación; null si aún no se envió */
  sender_email: string | null
  created_at: string
}

/**
 * Hallazgo clave estructurado que alimenta las tarjetas del dashboard.
 * Lo devuelve Claude directamente (ya no se extrae del markdown con regex).
 */
export interface KeyInsight {
  /** etiqueta corta de la métrica, ej. "Categoría líder" */
  label: string
  /** dato concreto destacado, ej. "Electrónica · 41%" */
  value: string
  /** una frase: el patrón y por qué importa */
  description: string
}

export interface Approval {
  id: string
  report_id: string
  approver_email: string
  token: string
  status: ApprovalStatus
  comment: string | null
  responded_at: string | null
  created_at: string
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter'
  title: string
  subtitle?: string
  /** etiquetas del eje X / categorías. Vacío para 'scatter'. */
  labels: string[]
  datasets: {
    label: string
    /** valores por categoría (bar/line/area/pie). Vacío para 'scatter'. */
    data: number[]
    /** pares X-Y, solo para 'scatter' (relación entre dos variables numéricas). */
    points?: { x: number; y: number }[]
  }[]
  /** nombre del eje X (útil en 'scatter'). */
  xLabel?: string
  /** nombre del eje Y (útil en 'scatter'). */
  yLabel?: string
}
