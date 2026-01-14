'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface UseCheckRoutineOptions {
  skipCheck?: boolean
  redirectOnFound?: boolean
}

interface UseCheckRoutineReturn {
  checking: boolean
  hasRoutine: boolean | null
  routineId: string | null
}

export function useCheckRoutine(
  userId: string | null,
  options: UseCheckRoutineOptions = {}
): UseCheckRoutineReturn {
  const { skipCheck = false, redirectOnFound = false } = options
  const [checking, setChecking] = useState(false)
  const [hasRoutine, setHasRoutine] = useState<boolean | null>(null)
  const [routineId, setRoutineId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // No verificar si no hay userId, si se debe saltar, o si ya verificamos
    if (!userId || skipCheck || hasRoutine !== null) return

    const checkRoutine = async () => {
      setChecking(true)
      console.log('🔍 useCheckRoutine: Verificando si existe rutina...')
      
      try {
        const { data, error } = await supabase
          .from('rutinas')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('❌ useCheckRoutine: Error verificando rutina:', error)
          setHasRoutine(false)
          return
        }

        if (data?.id) {
          console.log('✅ useCheckRoutine: Rutina encontrada')
          setHasRoutine(true)
          setRoutineId(data.id)
          
          if (redirectOnFound) {
            console.log('🔄 useCheckRoutine: Redirigiendo a /rutinas...')
            router.push('/rutinas')
          }
        } else {
          console.log('📝 useCheckRoutine: No hay rutina')
          setHasRoutine(false)
        }
      } catch (err) {
        console.error('❌ useCheckRoutine: Error inesperado:', err)
        setHasRoutine(false)
      } finally {
        setChecking(false)
      }
    }

    checkRoutine()
  }, [userId, skipCheck, hasRoutine, redirectOnFound, router, supabase])

  return {
    checking,
    hasRoutine,
    routineId
  }
}
