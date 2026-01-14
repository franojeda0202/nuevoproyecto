'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import OnboardingForm, { OnboardingData } from './components/OnboardingForm'
import LoginForm from './components/LoginForm'
import { createClient } from '@/lib/supabase/client'
import { useAuth, useCheckRoutine } from '@/lib/hooks'
import { HomeSkeleton, GenerandoRutinaSkeleton } from './components/Skeleton'

// Helper para obtener el parámetro 'new' de la URL
const getIsNewRoutine = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('new') === 'true'
}

export default function Home() {
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  
  // Custom hooks para autenticación y verificación de rutinas
  const { loading, authenticated, userId, logout } = useAuth()
  const { checking: checkingRoutine } = useCheckRoutine(userId, {
    skipCheck: getIsNewRoutine(),
    redirectOnFound: true
  })

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
            window.location.href = '/'
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
      // Pero n8n puede tardar unos segundos más en crear los ejercicios
      if (routineData) {
        console.log('✅ Rutina recibida, esperando que n8n complete los ejercicios...')
        
        // Polling: verificar que la rutina tenga ejercicios antes de redirigir
        const maxAttempts = 10 // máximo 10 intentos
        const delayBetweenAttempts = 2000 // 2 segundos entre intentos
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`🔍 Verificando ejercicios (intento ${attempt}/${maxAttempts})...`)
          
          // Esperar antes de verificar
          await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts))
          
          // Verificar si la rutina ya tiene ejercicios
          const { data: rutinaConEjercicios, error } = await supabase
            .from('rutinas')
            .select(`
              id,
              rutina_dias (
                rutina_ejercicios (id)
              )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (error) {
            console.error('❌ Error verificando ejercicios:', error)
            continue
          }
          
          // Contar ejercicios
          const totalEjercicios = rutinaConEjercicios?.rutina_dias?.reduce(
            (acc: number, dia: { rutina_ejercicios: { id: string }[] }) => 
              acc + (dia.rutina_ejercicios?.length || 0), 
            0
          ) || 0
          
          if (totalEjercicios > 0) {
            console.log(`✅ Rutina completa con ${totalEjercicios} ejercicios`)
            toast.success('¡Rutina generada exitosamente!')
            router.push('/rutinas')
            return
          }
          
          console.log(`⏳ Aún no hay ejercicios, esperando...`)
        }
        
        // Si después de todos los intentos no hay ejercicios, redirigir igual
        console.warn('⚠️ Timeout esperando ejercicios, redirigiendo de todas formas')
        toast.success('¡Rutina generada! Los ejercicios pueden tardar unos segundos más en aparecer.')
        router.push('/rutinas')
      } else {
        console.warn('⚠️ No se recibió data de rutina')
        router.push('/rutinas')
      }
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
  if (loading || checkingRoutine) {
    return <HomeSkeleton />
  }

  // Mostrar login si no está autenticado
  if (!authenticated) {
    return <LoginForm onSuccess={handleLoginSuccess} />
  }

  // Mostrar loading al generar rutina (esperando respuesta de n8n)
  if (submitting) {
    return <GenerandoRutinaSkeleton />
  }

  // Mostrar formulario de onboarding con botón de logout
  return (
    <div className="relative">
      {/* Botón de logout en esquina superior derecha */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={logout}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all shadow-md hover:shadow-lg text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
      <OnboardingForm onSubmit={handleFormSubmit} />
    </div>
  )
}