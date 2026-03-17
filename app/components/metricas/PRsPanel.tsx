'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PRejercicioDisplay, EjercicioRutinaActiva } from '@/lib/types/database'

interface PRsPanelProps {
  prs: PRejercicioDisplay[]
  ejerciciosDisponibles: EjercicioRutinaActiva[]  // para el selector "+"
  pinnedIds: string[]
  sinRutina: boolean
  onPinChange: (ids: string[]) => void
}

function formatearPR(pesoKg: number | null, repeticiones: number | null): string {
  if (pesoKg === null || repeticiones === null) return '-'
  return `${pesoKg} kg × ${repeticiones}`
}

export default function PRsPanel({
  prs,
  ejerciciosDisponibles,
  pinnedIds,
  sinRutina,
  onPinChange,
}: PRsPanelProps) {
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const router = useRouter()

  // Ejercicios disponibles para agregar (los que ya están en la lista no aparecen)
  const idsYaMostrados = new Set(prs.map(p => p.ejercicioId))
  const disponiblesParaAgregar = ejerciciosDisponibles.filter(
    e => !idsYaMostrados.has(e.ejercicioId)
  )

  const mostrarBotonMas = !sinRutina && pinnedIds.length < 4 && disponiblesParaAgregar.length > 0

  const handleAgregar = (ejercicioId: string) => {
    onPinChange([...pinnedIds, ejercicioId])
    setSelectorAbierto(false)
  }

  const handleQuitar = (ejercicioId: string) => {
    onPinChange(pinnedIds.filter(id => id !== ejercicioId))
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
          🏆 Récords personales
        </h3>
        {mostrarBotonMas && (
          <button
            type="button"
            onClick={() => setSelectorAbierto(prev => !prev)}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-lg font-bold leading-none"
            aria-label="Agregar ejercicio"
          >
            +
          </button>
        )}
      </div>

      {sinRutina ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-3">
            Generá tu primera rutina para ver tus récords personales
          </p>
          <button
            type="button"
            onClick={() => router.push('/rutinas')}
            className="px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
          >
            Ir a rutinas
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {prs.map((pr, idx) => (
              <div
                key={pr.ejercicioId}
                className={`flex items-center justify-between py-2 ${
                  idx < prs.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-700 truncate">{pr.nombre}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-yellow-600">
                    {formatearPR(pr.pesoKg, pr.repeticiones)}
                  </span>
                  {pr.esPinned && (
                    <button
                      type="button"
                      onClick={() => handleQuitar(pr.ejercicioId)}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors text-xs"
                      aria-label={`Quitar ${pr.nombre}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Selector inline */}
          {selectorAbierto && disponiblesParaAgregar.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2">Agregar ejercicio</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {disponiblesParaAgregar.map(ej => (
                  <button
                    key={ej.ejercicioId}
                    type="button"
                    onClick={() => handleAgregar(ej.ejercicioId)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-yellow-50 hover:text-slate-900 rounded-lg transition-colors"
                  >
                    {ej.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
