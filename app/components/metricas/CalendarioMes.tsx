interface CalendarioMesProps {
  diasEntrenados: string[]  // ISO "YYYY-MM-DD"
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function CalendarioMes({ diasEntrenados }: CalendarioMesProps) {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = hoy.getMonth()

  const diasEnSet = new Set(diasEntrenados)
  // Usar fecha local (no UTC) para que coincida con los strings generados en metricas-service.ts
  const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  // Primer día del mes: getDay() retorna 0=dom, 1=lun, ..., 6=sab
  // Queremos que el calendario empiece en lunes (índice 0)
  const primerDia = new Date(year, month, 1)
  const offsetDomingo = primerDia.getDay()  // 0=dom, 1=lun, ..., 6=sab
  const offsetLunes = offsetDomingo === 0 ? 6 : offsetDomingo - 1

  const diasEnMes = new Date(year, month + 1, 0).getDate()

  const nombreMes = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 capitalize">
        {nombreMes}
      </p>

      {/* Headers días */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-xs text-slate-400">{d}</div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-1">
        {/* Celdas vacías para el offset */}
        {Array.from({ length: offsetLunes }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}

        {/* Días del mes */}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
          const diaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const entrenado = diasEnSet.has(diaStr)
          const esHoy = diaStr === todayStr

          let bgClass = 'bg-slate-100 text-slate-400'
          if (entrenado) {
            bgClass = 'bg-yellow-500 text-black font-bold'
          } else if (esHoy) {
            bgClass = 'bg-slate-200 text-slate-900 font-bold'
          }

          return (
            <div
              key={dia}
              className={`h-8 rounded-md flex items-center justify-center text-xs ${bgClass}`}
            >
              {dia}
            </div>
          )
        })}
      </div>
    </div>
  )
}
