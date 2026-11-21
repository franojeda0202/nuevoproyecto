'use client'

import { useState } from 'react'
import { DiaConEjerciciosEditables } from '@/lib/types/database'
import { separarRangos, tieneRangosPorSerie } from '@/lib/utils/rangos-series'

interface RutinaLecturaProps {
  dias: DiaConEjerciciosEditables[]
}

/** "3 × 8-11", o "6-8 / 8-10" cuando cada serie tiene su rango */
function prescripcion(series: number, repeticiones: string): string {
  if (tieneRangosPorSerie(repeticiones)) return separarRangos(repeticiones).join(' / ')
  return `${series} × ${repeticiones}`
}

// La rutina en modo lectura: se arma una vez y se consulta de vez en cuando
// (el coach la cambia cada 4 o 5 meses), así que por defecto se ve compacta,
// con los días plegados y sin controles de edición.
export default function RutinaLectura({ dias }: RutinaLecturaProps) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  return (
    <ul className="flex flex-col gap-3">
      {[...dias].sort((a, b) => a.orden - b.orden).map((dia) => {
        const abierto = abiertos.has(dia.id)
        const totalSeries = dia.ejercicios.reduce((t, e) => t + e.series, 0)
        return (
          <li key={dia.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => alternar(dia.id)}
              aria-expanded={abierto}
              className="w-full min-h-16 px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="w-10 h-10 flex-shrink-0 rounded-xl bg-neutral-900 text-yellow-500 font-display text-2xl leading-none flex items-center justify-center">
                {dia.orden}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-slate-900 break-words">{dia.nombre_dia}</span>
                <span className="block text-sm text-slate-600">
                  {dia.ejercicios.length} {dia.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'} · {totalSeries} {totalSeries === 1 ? 'serie' : 'series'}
                </span>
              </span>
              <svg
                className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {abierto && (
              dia.ejercicios.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-slate-600">Este día no tiene ejercicios.</p>
              ) : (
                <ol className="border-t border-slate-100">
                  {[...dia.ejercicios].sort((a, b) => a.orden - b.orden).map((ej, i) => (
                    <li key={ej.id} className="px-4 py-3 flex gap-3 border-b border-slate-100 last:border-b-0">
                      <span className="w-6 flex-shrink-0 text-sm font-semibold text-slate-500 tabular-nums pt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-semibold text-slate-900 break-words first-letter:uppercase">{ej.ejercicio.nombre}</p>
                          <p className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0">
                            {prescripcion(ej.series, ej.repeticiones)}
                          </p>
                        </div>
                        {ej.notas_coach && (
                          <p className="text-sm text-slate-600 mt-0.5">{ej.notas_coach}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )
            )}
          </li>
        )
      })}
    </ul>
  )
}
