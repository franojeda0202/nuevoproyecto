'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerDetalleSesion } from '@/lib/services/sesion-service'
import { SesionDetalle } from '@/lib/types/database'
import AppLayout from '@/app/components/AppLayout'

function formatearFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DetalleSesionPage() {
  const params = useParams()
  const sesionId = params.sesionId as string
  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  const [sesion, setSesion] = useState<SesionDetalle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated) {
      router.replace('/')
      return
    }

    obtenerDetalleSesion(supabase, sesionId, userId!).then(result => {
      if (result.success && result.data) {
        setSesion(result.data)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, sesionId]) // eslint-disable-line react-hooks/exhaustive-deps

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
              onClick={() => router.push('/entrenamiento')}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Volver al Historial
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen app-page-bg p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => router.push('/entrenamiento')}
              className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors pl-14 md:pl-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Historial
            </button>
            <h1 className="text-4xl md:text-5xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
              {sesion.dia_nombre}
            </h1>
            <p className="text-slate-500 text-sm capitalize pl-14 md:pl-0">
              {formatearFechaLarga(sesion.finalizada_at)}
            </p>
            <div className="h-0.5 w-12 bg-yellow-500 rounded-full mt-2" />
          </div>

          {/* Ejercicios */}
          <div className="grid md:grid-cols-2 gap-5">
            {sesion.ejercicios.map((ej, ejIdx) => (
              <div
                key={ejIdx}
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
                  {ej.series.map(serie => (
                    <div
                      key={serie.numero_serie}
                      className={`flex items-center gap-2 py-2 px-3 rounded-xl ${
                        serie.completada ? 'bg-yellow-50' : 'bg-slate-50'
                      }`}
                    >
                      {/* Número de serie */}
                      <span className="text-sm font-semibold text-slate-400 w-5 text-center flex-shrink-0">
                        {serie.numero_serie}
                      </span>

                      {/* Peso */}
                      <span className="w-20 text-center text-sm font-medium text-slate-700">
                        {serie.peso_kg !== null ? `${serie.peso_kg} kg` : '—'}
                      </span>

                      {/* Reps */}
                      <span className="w-16 text-center text-sm font-medium text-slate-700">
                        {serie.repeticiones !== null ? serie.repeticiones : '—'}
                      </span>

                      {/* Ícono completada */}
                      <div
                        className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          serie.completada
                            ? 'bg-yellow-500 text-black'
                            : 'bg-white border-2 border-slate-200 text-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
