'use client'

import { useEffect, useState } from 'react'
import { segundosDesde } from '@/lib/utils/tiempo'

/**
 * Segundos transcurridos desde `iniciadaAt`, actualizados cada segundo.
 * Se calcula contra el inicio guardado, no sumando ticks: así no se atrasa si
 * el teléfono suspende la pestaña, y es el mismo número en todas las pantallas.
 */
export function useTiempoTranscurrido(iniciadaAt: string | null | undefined): number {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!iniciadaAt) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [iniciadaAt])

  return iniciadaAt ? segundosDesde(iniciadaAt, ahora) : 0
}
