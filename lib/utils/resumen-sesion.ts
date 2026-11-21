// Resumen de una sesión en curso, para confirmar antes de terminarla.
// Lógica pura: recibe los ejercicios tal como los tiene la pantalla (inputs
// como string) y no toca Supabase.

export interface SerieParaResumen {
  peso_kg: string
  repeticiones: string
  completada: boolean
}

export interface EjercicioParaResumen {
  nombre: string
  series: SerieParaResumen[]
}

export interface EjercicioIncompleto {
  nombre: string
  hechas: number
  total: number
}

export interface ResumenSesion {
  seriesCompletadas: number
  seriesTotales: number
  /** Suma de peso × reps de las series completadas que tienen los dos datos. */
  kgMovidos: number
  incompletos: EjercicioIncompleto[]
}

function numero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function resumirSesion(ejercicios: EjercicioParaResumen[]): ResumenSesion {
  let seriesCompletadas = 0
  let seriesTotales = 0
  let kgMovidos = 0
  const incompletos: EjercicioIncompleto[] = []

  for (const ej of ejercicios) {
    const hechas = ej.series.filter((s) => s.completada)
    seriesTotales += ej.series.length
    seriesCompletadas += hechas.length

    for (const s of hechas) {
      const peso = numero(s.peso_kg)
      const reps = numero(s.repeticiones)
      if (peso !== null && reps !== null) kgMovidos += peso * reps
    }

    if (hechas.length < ej.series.length) {
      incompletos.push({ nombre: ej.nombre, hechas: hechas.length, total: ej.series.length })
    }
  }

  return { seriesCompletadas, seriesTotales, kgMovidos: Math.round(kgMovidos), incompletos }
}

/** "58 min", "1 h 05 min". Menos de un minuto cuenta como 1 min. */
export function formatearDuracion(segundos: number): string {
  const minutos = Math.max(1, Math.round(segundos / 60))
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${h} h ${String(m).padStart(2, '0')} min`
}
