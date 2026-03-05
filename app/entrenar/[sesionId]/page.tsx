'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

export default function SesionActivaPage() {
  const params = useParams()
  const sesionId = params.sesionId as string
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  const [sesion, setSesion] = useState<SesionActiva | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated) {
      router.replace('/')
      return
    }

    obtenerSesionActiva(supabase, sesionId, userId!).then(result => {
      if (result.success && result.data) {
        setSesion(result.data)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, sesionId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setSesion(prev => {
      if (!prev) return prev
      const ej = prev.ejercicios.find(e => e.rutina_ejercicio_id === ejId)
      const serie = ej?.series.find(s => s.id === serieId)
      if (serie) {
        // Fire-and-forget auto-save — fuera del loop de render para evitar doble ejecución en Strict Mode
        Promise.resolve().then(() => {
          actualizarSerie(supabase, {
            id: serieId,
            sesionId,
            peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
            repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
          })
        })
      }
      return prev
    })
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setFinalizando(true)
    const resultado = await finalizarSesion(supabase, sesionId, userId!)
    if (!resultado.success) {
      toast.error('No se pudo finalizar la sesión. Intentá de nuevo.')
      setFinalizando(false)
      return
    }
    router.push('/rutinas')
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
          <h1 className="pl-14 md:pl-0 text-4xl md:text-5xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
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
              <h3 className="font-bold text-slate-900 mb-3">{ej.nombre}</h3>

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

      {/* Botón finalizar sticky */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleFinalizar}
            disabled={finalizando}
            className="w-full h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10 flex items-center justify-center"
          >
            {finalizando ? 'Finalizando...' : 'Finalizar sesión'}
          </button>
        </div>
      </div>
    </div>
    </AppLayout>
  )
}
