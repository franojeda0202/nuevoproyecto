'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerHistorialSesiones } from '@/lib/services/sesion-service'
import { SesionResumen } from '@/lib/types/database'
import AppLayout from '@/app/components/AppLayout'

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function EntrenamientoPage() {
  const [sesiones, setSesiones] = useState<SesionResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated || !userId) {
      router.replace('/')
      return
    }

    obtenerHistorialSesiones(supabase, userId).then(result => {
      if (result.success && result.data) {
        setSesiones(result.data)
      } else if (!result.success) {
        setError(true)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, userId, retryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-slate-600 mb-4">No se pudo cargar el historial. Intentá de nuevo.</p>
            <button
              type="button"
              onClick={() => { setError(false); setLoading(true); setRetryKey(k => k + 1) }}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Reintentar
            </button>
          </div>
        </div>
      </AppLayout>
    )
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

  return (
    <AppLayout>
      <div className="min-h-screen app-page-bg p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
                Entrenamientos
              </h1>
              <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
            </div>
            {sesiones.length > 0 && (
              <button
                type="button"
                onClick={() => router.push('/entrenar')}
                className="flex-shrink-0 px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold text-base hover:bg-yellow-400 transition-all"
              >
                + Entrenar
              </button>
            )}
          </div>

          {/* Lista de sesiones */}
          {sesiones.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 mb-4">Todavía no registraste ningún entrenamiento.</p>
              <button
                type="button"
                onClick={() => router.push('/entrenar')}
                className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
              >
                + Entrenar
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sesiones.map(sesion => (
                <button
                  key={sesion.id}
                  type="button"
                  onClick={() => router.push(`/entrenamiento/${sesion.id}`)}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-yellow-400 hover:bg-yellow-50/30 transition-all duration-200 shadow-sm"
                >
                  <p className="font-bold text-slate-900">{sesion.dia_nombre}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {formatearFecha(sesion.finalizada_at)}
                    {sesion.series_completadas > 0 && (
                      <span className="ml-2 text-yellow-600 font-medium">
                        · {sesion.series_completadas} series ✓
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
