interface MiniStatsProps {
  racha: number
  duracionPromedio: number | null
  porcentajeCompletadas: number | null
}

export default function MiniStats({ racha, duracionPromedio, porcentajeCompletadas }: MiniStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{racha}</p>
        <p className="text-xs text-slate-400">sem. racha</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">
          {duracionPromedio !== null ? `${duracionPromedio}'` : '-'}
        </p>
        <p className="text-xs text-slate-400">duración prom.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">
          {porcentajeCompletadas !== null ? `${porcentajeCompletadas}%` : '-'}
        </p>
        <p className="text-xs text-slate-400">series complet.</p>
      </div>
    </div>
  )
}
