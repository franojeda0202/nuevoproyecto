'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import OnboardingForm, { OnboardingData } from './components/OnboardingForm'
import LoginForm from './components/LoginForm'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [checkingRoutine, setCheckingRoutine] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  // Verificar si viene desde el modal de nueva rutina
  const isNewRoutine = searchParams.get('new') === 'true'

  useEffect(() => {
    checkAuth()
    
    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      // Leer el parámetro en el momento del evento
      const isNew = new URLSearchParams(window.location.search).get('new') === 'true'
      
      if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true)
        setLoading(false)
        // Si viene desde el modal de nueva rutina, no verificar rutinas
        if (!isNew) {
          // Verificar si tiene rutina y redirigir
          await redirectIfRoutineExists(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthenticated(false)
        setLoading(false)
        // El logout ya maneja la redirección en su función específica
      } else {
        setAuthenticated(!!session)
        setLoading(false)
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
        setLoading(false)
        return
      }
      
      console.log('Session check:', session?.user?.email || 'No session')
      const isLogged = !!session && !!session.user
      setAuthenticated(isLogged)
      
      if (isLogged && session?.user?.id) {
        // Si viene desde el modal de nueva rutina, no verificar rutinas existentes
        if (isNewRoutine) {
          console.log('Modo nueva rutina: saltando verificación de rutina existente')
          setLoading(false)
          return
        }
        
        // Verificar si tiene rutina y redirigir si existe
        const hasRoutine = await redirectIfRoutineExists(session.user.id)
        if (hasRoutine) {
          // Si tiene rutina, la redirección ya se hizo, no mostrar el formulario
          return
        }
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
      
      // Si viene desde el modal de nueva rutina, no verificar rutinas
      if (isNewRoutine) {
        console.log('Modo nueva rutina: saltando verificación después del login')
        router.refresh()
        return
      }
      
      // Verificar si tiene rutina y redirigir si existe
      const hasRoutine = await redirectIfRoutineExists(session.user.id)
      if (!hasRoutine) {
        // Si no hay rutina, refrescamos para mostrar el formulario
        router.refresh()
      }
    } else {
      console.error('No session found after login attempts')
      setAuthenticated(false)
      setLoading(false)
    }
  }

  const redirectIfRoutineExists = async (userId: string): Promise<boolean> => {
    setCheckingRoutine(true)
    try {
      const { data, error } = await supabase
        .from('rutinas')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error checking routine existence:', error)
        return false
      }

      if (data?.id) {
        console.log('Rutina encontrada, redirigiendo a /rutinas')
        router.push('/rutinas')
        return true
      }
      
      console.log('No se encontró rutina, mostrando formulario')
      return false
    } catch (err) {
      console.error('Unexpected error checking routine existence:', err)
      return false
    } finally {
      setCheckingRoutine(false)
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
      
      // 4. La rutina ya se guardó en Supabase por el backend de n8n
      // No necesitamos guardar en localStorage, todo está en la base de datos
      if (routineData) {
        console.log('✅ Rutina generada y guardada en Supabase por n8n')
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

  // Loading inicial o chequeando rutina
  if (loading || checkingRoutine) {
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