// Presentación del historial de entrenamientos: agrupado por mes y con la
// fecha en partes para la columna izquierda. Lógica pura, hora local del
// navegador (ver la nota de zonas en lib/utils/hoy.ts).

export interface ConFecha {
  finalizada_at: string
}

export interface GrupoMes<T> {
  clave: string   // "2026-11"
  titulo: string  // "Este mes", "Octubre", "Marzo de 2025"
  items: T[]
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Agrupa (ya ordenadas de más nueva a más vieja) por mes calendario. */
export function agruparPorMes<T extends ConFecha>(sesiones: T[], ahora: Date): GrupoMes<T>[] {
  const grupos: GrupoMes<T>[] = []
  for (const s of sesiones) {
    const f = new Date(s.finalizada_at)
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    let grupo = grupos.find((g) => g.clave === clave)
    if (!grupo) {
      const esEsteMes = f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth()
      const titulo = esEsteMes
        ? 'Este mes'
        : f.getFullYear() === ahora.getFullYear()
          ? MESES[f.getMonth()]
          : `${MESES[f.getMonth()]} de ${f.getFullYear()}`
      grupo = { clave, titulo, items: [] }
      grupos.push(grupo)
    }
    grupo.items.push(s)
  }
  return grupos
}

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Para la columna de fecha: { numero: "21", dia: "Sáb" }. */
export function partesDeFecha(iso: string): { numero: string; dia: string } {
  const f = new Date(iso)
  return { numero: String(f.getDate()), dia: DIAS_CORTOS[f.getDay()] }
}

/** Minutos entre inicio y fin; null si faltan datos o el resultado no tiene sentido. */
export function duracionMinutos(iniciadaAt: string | null, finalizadaAt: string): number | null {
  if (!iniciadaAt) return null
  const min = Math.round((new Date(finalizadaAt).getTime() - new Date(iniciadaAt).getTime()) / 60000)
  return min >= 0 ? Math.max(1, min) : null
}
