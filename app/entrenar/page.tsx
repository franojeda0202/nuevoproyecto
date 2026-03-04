'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerRutinaEditable } from '@/lib/services/rutina-service'
import { crearSesion, obtenerSesionEnProgreso } from '@/lib/services/sesion-service'
import { DiaConEjerciciosEditables } from '@/lib/types/database'
import toast from 'react-hot-toast'

export default function EntrenarPage() {
  const [dias, setDias] = useState<DiaConEjerciciosEditables[]>([])
  const [rutinaId, setRutinaId] = useState<string | null>(null)
  const [sesionEnProgreso, setSesionEnProgreso] = useState<{
    sesionId: string
    diaNombre: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated || !userId) {
      router.replace('/')
      return
    }

    const cargarDatos = async () => {
      const [rutinaResult, sesionResult] = await Promise.all([
        obtenerRutinaEditable(supabase, userId),
        obtenerSesionEnProgreso(supabase, userId),
      ])

      if (rutinaResult.success && rutinaResult.data) {
        setRutinaId(rutinaResult.data.rutina.id)
        setDias(rutinaResult.data.dias)
      }

      if (sesionResult.success && sesionResult.data) {
        setSesionEnProgreso(sesionResult.data)
      }

      setLoading(false)
    }

    cargarDatos()
  }, [loadingAuth, authenticated, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeleccionarDia = async (diaId: string) => {
    if (!userId || !rutinaId) return
    setCreando(diaId)

    const resultado = await crearSesion(supabase, { userId, rutinaId, diaId })
    if (resultado.success && resultado.data) {
      router.push(`/entrenar/${resultado.data.sesionId}`)
    } else {
      toast.error('No se pudo iniciar la sesión. Intentá de nuevo.')
    }

    setCreando(null)
  }

  if (loadingAuth || loading) {
    return (
      <div className="min-h-screen app-page-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen app-page-bg p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
            Entrenar
          </h1>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
        </div>

        {/* Banner sesión en progreso */}
        {sesionEnProgreso && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900 text-sm">Sesión en progreso</p>
              <p className="text-slate-600 text-sm">{sesionEnProgreso.diaNombre}</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/entrenar/${sesionEnProgreso.sesionId}`)}
              className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-semibold text-sm hover:bg-yellow-400 transition-all flex-shrink-0"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Selección de día */}
        {dias.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">No tenés una rutina activa.</p>
            <button
              type="button"
              onClick={() => router.push('/rutinas')}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Ir a Mi Rutina
            </button>
          </div>
        ) : (
          <>
            <p className="text-slate-600 font-medium mb-4">¿Qué día entrenás hoy?</p>
            <div className="space-y-3">
              {dias.map((dia) => (
                <button
                  key={dia.id}
                  type="button"
                  onClick={() => handleSeleccionarDia(dia.id)}
                  disabled={!!creando}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-yellow-400 hover:bg-yellow-50/50 transition-all duration-200 disabled:opacity-50 shadow-sm"
                >
                  <p className="font-semibold text-slate-900">{dia.nombre_dia}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {dia.ejercicios.length} ejercicio{dia.ejercicios.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => router.push('/rutinas')}
          className="mt-8 w-full py-3 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
        >
          ← Volver a Mi Rutina
        </button>
      </div>
    </div>
  )
}
