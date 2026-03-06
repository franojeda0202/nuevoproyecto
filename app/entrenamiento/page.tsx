'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerHistorialSesiones, eliminarSesion } from '@/lib/services/sesion-service'
import { SesionResumen } from '@/lib/types/database'
import AppLayout from '@/app/components/AppLayout'
import toast from 'react-hot-toast'

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
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
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

  useEffect(() => {
    if (!menuAbierto) return
    const handleClick = () => setMenuAbierto(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [menuAbierto])

  const handleEliminar = async (sesionId: string) => {
    if (!userId) return
    setEliminando(sesionId)
    const resultado = await eliminarSesion(supabase, sesionId, userId)
    if (resultado.success) {
      setSesiones(prev => prev.filter(s => s.id !== sesionId))
    } else {
      toast.error('No se pudo eliminar el entrenamiento. Intentá de nuevo.')
    }
    setEliminando(null)
    setConfirmandoId(null)
  }

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
              <h1 className="text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
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
                <div key={sesion.id}>
                  {confirmandoId === sesion.id ? (
                    /* Estado de confirmación */
                    <div className="w-full p-4 bg-white border border-red-200 rounded-xl shadow-sm">
                      <p className="font-semibold text-slate-900 text-sm mb-1">{sesion.dia_nombre}</p>
                      <p className="text-slate-500 text-sm mb-3">¿Eliminar este entrenamiento?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(null)}
                          disabled={eliminando === sesion.id}
                          className="flex-1 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(sesion.id)}
                          disabled={eliminando === sesion.id}
                          className="flex-1 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {eliminando === sesion.id ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Estado normal */
                    <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm hover:border-yellow-400 hover:bg-yellow-50/30 transition-all duration-200">
                      <button
                        type="button"
                        onClick={() => router.push(`/entrenamiento/${sesion.id}`)}
                        className="w-full p-4 text-left"
                      >
                        <p className="font-bold text-slate-900 pr-8">{sesion.dia_nombre}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {formatearFecha(sesion.finalizada_at)}
                          {sesion.series_completadas > 0 && (
                            <span className="ml-2 text-yellow-600 font-medium">
                              · {sesion.series_completadas} series ✓
                            </span>
                          )}
                        </p>
                      </button>

                      {/* Botón tres puntos */}
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmandoId(null); setMenuAbierto(menuAbierto === sesion.id ? null : sesion.id) }}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-lg leading-none"
                          aria-label="Opciones"
                        >
                          ···
                        </button>

                        {/* Dropdown */}
                        {menuAbierto === sesion.id && (
                          <div
                            className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[130px]"
                          >
                            <button
                              type="button"
                              onClick={() => { setConfirmandoId(sesion.id); setMenuAbierto(null) }}
                              className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
