// Rangos de repeticiones distintos por serie, guardados en el mismo campo de
// texto `repeticiones` de la rutina, separados por "/".
//
//   "8-11"          → todas las series 8-11
//   "6-8 / 8-10"    → serie 1: 6-8, serie 2: 8-10
//   "6-8 / 8-12"    → con 3 series: 6-8, 8-12, 8-12 (el último rango se repite)
//
// Así no hace falta cambiar el esquema: una rutina vieja con "10-12" sigue
// significando lo mismo.

export const SEPARADOR_RANGOS = '/'

/** Rangos escritos, sin espacios ni vacíos. "6-8 / 8-10" → ["6-8", "8-10"] */
export function separarRangos(repeticiones: string): string[] {
  return repeticiones
    .split(SEPARADOR_RANGOS)
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
}

/** Rango objetivo de una serie (numeroSerie empieza en 1). Vacío si no hay nada escrito. */
export function rangoDeSerie(repeticiones: string, numeroSerie: number): string {
  const rangos = separarRangos(repeticiones)
  if (rangos.length === 0) return ''
  const indice = Math.min(Math.max(numeroSerie, 1), rangos.length) - 1
  return rangos[indice]
}

/** True si hay más de un rango distinto entre las series. */
export function tieneRangosPorSerie(repeticiones: string): boolean {
  return new Set(separarRangos(repeticiones)).size > 1
}

/**
 * Resumen corto del ejercicio, para el encabezado de la tarjeta.
 *   (3, "8-11")        → "3 × 8-11"
 *   (3, "6-8 / 8-12")  → "3 series"  (el rango de cada serie se muestra en su fila)
 */
export function formatearPrescripcion(series: number, repeticiones: string): string {
  const rangos = separarRangos(repeticiones)
  if (rangos.length === 0 || tieneRangosPorSerie(repeticiones)) return `${series} series`
  return `${series} × ${rangos[0]}`
}

/** Error para mostrar si la combinación no tiene sentido, o null si está bien. */
export function validarRangos(series: number, repeticiones: string): string | null {
  const rangos = separarRangos(repeticiones)
  if (rangos.length === 0) return 'Debes indicar las repeticiones'
  if (rangos.length > series) {
    return `Escribiste ${rangos.length} rangos pero el ejercicio tiene ${series} series`
  }
  return null
}
