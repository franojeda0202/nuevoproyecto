'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerHistorialSesiones, eliminarSesion } from '@/lib/services/sesion-service'
import { SesionResumen } from '@/lib/types/database'
import AppLayout from '@/app/components/AppLayout'
import MetricasTab from '@/app/components/metricas/MetricasTab'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { agruparPorMes, duracionMinutos, partesDeFecha } from '@/lib/utils/historial'
import { formatearDuracion } from '@/lib/utils/resumen-sesion'

const formatoKg = new Intl.NumberFormat('es-AR')

/** "48 min · 10 de 12 series · 4.320 kg", sin las partes que no hay */
function detalleSesion(s: SesionResumen): string {
  const partes: string[] = []
  const min = duracionMinutos(s.iniciada_at, s.finalizada_at)
  if (min !== null) partes.push(formatearDuracion(min * 60))
  partes.push(`${s.series_completadas} de ${s.series_totales} series`)
  if (s.kg_movidos > 0) partes.push(`${formatoKg.format(s.kg_movidos)} kg`)
  return partes.join(' · ')
}

export default function EntrenamientoPage() {
  const [sesiones, setSesiones] = useState<SesionResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [tabActivo, setTabActivo] = useState<'historial' | 'metricas'>('historial')
  const ahora = useMemo(() => new Date(), [])

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
        <div className="max-w-2xl mx-auto">
          {/* Header. Sin "+ Entrenar": eso ya lo cubren la pestaña Hoy y la barra de entrenamiento en curso */}
          <div className="mb-6">
            <div className="mb-4">
              <h1 className="text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
                Entrenamientos
              </h1>
              <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
            </div>

            {/* Tabs: selector segmentado gris, para no confundirse con los botones de acción amarillos */}
            <div role="tablist" aria-label="Secciones" className="grid grid-cols-2 gap-1 p-1 bg-slate-200 rounded-xl">
              <button
                type="button"
                role="tab"
                aria-selected={tabActivo === 'historial'}
                onClick={() => setTabActivo('historial')}
                className={`h-11 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                  tabActivo === 'historial'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Historial
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tabActivo === 'metricas'}
                onClick={() => setTabActivo('metricas')}
                className={`h-11 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                  tabActivo === 'metricas'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Métricas
              </button>
            </div>
          </div>

          {/* Contenido por tab */}
          {tabActivo === 'metricas' ? (
            <MetricasTab userId={userId!} supabase={supabase} />
          ) : (
          sesiones.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 mb-4">Todavía no registraste ningún entrenamiento.</p>
              <button
                type="button"
                onClick={() => router.push('/hoy')}
                className="h-12 px-6 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
              >
                Empezar a entrenar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {agruparPorMes(sesiones, ahora).map((grupo) => (
                <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
                  <div className="flex items-baseline justify-between mb-2 px-1">
                    <h2 id={`mes-${grupo.clave}`} className="font-bold text-slate-900">{grupo.titulo}</h2>
                    <p className="text-sm text-slate-600">
                      {(() => {
                        const reales = grupo.items.filter((x) => x.series_completadas > 0).length
                        // Un mes con solo sesiones vacías no muestra "0 entrenamientos"
                        if (reales === 0) return null
                        return `${reales} ${reales === 1 ? 'entrenamiento' : 'entrenamientos'}`
                      })()}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {grupo.items.map((sesion) => {
                      const fecha = partesDeFecha(sesion.finalizada_at)
                      const vacia = sesion.series_completadas === 0

                      if (confirmandoId === sesion.id) {
                        return (
                          <li key={sesion.id} className="p-4 bg-white border border-red-200 rounded-2xl shadow-sm">
                            <p className="font-semibold text-slate-900">{sesion.nombre_dia || 'Entrenamiento'}</p>
                            <p className="text-slate-600 text-sm mb-3">¿Eliminar este entrenamiento? No se puede deshacer.</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmandoId(null)}
                                disabled={eliminando === sesion.id}
                                className="flex-1 h-11 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEliminar(sesion.id)}
                                disabled={eliminando === sesion.id}
                                className="flex-1 h-11 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {eliminando === sesion.id ? 'Eliminando...' : 'Eliminar'}
                              </button>
                            </div>
                          </li>
                        )
                      }

                      return (
                        <li
                          key={sesion.id}
                          className={`relative rounded-2xl transition-colors ${
                            vacia
                              ? 'bg-slate-50 border border-dashed border-slate-300'
                              : 'bg-white border border-slate-200 shadow-sm hover:border-yellow-400'
                          }`}
                        >
                          <Link href={`/entrenamiento/${sesion.id}`} className="flex items-center gap-4 p-4 pr-14">
                            <span className={`w-12 flex-shrink-0 text-center ${vacia ? 'text-slate-500' : 'text-slate-900'}`}>
                              <span className="block text-2xl font-bold leading-none tabular-nums">{fecha.numero}</span>
                              <span className="block text-xs font-semibold uppercase tracking-wide mt-1 text-slate-600">{fecha.dia}</span>
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block font-bold break-words ${vacia ? 'text-slate-600' : 'text-slate-900'}`}>
                                {sesion.nombre_dia || 'Entrenamiento'}
                                {sesion.dia_orden !== null && (
                                  <span className="font-medium text-slate-500"> · Día {sesion.dia_orden}</span>
                                )}
                              </span>
                              <span className="block text-sm text-slate-600 mt-0.5">
                                {vacia ? 'Sin series registradas' : detalleSesion(sesion)}
                              </span>
                            </span>
                          </Link>

                          {/* Opciones */}
                          <div className="absolute top-1/2 -translate-y-1/2 right-1.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmandoId(null); setMenuAbierto(menuAbierto === sesion.id ? null : sesion.id) }}
                              className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors text-lg leading-none"
                              aria-label={`Opciones de ${sesion.nombre_dia || 'este entrenamiento'}`}
                              aria-haspopup="menu"
                              aria-expanded={menuAbierto === sesion.id}
                            >
                              ···
                            </button>
                            {menuAbierto === sesion.id && (
                              <div role="menu" className="absolute right-0 top-12 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[150px]">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => { setConfirmandoId(sesion.id); setMenuAbierto(null) }}
                                  className="w-full h-11 px-4 text-sm font-medium text-red-700 hover:bg-red-50 text-left transition-colors"
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )
          )}
        </div>
      </div>
    </AppLayout>
  )
}
