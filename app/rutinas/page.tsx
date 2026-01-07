'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Routine {
  id: string
  created_at: string
  config: {
    frecuencia: number
    enfoque: string
    genero: string
    ubicacion: string
  }
  rutina?: any
}

export default function RutinasPage() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadRoutines()
  }, [])

  const loadRoutines = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user)

      // Cargar rutinas desde localStorage (temporal hasta que tengas backend)
      const storedRoutines = localStorage.getItem('user_routines')
      if (storedRoutines) {
        try {
          const routines = JSON.parse(storedRoutines)
          // Filtrar rutinas del usuario actual si es necesario
          setRoutines(routines)
        } catch (e) {
          console.error('Error parsing stored routines:', e)
          setRoutines([])
        }
      } else {
        setRoutines([])
      }

      // TODO: Aquí deberías hacer una llamada a tu API o base de datos para obtener las rutinas del usuario
      // const response = await fetch(`https://frano00.app.n8n.cloud/webhook-test/obtener-rutinas?user_id=${session.user.id}`)
      // const data = await response.json()
      // setRoutines(data.rutinas || [])
    } catch (error) {
      console.error('Error loading routines:', error)
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
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          <p className="mt-4 text-gray-600 font-medium">Cargando rutinas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight mb-2">
              Mis Rutinas
            </h1>
            <p className="text-gray-600 font-medium">
              {user?.email}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateNew}
              className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
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

        {/* Lista de rutinas */}
        {routines.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 hover:shadow-2xl transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Rutina {new Date(routine.created_at).toLocaleDateString('es-ES')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {routine.config.frecuencia} días/semana
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-semibold mr-2">Enfoque:</span>
                    <span className="capitalize">{routine.config.enfoque}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-semibold mr-2">Ubicación:</span>
                    <span className="capitalize">
                      {routine.config.ubicacion === 'gym' ? 'Gimnasio' : 'En casa'}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-semibold mr-2">Género:</span>
                    <span className="capitalize">
                      {routine.config.genero === 'male' ? 'Masculino' : 
                       routine.config.genero === 'female' ? 'Femenino' : 'Otro'}
                    </span>
                  </div>
                </div>

                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all">
                  Ver Rutina
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

