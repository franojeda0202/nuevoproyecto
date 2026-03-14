'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import AppLayout from '@/app/components/AppLayout'
import {
  obtenerSesionActiva,
  actualizarSerie,
  finalizarSesion,
} from '@/lib/services/sesion-service'
import { SesionActiva } from '@/lib/types/database'
import SerieRow from '@/app/components/sesion/SerieRow'
import TemporizadorPanel from '@/app/components/sesion/TemporizadorPanel'
import { reproducirBeep } from '@/lib/utils/audio'

function formatearCountdown(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatearTiempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SesionActivaPage() {
  const params = useParams()
  const sesionId = params.sesionId as string
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  const [sesion, setSesion] = useState<SesionActiva | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0) // segundos

  // Temporizador de descanso
  const [panelOpen, setPanelOpen] = useState(false)
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const [tiempoTotal, setTiempoTotal] = useState(0)
  const [timerCorriendo, setTimerCorriendo] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const beepFiredRef = useRef(false)

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated || !userId) {
      router.replace('/')
      return
    }

    obtenerSesionActiva(supabase, sesionId, userId).then(result => {
      if (result.success && result.data) {
        setSesion(result.data)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, sesionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sesion?.iniciada_at) return
    const inicio = new Date(sesion.iniciada_at).getTime()
    const tick = () => setTiempoTranscurrido(Math.floor((Date.now() - inicio) / 1000))
    tick() // calcular inmediatamente sin esperar 1 segundo
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sesion?.iniciada_at])

  useEffect(() => {
    if (!timerCorriendo || tiempoRestante <= 0) return

    const id = setInterval(() => {
      let terminado = false

      setTiempoRestante(prev => {
        if (prev <= 1) {
          terminado = true
          return 0
        }
        return prev - 1
      })

      // Side-effects FUERA del updater para evitar doble ejecución en Strict Mode
      if (terminado && !beepFiredRef.current) {
        beepFiredRef.current = true
        clearInterval(id)
        setTimerCorriendo(false)
        reproducirBeep(audioCtxRef.current)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      }
    }, 1000)

    return () => clearInterval(id)
  }, [timerCorriendo]) // solo depende de timerCorriendo, no de tiempoRestante

  const handlePesoChange = (serieId: string, ejId: string, value: string) => {
    setSesion(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ejercicios: prev.ejercicios.map(ej =>
          ej.rutina_ejercicio_id !== ejId ? ej : {
            ...ej,
            series: ej.series.map(s => s.id === serieId ? { ...s, peso_kg: value } : s),
          }
        ),
      }
    })
  }

  const handleRepsChange = (serieId: string, ejId: string, value: string) => {
    setSesion(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ejercicios: prev.ejercicios.map(ej =>
          ej.rutina_ejercicio_id !== ejId ? ej : {
            ...ej,
            series: ej.series.map(s => s.id === serieId ? { ...s, repeticiones: value } : s),
          }
        ),
      }
    })
  }

  const handleBlur = useCallback((serieId: string, ejId: string) => {
    let serieParaGuardar: { peso_kg: string; repeticiones: string } | null = null

    setSesion(prev => {
      if (!prev) return prev
      const ej = prev.ejercicios.find(e => e.rutina_ejercicio_id === ejId)
      const serie = ej?.series.find(s => s.id === serieId)
      if (serie) serieParaGuardar = { peso_kg: serie.peso_kg, repeticiones: serie.repeticiones }
      return prev
    })

    // Side-effect FUERA del updater — no se ejecuta doble en Strict Mode
    if (serieParaGuardar) {
      const { peso_kg, repeticiones } = serieParaGuardar
      actualizarSerie(supabase, {
        id: serieId,
        sesionId,
        peso_kg: peso_kg ? parseFloat(peso_kg) : null,
        repeticiones: repeticiones ? parseInt(repeticiones) : null,
      })
    }
  }, [supabase, sesionId])

  const handleToggleCompletada = (serieId: string, ejId: string) => {
    let serieActualizada: { peso_kg: string; repeticiones: string; completada: boolean } | null = null

    setSesion(prev => {
      if (!prev) return prev
      const newSesion = {
        ...prev,
        ejercicios: prev.ejercicios.map(ej =>
          ej.rutina_ejercicio_id !== ejId ? ej : {
            ...ej,
            series: ej.series.map(s => {
              if (s.id !== serieId) return s
              const updated = { ...s, completada: !s.completada }
              serieActualizada = updated
              return updated
            }),
          }
        ),
      }
      return newSesion
    })

    // Auto-save del toggle (después del setState)
    setTimeout(() => {
      if (serieActualizada) {
        actualizarSerie(supabase, {
          id: serieId,
          sesionId,
          peso_kg: serieActualizada.peso_kg ? parseFloat(serieActualizada.peso_kg) : null,
          repeticiones: serieActualizada.repeticiones ? parseInt(serieActualizada.repeticiones) : null,
          completada: serieActualizada.completada,
        })
      }
    }, 0)
  }

  const handleFinalizar = async () => {
    if (!userId) return
    setFinalizando(true)
    const resultado = await finalizarSesion(supabase, sesionId, userId)
    if (!resultado.success) {
      toast.error('No se pudo finalizar la sesión. Intentá de nuevo.')
      setFinalizando(false)
      return
    }
    router.push('/rutinas')
  }

  const handleTimerStart = (segundos: number) => {
    // Crear/desbloquear AudioContext en este gesto del usuario (requisito iOS/Android)
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new AudioCtx()
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    } catch {
      // Sin sonido en este navegador — el timer funciona igual
    }
    beepFiredRef.current = false
    setTiempoRestante(segundos)
    setTiempoTotal(segundos)
    setTimerCorriendo(true)
    setPanelOpen(false)
  }

  const handleTimerCancelar = () => {
    setTiempoRestante(0)
    setTiempoTotal(0)
    setTimerCorriendo(false)
  }

  if (loadingAuth || loading) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  if (!sesion) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-slate-600 mb-4">Sesión no encontrada.</p>
            <button
              type="button"
              onClick={() => router.push('/entrenar')}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Volver a Entrenar
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (sesion.finalizada_at) {
    router.replace('/rutinas')
    return null
  }

  return (
    <AppLayout>

    {/* Badge cronómetro de sesión */}
    {sesion && (
      <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5 bg-neutral-900 text-yellow-500 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums shadow-lg pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
        {formatearTiempo(tiempoTranscurrido)}
      </div>
    )}

    <div className="min-h-screen app-page-bg p-4 md:p-8 pb-28">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push('/entrenar')}
            className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors pl-14 md:pl-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Cambiar día
          </button>
          <h1 className="pl-14 md:pl-0 text-3xl md:text-5xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
            {sesion.dia_nombre}
          </h1>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
        </div>

        {/* Ejercicios */}
        <div className="grid md:grid-cols-2 gap-5">
          {sesion.ejercicios.map((ej) => (
            <div
              key={ej.rutina_ejercicio_id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900">{ej.nombre}</h3>
                <span className="text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-lg flex-shrink-0">
                  {ej.repeticiones_rutina
                    ? `${ej.series_rutina} × ${ej.repeticiones_rutina}`
                    : `${ej.series_rutina} series`}
                </span>
              </div>

              {/* Headers de columnas */}
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className="text-xs font-semibold text-slate-400 w-5 text-center">#</span>
                <span className="text-xs font-semibold text-slate-400 w-20 text-center">Peso</span>
                <span className="text-xs font-semibold text-slate-400 w-16 text-center">Reps</span>
              </div>

              {/* Series */}
              <div className="space-y-2">
                {ej.series.map((serie) => (
                  <SerieRow
                    key={serie.id}
                    numSerie={serie.numero_serie}
                    serieId={serie.id}
                    pesoPrevio={ej.ultima_serie?.peso_kg ?? null}
                    repsPrevias={ej.ultima_serie?.repeticiones ?? null}
                    pesoActual={serie.peso_kg}
                    repsActual={serie.repeticiones}
                    completada={serie.completada}
                    onPesoChange={(id, val) => handlePesoChange(id, ej.rutina_ejercicio_id, val)}
                    onRepsChange={(id, val) => handleRepsChange(id, ej.rutina_ejercicio_id, val)}
                    onBlur={(id) => handleBlur(id, ej.rutina_ejercicio_id)}
                    onToggleCompletada={(id) => handleToggleCompletada(id, ej.rutina_ejercicio_id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Barra inferior sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
        <div className="max-w-lg mx-auto flex gap-3 items-center">

          {/* Botón temporizador */}
          <button
            type="button"
            onClick={() => setPanelOpen(prev => !prev)}
            className="w-12 h-12 flex-shrink-0 bg-neutral-900 text-white rounded-xl flex items-center justify-center hover:bg-neutral-800 transition-all duration-200"
            aria-label="Abrir temporizador de descanso"
          >
            {timerCorriendo ? (
              <span className="text-yellow-500 text-sm font-bold tabular-nums animate-pulse">
                {formatearCountdown(tiempoRestante)}
              </span>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
                <path d="M9 2h6" />
              </svg>
            )}
          </button>

          {/* Botón finalizar */}
          <button
            type="button"
            onClick={handleFinalizar}
            disabled={finalizando}
            className="flex-1 h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10 flex items-center justify-center"
          >
            {finalizando ? 'Finalizando...' : 'Finalizar sesión'}
          </button>

        </div>
      </div>
    </div>
    <TemporizadorPanel
      isOpen={panelOpen}
      onClose={() => setPanelOpen(false)}
      tiempoRestante={tiempoRestante}
      tiempoTotal={tiempoTotal}
      corriendo={timerCorriendo}
      onStart={handleTimerStart}
      onCancelar={handleTimerCancelar}
    />
    </AppLayout>
  )
}
