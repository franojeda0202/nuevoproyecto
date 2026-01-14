'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import OnboardingForm, { OnboardingData } from './components/OnboardingForm'
import LoginForm from './components/LoginForm'
import { createClient } from '@/lib/supabase/client'

// Helper para obtener el parámetro 'new' de la URL
const getIsNewRoutine = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('new') === 'true'
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [routineChecked, setRoutineChecked] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Efecto 1: Escuchar estado de autenticación
  useEffect(() => {
    console.log('🚀 Iniciando listener de autenticación')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('👤 Auth state:', event, session?.user?.email || 'sin sesión')
      
      if (session?.user) {
        setAuthenticated(true)
        setUserId(session.user.id)
      } else {
        setAuthenticated(false)
        setUserId(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Efecto 2: Verificar rutinas cuando el usuario está autenticado
  useEffect(() => {
    // No verificar si está cargando, no autenticado, o ya verificamos
    if (loading || !authenticated || !userId || routineChecked) return
    
    // Si viene del modal de nueva rutina, no verificar
    if (getIsNewRoutine()) {
      console.log('🆕 Modo nueva rutina: saltando verificación')
      setRoutineChecked(true)
      return
    }

    const checkRoutine = async () => {
      console.log('🔍 Verificando si existe rutina...')
      try {
        const { data, error } = await supabase
          .from('rutinas')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('❌ Error verificando rutina:', error)
          setRoutineChecked(true)
          return
        }

        if (data?.id) {
          console.log('✅ Rutina encontrada, redirigiendo...')
          router.push('/rutinas')
        } else {
          console.log('📝 No hay rutina, mostrando formulario')
          setRoutineChecked(true)
        }
      } catch (err) {
        console.error('❌ Error inesperado:', err)
        setRoutineChecked(true)
      }
    }

    checkRoutine()
  }, [loading, authenticated, userId, routineChecked, router, supabase])

  // Handler para login exitoso
  const handleLoginSuccess = () => {
    console.log('✅ Login exitoso, el listener actualizará el estado')
    // El onAuthStateChange se encargará de actualizar el estado
  }

  const handleFormSubmit = async (data: OnboardingData) => {
    setSubmitting(true)
    
    try {
      // 1. Verificar autenticación antes de continuar - intentar múltiples veces si es necesario
      let session = null
      let attempts = 0
      const maxAttempts = 3
      
      while (!session && attempts < maxAttempts) {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error(`Error al obtener sesión (intento ${attempts + 1}):`, sessionError)
          if (attempts === maxAttempts - 1) {
            toast.error('Error al verificar tu sesión. Por favor, inicia sesión nuevamente.')
            setSubmitting(false)
            setAuthenticated(false)
            router.push('/')
            return
          }
          attempts++
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        
        if (currentSession && currentSession.user) {
          session = currentSession
          break
        }
        
        attempts++
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      if (!session || !session.user) {
        console.error('No se pudo obtener sesión después de', maxAttempts, 'intentos')
        toast.error('Debes estar logueado para generar una rutina. Por favor, inicia sesión.')
        setSubmitting(false)
        setAuthenticated(false)
        // Forzar recarga para mostrar el login
        window.location.href = '/'
        return
      }

      const userId = session.user.id

      // 2. Llamada a n8n a través de nuestra API route (evita problemas de CORS)
      const requestBody = {
        user_id: userId,
        config: {
          frecuencia: data.daysPerWeek,
          enfoque: data.muscleFocus || 'full_body',
          genero: data.gender,
          ubicacion: data.location
        }
      }

      console.log('🚀 Iniciando llamada a n8n a través de API route...')
      console.log('📦 Body:', JSON.stringify(requestBody, null, 2))
      console.log('👤 User ID:', userId)

      let response
      try {
        const startTime = Date.now()
        // Usar nuestra API route en lugar de llamar directamente a n8n
        response = await fetch('/api/generar-rutina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        const endTime = Date.now()
        console.log(`⏱️ Tiempo de respuesta: ${endTime - startTime}ms`)
        console.log('📥 Status:', response.status, response.statusText)
      } catch (fetchError: any) {
        // Error de conexión (Failed to fetch)
        if (fetchError.message === 'Failed to fetch' || fetchError.name === 'TypeError') {
          throw new Error('No se pudo conectar con el servidor. Por favor, verifica que el flujo de n8n esté activo y que la URL del webhook sea correcta.')
        }
        throw fetchError
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
        console.error('❌ Error del servidor:', response.status, errorData)
        throw new Error(errorData.error || `Error del servidor (${response.status}): El flujo de n8n podría no estar activo`)
      }

      // 3. Obtener la rutina generada de la respuesta
      let routineData
      try {
        routineData = await response.json()
        console.log('✅ Rutina recibida:', routineData)
      } catch (jsonError) {
        console.error('❌ Error parseando JSON:', jsonError)
        throw new Error('El servidor respondió pero con un formato inválido. Verifica la configuración del webhook de n8n.')
      }
      
      // 4. La rutina ya se guardó en Supabase por el backend de n8n
      // No necesitamos guardar en localStorage, todo está en la base de datos
      if (routineData) {
        console.log('✅ Rutina generada y guardada en Supabase por n8n')
        toast.success('¡Rutina generada exitosamente!')
      } else {
        console.warn('⚠️ No se recibió data de rutina')
      }

      // 5. Redirigir a rutinas para ver la rutina generada
      console.log('🔄 Redirigiendo a /rutinas...')
      router.push('/rutinas')
    } catch (error) {
      console.error('Error al generar rutina:', error)
      
      let errorMessage = 'Error desconocido'
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Mensajes más específicos según el tipo de error
        if (error.message.includes('Failed to fetch') || error.message.includes('No se pudo conectar')) {
          errorMessage = 'No se pudo conectar con el servidor de n8n. Por favor, verifica que:\n\n' +
            '• El flujo de n8n esté activo\n' +
            '• La URL del webhook sea correcta\n' +
            '• No haya problemas de red o CORS'
        } else if (error.message.includes('flujo de n8n')) {
          errorMessage = 'El flujo de n8n no está respondiendo correctamente. Verifica que esté activo y configurado.'
        }
      }
      
      toast.error(errorMessage, {
        duration: 6000,
      })
      setSubmitting(false)
    }
  }

  // Loading inicial o verificando rutina
  if (loading || (authenticated && !routineChecked && !getIsNewRoutine())) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  // Mostrar login si no está autenticado
  if (!authenticated) {
    return <LoginForm onSuccess={handleLoginSuccess} />
  }

  // Mostrar loading al generar rutina (esperando respuesta de n8n)
  if (submitting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          <p className="mt-4 text-gray-600 font-medium">Generando tu rutina personalizada...</p>
          <p className="mt-2 text-sm text-gray-500">Esto puede tardar unos momentos</p>
        </div>
      </div>
    )
  }

  // Función para logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error al cerrar sesión:', error)
        toast.error('Error al cerrar sesión. Intenta nuevamente.')
        return
      }
      toast.success('Sesión cerrada correctamente')
      setAuthenticated(false)
      // Forzar recarga completa para limpiar el estado
      window.location.href = '/'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      toast.error('Error al cerrar sesión. Intenta nuevamente.')
    }
  }

  // Mostrar formulario de onboarding con botón de logout
  return (
    <div className="relative">
      {/* Botón de logout en esquina superior derecha */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all shadow-md hover:shadow-lg text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
      <OnboardingForm onSubmit={handleFormSubmit} />
    </div>
  )
}