'use client'

import { useRouter } from 'next/navigation'
import { useTiempoTranscurrido } from '@/lib/hooks/useTiempoTranscurrido'
import { formatearTiempo } from '@/lib/utils/tiempo'

interface BarraEntrenamientoEnCursoProps {
  sesionId: string
  diaNombre: string
  iniciadaAt: string
}

// Barra fija que aparece en el resto de la app mientras hay un entrenamiento
// sin terminar: salir a mirar la rutina o el historial no lo pierde de vista,
// y un toque vuelve a la sesión.
export default function BarraEntrenamientoEnCurso({ sesionId, diaNombre, iniciadaAt }: BarraEntrenamientoEnCursoProps) {
  const router = useRouter()
  const segundos = useTiempoTranscurrido(iniciadaAt)

  return (
    <button
      type="button"
      onClick={() => router.push(`/entrenar/${sesionId}`)}
      className="w-full bg-neutral-900 text-white px-4 py-2.5 flex items-center gap-3 text-left hover:bg-neutral-800 transition-colors md:rounded-2xl md:shadow-xl"
    >
      <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-neutral-300">Entrenamiento en curso</span>
        <span className="block font-bold truncate">
          {diaNombre || 'Tu entrenamiento'} · <span className="tabular-nums text-yellow-500">{formatearTiempo(segundos)}</span>
        </span>
      </span>
      <span className="flex-shrink-0 h-10 px-4 rounded-xl bg-yellow-500 text-black font-bold flex items-center">
        Continuar
      </span>
    </button>
  )
}
