interface HeroStatProps {
  count: number
  comparacion: number  // delta vs mes anterior (puede ser negativo)
}

export default function HeroStat({ count, comparacion }: HeroStatProps) {
  // Sin entrenamientos todavía: un "0" gigante con "↓ menos que el mes
  // pasado" se lee como reproche. Se muestra una invitación en su lugar.
  if (count === 0) {
    return (
      <div className="bg-neutral-900 rounded-2xl p-5 text-center">
        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">
          Entrenamientos este mes
        </p>
        <p className="text-3xl font-display text-yellow-500 tracking-wider leading-none mb-2">
          Todavía ninguno
        </p>
        <p className="text-sm text-neutral-300">El primero del mes arranca la racha.</p>
      </div>
    )
  }

  let comparacionLabel: string
  if (comparacion > 0) {
    comparacionLabel = `↑ ${comparacion} más que el mes pasado`
  } else if (comparacion < 0) {
    comparacionLabel = `↓ ${Math.abs(comparacion)} menos que el mes pasado`
  } else {
    comparacionLabel = 'Igual que el mes pasado'
  }

  return (
    <div className="bg-neutral-900 rounded-2xl p-5 text-center">
      <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">
        Entrenamientos este mes
      </p>
      <p className="text-5xl font-display text-yellow-500 leading-none mb-2">{count}</p>
      <p className="text-sm text-neutral-300">{comparacionLabel}</p>
    </div>
  )
}
