'use client'

interface SerieRowProps {
  numSerie: number
  serieId: string
  pesoPrevio: number | null    // para mostrar como placeholder
  repsPrevias: number | null   // para mostrar como placeholder
  pesoActual: string
  repsActual: string
  completada: boolean
  onPesoChange: (serieId: string, value: string) => void
  onRepsChange: (serieId: string, value: string) => void
  onBlur: (serieId: string) => void
  onToggleCompletada: (serieId: string) => void
}

export default function SerieRow({
  numSerie,
  serieId,
  pesoPrevio,
  repsPrevias,
  pesoActual,
  repsActual,
  completada,
  onPesoChange,
  onRepsChange,
  onBlur,
  onToggleCompletada,
}: SerieRowProps) {
  return (
    <div
      className={`flex items-center gap-2 py-2 px-3 rounded-xl transition-colors ${
        completada ? 'bg-yellow-50' : 'bg-slate-50'
      }`}
    >
      {/* Número de serie */}
      <span className="text-sm font-semibold text-slate-400 w-5 text-center flex-shrink-0">
        {numSerie}
      </span>

      {/* Input peso */}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={pesoActual}
        onChange={(e) => onPesoChange(serieId, e.target.value)}
        onBlur={() => onBlur(serieId)}
        placeholder={pesoPrevio !== null ? String(pesoPrevio) : '—'}
        className="w-20 px-2 py-2 text-center text-sm font-medium border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
      />

      {/* Input reps */}
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={repsActual}
        onChange={(e) => onRepsChange(serieId, e.target.value)}
        onBlur={() => onBlur(serieId)}
        placeholder={repsPrevias !== null ? String(repsPrevias) : '—'}
        className="w-16 px-2 py-2 text-center text-sm font-medium border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
      />

      {/* Toggle completada */}
      <button
        type="button"
        onClick={() => onToggleCompletada(serieId)}
        className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          completada
            ? 'bg-yellow-500 text-black'
            : 'bg-white border-2 border-slate-200 text-slate-200'
        }`}
        aria-label={completada ? 'Marcar como incompleta' : 'Marcar como completada'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  )
}
