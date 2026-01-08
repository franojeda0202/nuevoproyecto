'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Ejercicio {
  id: string
  nombre: string
  series: number
  repeticiones: string
  orden: number
  notas_coach: string | null
}

interface RutinaDia {
  id: string
  nombre_dia: string
  orden: number
  ejercicios: Ejercicio[]
}

interface RutinaCompleta {
  rutina: {
    id: string
    nombre: string
    objetivo: string
    frecuencia: number
    created_at: string
  }
  dias: RutinaDia[]
}

export default function RutinasPage() {
  const [rutinaCompleta, setRutinaCompleta] = useState<RutinaCompleta | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadRutinaActiva()
  }, [])

  const loadRutinaActiva = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user)

      // 1. Obtener la última rutina del usuario
      const { data: rutina, error: rutinaError } = await supabase
        .from('rutinas')
        .select('id, nombre, objetivo, frecuencia, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (rutinaError) {
        if (rutinaError.code === 'PGRST116') {
          // No se encontró ninguna rutina
          setRutinaCompleta(null)
          setLoading(false)
          return
        }
        throw rutinaError
      }

      // 2. Obtener los días de la rutina
      const { data: dias, error: diasError } = await supabase
        .from('rutina_dias')
        .select('id, nombre_dia, orden')
        .eq('rutina_id', rutina.id)
        .order('orden', { ascending: true })

      if (diasError) {
        throw diasError
      }

      // 3. Para cada día, obtener sus ejercicios con join a la tabla ejercicios
      const diasConEjercicios: RutinaDia[] = await Promise.all(
        (dias || []).map(async (dia) => {
          // Primero obtener los ejercicios de rutina_ejercicios
          const { data: rutinaEjercicios, error: ejerciciosError } = await supabase
            .from('rutina_ejercicios')
            .select('id, ejercicio_id, series, repeticiones, orden, notas_coach')
            .eq('dia_id', dia.id)
            .order('orden', { ascending: true })

          if (ejerciciosError) {
            throw ejerciciosError
          }

          // Si no hay ejercicios, retornar el día vacío
          if (!rutinaEjercicios || rutinaEjercicios.length === 0) {
            return {
              id: dia.id,
              nombre_dia: dia.nombre_dia,
              orden: dia.orden,
              ejercicios: []
            }
          }

          // Obtener los nombres de los ejercicios
          const ejercicioIds = rutinaEjercicios.map(ej => ej.ejercicio_id)
          const { data: ejercicios, error: ejerciciosNombresError } = await supabase
            .from('ejercicios')
            .select('id, nombre')
            .in('id', ejercicioIds)

          if (ejerciciosNombresError) {
            throw ejerciciosNombresError
          }

          // Crear un mapa de ejercicio_id -> nombre para acceso rápido
          const ejerciciosMap = new Map(
            (ejercicios || []).map(ej => [ej.id, ej.nombre])
          )

          return {
            id: dia.id,
            nombre_dia: dia.nombre_dia,
            orden: dia.orden,
            ejercicios: rutinaEjercicios.map((ej) => ({
              id: ej.id,
              nombre: ejerciciosMap.get(ej.ejercicio_id) || 'Ejercicio sin nombre',
              series: ej.series,
              repeticiones: ej.repeticiones,
              orden: ej.orden,
              notas_coach: ej.notas_coach
            }))
          }
        })
      )

      setRutinaCompleta({
        rutina,
        dias: diasConEjercicios
      })
    } catch (error) {
      console.error('Error loading rutina activa:', error)
      setRutinaCompleta(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error al cerrar sesión:', error)
        alert('Error al cerrar sesión. Intenta nuevamente.')
        return
      }
      // Forzar recarga completa para limpiar el estado
      window.location.href = '/'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      alert('Error al cerrar sesión. Intenta nuevamente.')
    }
  }

  const handleGenerateNew = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmNewRoutine = () => {
    // Redirigir al formulario sin verificar rutinas
    router.push('/?new=true')
  }

  const handleCancelNewRoutine = () => {
    setShowConfirmModal(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          <p className="mt-4 text-gray-600 font-medium">Cargando rutina...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight mb-2">
              Mi Rutina Activa
            </h1>
            <p className="text-gray-600 font-medium">
              {user?.email}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGenerateNew}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Nueva Rutina
            </button>
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Rutina activa o estado vacío */}
        {!rutinaCompleta ? (
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center border border-gray-200">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Aún no tienes rutinas</h2>
            <p className="text-gray-600 mb-6">
              Genera tu primera rutina personalizada para comenzar tu entrenamiento
            </p>
            <button
              onClick={handleGenerateNew}
              className="px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Generar mi primera rutina 🚀
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Información de la rutina */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    {rutinaCompleta.rutina.nombre || 'Mi Rutina'}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>
                      <span className="font-semibold">Objetivo:</span>{' '}
                      <span className="capitalize">{rutinaCompleta.rutina.objetivo}</span>
                    </span>
                    <span>
                      <span className="font-semibold">Frecuencia:</span>{' '}
                      {rutinaCompleta.rutina.frecuencia} días/semana
                    </span>
                    <span>
                      <span className="font-semibold">Creada:</span>{' '}
                      {new Date(rutinaCompleta.rutina.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tablas por día */}
            <div className="p-6 space-y-8">
              {rutinaCompleta.dias.map((dia) => (
                <div key={dia.id} className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900 border-b-2 border-gray-200 pb-2">
                    {dia.nombre_dia}
                  </h3>
                  
                  {dia.ejercicios.length === 0 ? (
                    <p className="text-gray-500 italic">No hay ejercicios asignados para este día.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Ejercicio</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Series</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Repeticiones</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dia.ejercicios.map((ejercicio, index) => (
                            <tr
                              key={ejercicio.id}
                              className={`border-b border-gray-100 ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              } hover:bg-gray-100 transition-colors`}
                            >
                              <td className="py-3 px-4 font-medium text-gray-900">
                                {ejercicio.nombre}
                              </td>
                              <td className="py-3 px-4 text-center text-gray-700">
                                {ejercicio.series}
                              </td>
                              <td className="py-3 px-4 text-center text-gray-700">
                                {ejercicio.repeticiones}
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-sm">
                                {ejercicio.notas_coach || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de confirmación */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                ¿Generar nueva rutina?
              </h3>
              <p className="text-gray-600 mb-6">
                Al generar una nueva rutina, tu rutina actual será archivada. Esta acción no se puede deshacer.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                <strong>Versión Gratuita:</strong> Solo puedes tener 1 rutina activa a la vez.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelNewRoutine}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmNewRoutine}
                  className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

