/** Cronómetro de entrenamiento: "05:09", "1:02:03". */
export function formatearTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Segundos desde `iniciadaAt` hasta `ahoraMs`. Nunca negativo (relojes desfasados). */
export function segundosDesde(iniciadaAt: string, ahoraMs: number): number {
  return Math.max(0, Math.floor((ahoraMs - new Date(iniciadaAt).getTime()) / 1000))
}
