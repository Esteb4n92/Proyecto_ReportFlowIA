// Parser de archivos .json → mismo formato que el parser de Excel
// (un arreglo de filas planas: Record<string, unknown>[]), para que el resto
// del pipeline (CSV para Claude, gráficos, exports) no necesite cambios.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Aplana valores no escalares a algo que el CSV/tabla pueda mostrar.
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = null
    } else if (typeof value === 'object') {
      out[key] = JSON.stringify(value)
    } else {
      out[key] = value
    }
  }
  return out
}

// Extrae el arreglo de filas de las formas de JSON más comunes:
// - arreglo de objetos                       → tal cual
// - arreglo de primitivos                    → [{ valor }]
// - { data: [...] } / { results: [...] } etc → el primer arreglo de objetos
// - un solo objeto                           → una fila
function extractRows(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return []
    if (parsed.every(isPlainObject)) return parsed as Record<string, unknown>[]
    // arreglo de primitivos (o mixto): una columna "valor"
    return parsed.map((v) => ({ valor: isPlainObject(v) || Array.isArray(v) ? JSON.stringify(v) : v }))
  }

  if (isPlainObject(parsed)) {
    // Busca la primera propiedad que sea un arreglo de objetos (forma típica de API)
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value) && value.length > 0 && value.every(isPlainObject)) {
        return value as Record<string, unknown>[]
      }
    }
    // Sin arreglo anidado: tratamos el objeto como una sola fila
    return [parsed]
  }

  return []
}

export function parseJsonData(text: string): Record<string, unknown>[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('El archivo JSON no es válido')
  }

  const rows = extractRows(parsed)
  if (rows.length === 0) {
    throw new Error('No se encontraron datos tabulares en el JSON')
  }
  return rows.map(normalizeRow)
}
