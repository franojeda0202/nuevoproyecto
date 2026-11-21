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
import ConfirmarFinalizarPanel from '@/app/components/sesion/ConfirmarFinalizarPanel'
import { resumirSesion } from '@/lib/utils/resumen-sesion'
import { reproducirBeep } from '@/lib/utils/audio'
import { formatearPrescripcion, rangoDeSerie } from '@/lib/utils/rangos-series'
import { trackEvent } from '@/lib/analytics'
import { useTiempoTranscurrido } from '@/lib/hooks/useTiempoTranscurrido'
import { formatearTiempo } from '@/lib/utils/tiempo'
import BandaDescanso from '@/app/components/sesion/BandaDescanso'
import {
  estadoEjercicio,
  formatearUltimaVez,
  indiceEjercicioActual,
  seriesHechas,
} from '@/lib/utils/sesion-activa'

// Duración del descanso automático: la última elegida en el panel, por navegador
const CLAVE_DESCANSO = 'gymlogic:descanso-segundos'
const DESCANSO_POR_DEFECTO = 120

function leerDescanso(): number {
  try {
    const guardado = Number(window.localStorage.getItem(CLAVE_DESCANSO))
    return Number.isFinite(guardado) && guardado > 0 ? guardado : DESCANSO_POR_DEFECTO
  } catch {
    return DESCANSO_POR_DEFECTO
  }
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
  const [confirmarAbierto, setConfirmarAbierto] = useState(false)

  // Temporizador de descanso
  const [panelOpen, setPanelOpen] = useState(false)
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const [tiempoTotal, setTiempoTotal] = useState(0)
  const [timerCorriendo, setTimerCorriendo] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const beepFiredRef = useRef(false)
  // Lazy: la pantalla se pinta en el cliente después de cargar, así que leer
  // localStorage acá no desajusta la hidratación (el servidor solo pinta el spinner)
  const [descansoSegundos, setDescansoSegundos] = useState(() =>
    typeof window === 'undefined' ? DESCANSO_POR_DEFECTO : leerDescanso()
  )

  // Ejercicios abiertos a mano, además del actual (que siempre está abierto)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const indiceActual = sesion ? indiceEjercicioActual(sesion.ejercicios) : -1
  const indiceAnteriorRef = useRef<number | null>(null)

  // Al completar un ejercicio, llevar la vista al siguiente (no en la carga inicial)
  useEffect(() => {
    if (!sesion) return
    const anterior = indiceAnteriorRef.current
    indiceAnteriorRef.current = indiceActual
    if (anterior === null || anterior === indiceActual || indiceActual < 0) return
    const id = sesion.ejercicios[indiceActual].rutina_ejercicio_id
    document.getElementById(`ej-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [indiceActual, sesion])

  const alternarAbierto = (id: string) => {
    setAbiertos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

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

  const tiempoTranscurrido = useTiempoTranscurrido(sesion?.iniciada_at)

  // Decrementa el contador cada segundo mientras el timer corre
  useEffect(() => {
    if (!timerCorriendo || tiempoRestante <= 0) return
    const id = setInterval(() => {
      setTiempoRestante(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [timerCorriendo]) // solo depende de timerCorriendo, no de tiempoRestante

  // Detecta cuando el timer llegó a 0 y dispara beep + vibración
  // Separado del interval porque el updater de setState es diferido en React 18 —
  // no se puede leer el resultado del updater sincrónicamente dentro del setInterval callback
  useEffect(() => {
    if (tiempoRestante !== 0 || !timerCorriendo) return
    setTimerCorriendo(false)
    if (!beepFiredRef.current) {
      beepFiredRef.current = true
      reproducirBeep(audioCtxRef.current)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }
  }, [tiempoRestante, timerCorriendo])

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

  // Al salir del campo peso: guarda la serie actual y auto-completa las siguientes vacías
  const handlePesoBlur = useCallback((serieId: string, ejId: string) => {
    type SerieGuardar = { id: string; peso_kg: string; repeticiones: string }
    let toSave: SerieGuardar[] | null = null

    setSesion(prev => {
      if (!prev) return prev
      const ejIdx = prev.ejercicios.findIndex(e => e.rutina_ejercicio_id === ejId)
      if (ejIdx === -1) return prev

      const ej = prev.ejercicios[ejIdx]
      const currentIdx = ej.series.findIndex(s => s.id === serieId)
      if (currentIdx === -1) return prev

      const current = ej.series[currentIdx]
      const saves: Array<{ id: string; peso_kg: string; repeticiones: string }> = [
        { id: serieId, peso_kg: current.peso_kg, repeticiones: current.repeticiones },
      ]

      // Sin peso: solo guardar, sin auto-completar
      if (!current.peso_kg) {
        toSave = saves
        return prev
      }

      // Auto-completar series posteriores que estén vacías
      let changed = false
      const newSeries = ej.series.map((s, idx) => {
        if (idx <= currentIdx || s.peso_kg !== '') return s
        changed = true
        saves.push({ id: s.id, peso_kg: current.peso_kg, repeticiones: s.repeticiones })
        return { ...s, peso_kg: current.peso_kg }
      })

      toSave = saves
      if (!changed) return prev

      const newEjercicios = [...prev.ejercicios]
      newEjercicios[ejIdx] = { ...ej, series: newSeries }
      return { ...prev, ejercicios: newEjercicios }
    })

    // Guardar todo fuera del updater — seguro en Strict Mode
    const saves = toSave as Array<{ id: string; peso_kg: string; repeticiones: string }> | null
    if (saves) {
      for (const s of saves) {
        actualizarSerie(supabase, {
          id: s.id,
          sesionId,
          peso_kg: s.peso_kg ? parseFloat(s.peso_kg) : null,
          repeticiones: s.repeticiones ? parseInt(s.repeticiones) : null,
        })
      }
    }
  }, [supabase, sesionId])

  const handleToggleCompletada = (serieId: string, ejId: string) => {
    // Se decide con el estado actual, fuera del updater: si esta serie pasa a
    // completada y quedan otras por hacer, arranca el descanso solo.
    const todas = sesion?.ejercicios.flatMap((e) => e.series) ?? []
    const estaSerie = todas.find((s) => s.id === serieId)
    const pasaACompletada = !!estaSerie && !estaSerie.completada
    const quedanOtras = todas.some((s) => s.id !== serieId && !s.completada)
    if (pasaACompletada && quedanOtras) iniciarDescanso(descansoSegundos, true)

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

    // Auto-save inmediato — mismo patrón que handleBlur (sin setTimeout)
    const guardada = serieActualizada as { peso_kg: string; repeticiones: string; completada: boolean } | null
    if (guardada) {
      actualizarSerie(supabase, {
        id: serieId,
        sesionId,
        peso_kg: guardada.peso_kg ? parseFloat(guardada.peso_kg) : null,
        repeticiones: guardada.repeticiones ? parseInt(guardada.repeticiones) : null,
        completada: guardada.completada,
      })
    }
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
    router.push('/hoy')
  }

  const cerrarConfirmar = useCallback(() => setConfirmarAbierto(false), [])

  // Desde el panel: además de arrancar, recuerda la duración para los automáticos
  const handleTimerStart = (segundos: number) => {
    setDescansoSegundos(segundos)
    try {
      window.localStorage.setItem(CLAVE_DESCANSO, String(segundos))
    } catch {
      // Sin almacenamiento: vale solo para esta sesión
    }
    iniciarDescanso(segundos, false)
  }

  function iniciarDescanso(segundos: number, automatico: boolean) {
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
    trackEvent('temporizador_iniciado', { duracion_segundos: segundos, automatico })
  }

  const sumarDescanso = () => {
    setTiempoRestante((prev) => prev + 30)
    setTiempoTotal((prev) => prev + 30)
  }

  const handleTimerCancelar = () => {
    beepFiredRef.current = false
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
              onClick={() => router.push('/hoy')}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Volver a Hoy
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (sesion.finalizada_at) {
    router.replace('/hoy')
    return null
  }

  return (
    <AppLayout>

    <div className={`min-h-screen app-page-bg px-4 md:px-8 ${timerCorriendo ? 'pb-48' : 'pb-28'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Encabezado fijo: el progreso se ve siempre, aunque bajes por los ejercicios */}
        <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 pt-2 pb-3 mb-4 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200">
          <button
            type="button"
            onClick={() => router.push('/hoy')}
            className="min-h-11 text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <h1 className="text-3xl md:text-5xl font-display text-slate-900 tracking-widest uppercase leading-none mb-2">
            {sesion.dia_nombre}
          </h1>
          {(() => {
            const { seriesCompletadas, seriesTotales } = resumirSesion(sesion.ejercicios)
            const porcentaje = seriesTotales > 0 ? (seriesCompletadas / seriesTotales) * 100 : 0
            return (
              <div className="flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label="Series completadas"
                  aria-valuemin={0}
                  aria-valuemax={seriesTotales}
                  aria-valuenow={seriesCompletadas}
                  className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden"
                >
                  <div className="h-full bg-yellow-500 transition-[width] duration-300" style={{ width: `${porcentaje}%` }} />
                </div>
                <p className="text-sm font-semibold text-slate-600 tabular-nums flex-shrink-0">
                  {seriesCompletadas} de {seriesTotales} series
                </p>
              </div>
            )
          })()}
        </div>

        {/* Ejercicios: el actual abierto y destacado; los demás plegados en una línea */}
        <div className="flex flex-col gap-3">
          {sesion.ejercicios.map((ej, i) => {
            const esActual = i === indiceActual
            const abierto = esActual || abiertos.has(ej.rutina_ejercicio_id)
            const estado = estadoEjercicio(ej)
            const ultimaVez = formatearUltimaVez(ej.ultima_serie)

            if (!abierto) {
              return (
                <button
                  key={ej.rutina_ejercicio_id}
                  id={`ej-${ej.rutina_ejercicio_id}`}
                  type="button"
                  onClick={() => alternarAbierto(ej.rutina_ejercicio_id)}
                  aria-expanded={false}
                  className="scroll-mt-40 w-full min-h-14 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:border-slate-300 transition-colors"
                >
                  {estado === 'completo' ? (
                    <span className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full border-2 border-slate-300 flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="flex-1 min-w-0 font-semibold text-slate-900 break-words">
                    {ej.nombre}
                    <span className="sr-only">{estado === 'completo' ? ', completo' : estado === 'empezado' ? ', empezado' : ''}</span>
                  </span>
                  <span className="text-sm text-slate-600 tabular-nums flex-shrink-0">
                    {estado === 'pendiente' ? formatearPrescripcion(ej.series_rutina, ej.repeticiones_rutina) : seriesHechas(ej)}
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )
            }

            return (
              <section
                key={ej.rutina_ejercicio_id}
                id={`ej-${ej.rutina_ejercicio_id}`}
                aria-label={ej.nombre}
                className={`scroll-mt-40 bg-white rounded-2xl p-4 shadow-sm ${
                  esActual ? 'border-2 border-neutral-900' : 'border border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    {esActual && (
                      <p className="text-xs font-bold tracking-widest uppercase text-yellow-800 mb-0.5">
                        Ahora · {i + 1} de {sesion.ejercicios.length}
                      </p>
                    )}
                    <h2 className="text-lg font-bold text-slate-900 leading-snug break-words">{ej.nombre}</h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {ultimaVez ? `Última vez: ${ultimaVez}` : 'Primera vez con este ejercicio'}
                      {' · '}
                      {formatearPrescripcion(ej.series_rutina, ej.repeticiones_rutina)}
                    </p>
                  </div>
                  {!esActual && (
                    <button
                      type="button"
                      onClick={() => alternarAbierto(ej.rutina_ejercicio_id)}
                      aria-expanded={true}
                      aria-label={`Plegar ${ej.nombre}`}
                      className="w-11 h-11 -mr-2 -mt-1 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Headers de columnas */}
                <div className="flex items-center gap-2 px-3 mb-2">
                  <span className="text-xs font-semibold text-slate-500 w-5 text-center">#</span>
                  <span className="text-xs font-semibold text-slate-500 w-20 text-center">Kg</span>
                  <span className="text-xs font-semibold text-slate-500 w-16 text-center">Reps</span>
                  <span className="text-xs font-semibold text-slate-500 w-11 text-center">Obj.</span>
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
                      rangoObjetivo={rangoDeSerie(ej.repeticiones_rutina, serie.numero_serie)}
                      pesoActual={serie.peso_kg}
                      repsActual={serie.repeticiones}
                      completada={serie.completada}
                      onPesoChange={(id, val) => handlePesoChange(id, ej.rutina_ejercicio_id, val)}
                      onRepsChange={(id, val) => handleRepsChange(id, ej.rutina_ejercicio_id, val)}
                      onPesoBlur={(id) => handlePesoBlur(id, ej.rutina_ejercicio_id)}
                      onBlur={(id) => handleBlur(id, ej.rutina_ejercicio_id)}
                      onToggleCompletada={(id) => handleToggleCompletada(id, ej.rutina_ejercicio_id)}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {indiceActual === -1 && (
            <div className="bg-neutral-900 rounded-2xl p-5 text-center">
              <p className="text-3xl font-display text-yellow-500 tracking-wider leading-none">Todo hecho</p>
              <p className="text-neutral-200 mt-1">Completaste todas las series. Tocá Terminar para guardar el entrenamiento.</p>
            </div>
          )}
        </div>
      </div>

      {/* Barra inferior sticky. md:left: en escritorio no se mete debajo del panel lateral, contraído o no */}
      <div className="fixed bottom-0 left-0 md:left-[var(--ancho-lateral)] right-0 z-30 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-sm border-t border-slate-200">
        {timerCorriendo && (
          <div className="max-w-lg mx-auto mb-3">
            <BandaDescanso
              tiempoRestante={tiempoRestante}
              tiempoTotal={tiempoTotal}
              onSumar={sumarDescanso}
              onSaltar={handleTimerCancelar}
            />
          </div>
        )}
        <div className="max-w-lg mx-auto flex gap-3 items-center">

          {/* Tiempo de entrenamiento: abajo, donde se mira entre series, no tapando el título */}
          <div className="flex-shrink-0 min-w-[64px]" aria-live="off">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" aria-hidden="true" />
              Tiempo
            </p>
            <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">
              {formatearTiempo(tiempoTranscurrido)}
            </p>
          </div>

          {/* Botón temporizador */}
          <button
            type="button"
            onClick={() => setPanelOpen(prev => !prev)}
            className="w-12 h-12 flex-shrink-0 bg-neutral-900 text-white rounded-xl flex items-center justify-center hover:bg-neutral-800 transition-all duration-200"
            aria-label="Elegir duración del descanso"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
              <path d="M9 2h6" />
            </svg>
          </button>

          {/* Botón terminar: abre la confirmación, nunca finaliza directo */}
          <button
            type="button"
            onClick={() => setConfirmarAbierto(true)}
            disabled={finalizando}
            className="flex-1 min-w-0 h-12 border-2 border-neutral-900 text-neutral-900 bg-white rounded-xl font-bold text-base hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            Terminar
          </button>

        </div>
      </div>
    </div>
    <ConfirmarFinalizarPanel
      isOpen={confirmarAbierto}
      resumen={resumirSesion(sesion.ejercicios)}
      duracionSegundos={tiempoTranscurrido}
      finalizando={finalizando}
      onSeguir={cerrarConfirmar}
      onConfirmar={handleFinalizar}
    />
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
