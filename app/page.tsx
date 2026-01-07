'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import OnboardingForm, { OnboardingData } from './components/OnboardingForm'
import LoginForm from './components/LoginForm'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    
    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      setAuthenticated(!!session)
      setLoading(false)
      
      // Si hay un login exitoso, refrescar la sesión
      if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true)
      }
      
      // Si hay un logout, actualizar el estado
      if (event === 'SIGNED_OUT') {
        setAuthenticated(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        setAuthenticated(false)
      } else {
        console.log('Session check:', session?.user?.email || 'No session')
        setAuthenticated(!!session && !!session.user)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSuccess = async () => {
    // Esperar un momento para que la sesión se establezca
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Verificar la sesión después del login
    let session = null
    let attempts = 0
    const maxAttempts = 5
    
    while (!session && attempts < maxAttempts) {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session after login:', error)
      }
      
      if (currentSession && currentSession.user) {
        session = currentSession
        break
      }
      
      attempts++
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    if (session) {
      console.log('Login successful, session found:', session.user.email)
      setAuthenticated(true)
      setLoading(false)
      // Forzar actualización del componente
      router.refresh()
    } else {
      console.error('No session found after login attempts')
      setAuthenticated(false)
      setLoading(false)
    }
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
            alert('Error al verificar tu sesión. Por favor, inicia sesión nuevamente.')
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
        alert('Debes estar logueado para generar una rutina. Por favor, inicia sesión.')
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
      
      // 4. Guardar la rutina en localStorage o estado para mostrarla
      if (routineData) {
        console.log('💾 Guardando rutina en localStorage...')
        // Guardar en localStorage para que esté disponible en la página de rutinas
        const routines = JSON.parse(localStorage.getItem('user_routines') || '[]')
        const newRoutine = {
          id: `routine_${Date.now()}`,
          created_at: new Date().toISOString(),
          config: {
            frecuencia: data.daysPerWeek,
            enfoque: data.muscleFocus || 'full_body',
            genero: data.gender,
            ubicacion: data.location
          },
          rutina: routineData
        }
        routines.push(newRoutine)
        localStorage.setItem('user_routines', JSON.stringify(routines))
        console.log('✅ Rutina guardada exitosamente')
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
      
      alert(`Hubo un error al procesar tu solicitud:\n\n${errorMessage}`)
      setSubmitting(false)
    }
  }

  // Loading inicial
  if (loading) {
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
        alert('Error al cerrar sesión. Intenta nuevamente.')
        return
      }
      setAuthenticated(false)
      // Forzar recarga completa para limpiar el estado
      window.location.href = '/'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      alert('Error al cerrar sesión. Intenta nuevamente.')
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