'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import OnboardingForm, { OnboardingData } from './components/OnboardingForm'
import LoginForm from './components/LoginForm'
import { createClient } from '@/lib/supabase/client'
import { useAuth, useCheckRoutine } from '@/lib/hooks'
import { HomeSkeleton, GenerandoRutinaSkeleton } from './components/Skeleton'
import { trackEvent, trackError } from '@/lib/analytics'

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

      // 2. Llamar a la API de generación de rutinas
      const requestBody = {
        user_id: userId,
        config: {
          frecuencia: data.daysPerWeek,
          enfoque: data.muscleFocus || 'full_body',
          genero: data.gender,
          ubicacion: data.location
        }
      }

      let response
      try {
        response = await fetch('/api/generar-rutina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      } catch (fetchError: any) {
        // Error de conexión (Failed to fetch)
        if (fetchError.message === 'Failed to fetch' || fetchError.name === 'TypeError') {
          throw new Error('No se pudo conectar con el servidor. Por favor, intenta de nuevo en unos minutos.')
        }
        throw fetchError
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(errorData.error || `Error del servidor (${response.status})`)
      }

      // 3. Obtener la rutina generada de la respuesta
      let routineData
      try {
        routineData = await response.json()
      } catch (jsonError) {
        throw new Error('El servidor respondió pero con un formato inválido.')
      }

      // 4. La rutina ya está guardada en Supabase, redirigir directamente
      if (routineData) {
        trackEvent('rutina_generada', {
          dias: data.daysPerWeek,
          objetivo: data.muscleFocus || 'full_body',
          genero: data.gender,
          ubicacion: data.location,
        })
        toast.success('¡Rutina generada exitosamente!')
        router.push('/rutinas')
      }
    } catch (error) {
      console.error('Error al generar rutina:', error)
      let errorMessage = 'No se pudo generar la rutina. Intenta de nuevo en unos minutos.'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      trackError('generacion_rutina', errorMessage)
      toast.error(errorMessage, { duration: 6000 })
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

  // Mostrar loading al generar rutina
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
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-200 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
      <OnboardingForm onSubmit={handleFormSubmit} />
    </div>
  )
}