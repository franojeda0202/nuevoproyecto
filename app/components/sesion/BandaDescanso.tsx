'use client'

interface BandaDescansoProps {
  tiempoRestante: number // segundos
  tiempoTotal: number
  onSumar: () => void
  onSaltar: () => void
}

function formatearCountdown(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Descanso en curso, visible sin abrir nada: arranca solo al completar una
// serie y se ajusta con un toque. El panel del temporizador queda para elegir
// otra duración.
export default function BandaDescanso({ tiempoRestante, tiempoTotal, onSumar, onSaltar }: BandaDescansoProps) {
  const progreso = tiempoTotal > 0 ? Math.min(1, tiempoRestante / tiempoTotal) : 0

  return (
    <div className="relative overflow-hidden bg-neutral-900 text-white rounded-2xl pl-4 pr-2 py-2 flex items-center gap-2">
      <div
        className="absolute left-0 bottom-0 h-1 bg-yellow-500 transition-[width] duration-1000 ease-linear"
        style={{ width: `${progreso * 100}%` }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-neutral-300">Descanso</p>
        <p className="text-2xl font-bold text-yellow-500 tabular-nums leading-tight" role="timer" aria-live="off">
          {formatearCountdown(tiempoRestante)}
        </p>
      </div>
      <button
        type="button"
        onClick={onSumar}
        className="h-11 px-3 rounded-xl border border-neutral-600 text-white font-semibold hover:bg-neutral-800 transition-colors"
      >
        +30 s
      </button>
      <button
        type="button"
        onClick={onSaltar}
        className="h-11 px-4 rounded-xl bg-white text-neutral-900 font-bold hover:bg-neutral-200 transition-colors"
      >
        Saltar
      </button>
    </div>
  )
}
