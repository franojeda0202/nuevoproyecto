// Lógica de la pantalla "Hoy": qué día de la rutina toca y cómo viene la
// semana. Funciones puras: reciben `ahora` en vez de llamar a new Date(),
// para que los tests sean deterministas.
//
// Las fechas se evalúan en la hora local del navegador, que es la de la
// persona. Si esto alguna vez corre en el servidor (UTC), hay que pasarle la
// zona horaria explícita (ver la regla de zonas en convivencia-app).

export interface DiaRutina {
  id: string
  orden: number
  nombre_dia: string
}

export interface SesionTerminada {
  dia_id: string | null
  finalizada_at: string
}

/**
 * El día siguiente al último entrenado, en orden y dando la vuelta.
 * Sin sesiones previas, o si el último día ya no existe en la rutina, el primero.
 */
export function siguienteDia<T extends DiaRutina>(dias: T[], ultimoDiaId: string | null): T | null {
  if (dias.length === 0) return null
  const ordenados = [...dias].sort((a, b) => a.orden - b.orden)
  const i = ordenados.findIndex((d) => d.id === ultimoDiaId)
  if (i === -1) return ordenados[0]
  return ordenados[(i + 1) % ordenados.length]
}

/** Lunes 00:00 local de la semana de `fecha`. */
export function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const desdeLunes = (d.getDay() + 6) % 7 // lunes = 0 … domingo = 6
  d.setDate(d.getDate() - desdeLunes)
  return d
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export interface DiaDeSemana {
  inicial: string        // "L", "M", …
  nombre: string         // "lunes", para lectores de pantalla
  entrenado: boolean
  esHoy: boolean
}

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Los 7 días de la semana actual (lunes a domingo) con los que tuvieron sesión. */
export function semanaActual(sesiones: SesionTerminada[], ahora: Date): DiaDeSemana[] {
  const lunes = inicioDeSemana(ahora)
  return INICIALES.map((inicial, i) => {
    const dia = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i)
    return {
      inicial,
      nombre: NOMBRES[i],
      entrenado: sesiones.some((s) => mismoDia(new Date(s.finalizada_at), dia)),
      esHoy: mismoDia(dia, ahora),
    }
  })
}

/** Cantidad de días distintos con sesión en la semana actual. */
export function entrenamientosEstaSemana(sesiones: SesionTerminada[], ahora: Date): number {
  return semanaActual(sesiones, ahora).filter((d) => d.entrenado).length
}

/** "hoy", "ayer", "el martes" (últimos 6 días) o "el 17 de nov". */
export function cuandoFue(iso: string, ahora: Date): string {
  const fecha = new Date(iso)
  const a = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dias = Math.round((a.getTime() - f.getTime()) / 86_400_000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias > 1 && dias < 7) return `el ${NOMBRES[(fecha.getDay() + 6) % 7]}`
  return `el ${fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')}`
}
