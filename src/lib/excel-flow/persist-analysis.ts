import { supabaseAdmin } from './supabase-admin'
import type { AnalysisResult } from './claude'

/**
 * Guarda el resultado de un análisis (o refinamiento) en `reports`.
 *
 * `key_insights` es una columna nueva: si todavía no se aplicó la migración
 * (ver supabase/migrations), el update con esa columna falla. En ese caso
 * reintentamos sin ella para no romper el flujo — el dashboard cae al parser
 * de markdown hasta que se aplique la migración.
 */
export async function persistAnalysis(reportId: string, result: AnalysisResult): Promise<void> {
  const full = {
    analysis: result.analysis,
    charts_config: result.charts_config,
    key_insights: result.key_insights,
    status: 'ready' as const,
  }

  const { error } = await supabaseAdmin.from('reports').update(full).eq('id', reportId)
  if (!error) return

  const missingColumn = /key_insights/i.test(error.message) || error.code === 'PGRST204'
  if (!missingColumn) throw error

  console.warn(
    '[persistAnalysis] columna key_insights ausente — guardando sin ella. ' +
      'Aplicá supabase/migrations/0001_add_key_insights.sql para habilitar los insights estructurados.'
  )
  const { analysis, charts_config, status } = full
  const { error: retryError } = await supabaseAdmin
    .from('reports')
    .update({ analysis, charts_config, status })
    .eq('id', reportId)
  if (retryError) throw retryError
}
