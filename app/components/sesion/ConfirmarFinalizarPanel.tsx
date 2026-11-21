'use client'

import { useEffect, useRef } from 'react'
import { ResumenSesion, formatearDuracion } from '@/lib/utils/resumen-sesion'

interface ConfirmarFinalizarPanelProps {
  isOpen: boolean
  resumen: ResumenSesion
  duracionSegundos: number
  finalizando: boolean
  onSeguir: () => void
  onConfirmar: () => void
  onMarcarSinMarcar: () => void
}

const formatoKg = new Intl.NumberFormat('es-AR')

// Hoja inferior que se abre al tocar "Terminar entrenamiento". Una sesión
// finalizada ya no se puede editar, así que terminarla nunca es un solo toque.
export default function ConfirmarFinalizarPanel({
  isOpen,
  resumen,
  duracionSegundos,
  finalizando,
  onSeguir,
  onConfirmar,
  onMarcarSinMarcar,
}: ConfirmarFinalizarPanelProps) {
  const seguirRef = useRef<HTMLButtonElement>(null)

  // Foco en la opción segura al abrir, y Escape para volver a la sesión
  useEffect(() => {
    if (!isOpen) return
    seguirRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSeguir()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onSeguir])

  if (!isOpen) return null

  const seriesFaltantes = resumen.seriesTotales - resumen.seriesCompletadas

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onSeguir} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-finalizar"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="max-w-lg mx-auto px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+2rem)] flex flex-col gap-5">
          <div className="flex justify-center" aria-hidden="true">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          <div>
            <h2
              id="titulo-finalizar"
              className="text-3xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1"
            >
              ¿Terminar el entrenamiento?
            </h2>
            <p className="text-slate-600">Después ya no se puede editar.</p>
          </div>

          {/* Olvido típico: cargar peso y reps y no tocar el círculo. Sin esto,
              la sesión puede guardarse como vacía y no contar en la semana. */}
          {resumen.sinMarcar.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-2xl px-4 py-3 flex flex-col gap-3">
              <div>
                <p className="font-bold text-slate-900">
                  {resumen.sinMarcar.length === 1
                    ? 'Cargaste 1 serie sin marcarla'
                    : `Cargaste ${resumen.sinMarcar.length} series sin marcarlas`}
                </p>
                <p className="text-sm text-slate-700">
                  Tienen peso y repeticiones, pero no las tocaste como hechas.
                </p>
              </div>
              <button
                type="button"
                onClick={onMarcarSinMarcar}
                disabled={finalizando}
                className="h-11 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {resumen.sinMarcar.length === 1 ? 'Marcarla como hecha' : 'Marcarlas como hechas'}
              </button>
            </div>
          )}

          {seriesFaltantes > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
              <p className="font-bold text-orange-900">
                {seriesFaltantes === 1 ? 'Te falta 1 serie' : `Te faltan ${seriesFaltantes} series`}
              </p>
              <ul className="mt-1 text-sm text-orange-900 space-y-0.5">
                {resumen.incompletos.map((ej) => (
                  <li key={ej.nombre}>
                    {ej.nombre}: {ej.hechas} de {ej.total}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-3 gap-2">
            <div className="bg-slate-100 rounded-2xl p-3">
              <dt className="text-xs text-slate-600">Duración</dt>
              <dd className="text-xl font-bold tabular-nums text-slate-900">
                {formatearDuracion(duracionSegundos)}
              </dd>
            </div>
            <div className="bg-slate-100 rounded-2xl p-3">
              <dt className="text-xs text-slate-600">Series</dt>
              <dd className="text-xl font-bold tabular-nums text-slate-900">
                {resumen.seriesCompletadas}/{resumen.seriesTotales}
              </dd>
            </div>
            <div className="bg-slate-100 rounded-2xl p-3">
              <dt className="text-xs text-slate-600">Kg movidos</dt>
              <dd className="text-xl font-bold tabular-nums text-slate-900">
                {formatoKg.format(resumen.kgMovidos)}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <button
              ref={seguirRef}
              type="button"
              onClick={onSeguir}
              disabled={finalizando}
              className="h-14 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 active:bg-yellow-600 transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              Seguir entrenando
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              disabled={finalizando}
              className="h-12 border-2 border-neutral-900 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-100 transition-colors disabled:opacity-50"
            >
              {finalizando ? 'Terminando...' : seriesFaltantes > 0 ? 'Terminar igual' : 'Terminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
