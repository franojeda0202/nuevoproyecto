// Estado de la sesión activa para la pantalla: qué ejercicio es "el de ahora"
// y cómo se resume cada uno cuando está plegado. Lógica pura.

export interface SerieEstado {
  completada: boolean
}

export interface EjercicioEstado {
  series: SerieEstado[]
}

export type EstadoEjercicio = 'completo' | 'empezado' | 'pendiente'

export function estadoEjercicio(ej: EjercicioEstado): EstadoEjercicio {
  const hechas = ej.series.filter((s) => s.completada).length
  if (ej.series.length > 0 && hechas === ej.series.length) return 'completo'
  return hechas > 0 ? 'empezado' : 'pendiente'
}

/**
 * El ejercicio "de ahora": el primero, en orden, que no está completo.
 * Así, al completar la última serie de uno, el siguiente pasa a ser el actual
 * sin tocar nada. -1 si ya está todo hecho.
 */
export function indiceEjercicioActual(ejercicios: EjercicioEstado[]): number {
  return ejercicios.findIndex((ej) => estadoEjercicio(ej) !== 'completo')
}

/** "3 de 3" */
export function seriesHechas(ej: EjercicioEstado): string {
  return `${ej.series.filter((s) => s.completada).length} de ${ej.series.length}`
}

/** "70 kg × 8", "70 kg", "8 reps" o null si no hay dato de la vez anterior. */
export function formatearUltimaVez(
  ultima: { peso_kg: number | null; repeticiones: number | null } | null
): string | null {
  if (!ultima) return null
  const { peso_kg, repeticiones } = ultima
  const peso = peso_kg !== null ? `${String(peso_kg).replace('.', ',')} kg` : null
  if (peso && repeticiones !== null) return `${peso} × ${repeticiones}`
  if (peso) return peso
  if (repeticiones !== null) return `${repeticiones} reps`
  return null
}
