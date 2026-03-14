'use client'

import { useState } from 'react'

interface TemporizadorPanelProps {
  isOpen: boolean
  onClose: () => void
  tiempoRestante: number   // segundos; 0 = timer inactivo
  tiempoTotal: number      // segundos; para calcular la barra de progreso (extensión intencional sobre el spec — necesario para el progress bar)
  corriendo: boolean
  onStart: (segundos: number) => void
  onCancelar: () => void
}

const PRESETS = [
  { label: '1:00', segundos: 60 },
  { label: '1:30', segundos: 90 },
  { label: '2:00', segundos: 120 },
  { label: '3:00', segundos: 180 },
]

function formatearCountdown(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TemporizadorPanel({
  isOpen,
  onClose,
  tiempoRestante,
  tiempoTotal,
  corriendo,
  onStart,
  onCancelar,
}: TemporizadorPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState(120) // 2:00 por defecto

  const progreso = tiempoTotal > 0 ? tiempoRestante / tiempoTotal : 0

  return (
    <>
      {/* Overlay — click fuera cierra el panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel deslizable */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="px-6 pb-8 pt-2">
          {/* Título */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 text-center">
            Descanso
          </p>

          {corriendo ? (
            /* Estado: timer corriendo */
            <>
              {/* Tiempo restante grande */}
              <div className="text-center mb-4">
                <span className="text-5xl font-display text-yellow-500 tabular-nums tracking-widest">
                  {formatearCountdown(tiempoRestante)}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progreso * 100}%` }}
                />
              </div>

              {/* Botón cancelar */}
              <button
                type="button"
                onClick={onCancelar}
                className="w-full h-12 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-200"
              >
                ✕ Cancelar
              </button>
            </>
          ) : (
            /* Estado: seleccionar preset */
            <>
              {/* Presets */}
              <div className="flex gap-2 mb-5">
                {PRESETS.map(({ label, segundos }) => (
                  <button
                    key={segundos}
                    type="button"
                    onClick={() => setSelectedPreset(segundos)}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      selectedPreset === segundos
                        ? 'bg-yellow-500 text-black shadow-md'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Botón start */}
              <button
                type="button"
                onClick={() => onStart(selectedPreset)}
                className="w-full h-12 bg-neutral-900 text-white rounded-xl font-bold text-lg hover:bg-neutral-800 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Iniciar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
