'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface UseAuthReturn {
  loading: boolean
  authenticated: boolean
  user: User | null
  userId: string | null
  logout: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuthenticated(true)
        setUser(session.user)
      } else {
        setAuthenticated(false)
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error al cerrar sesión:', error)
        toast.error('Error al cerrar sesión. Intenta nuevamente.')
        return
      }
      toast.success('Sesión cerrada correctamente')
      setAuthenticated(false)
      setUser(null)
      // Forzar recarga completa para limpiar el estado
      window.location.href = '/'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      toast.error('Error al cerrar sesión. Intenta nuevamente.')
    }
  }, [supabase])

  return {
    loading,
    authenticated,
    user,
    userId: user?.id || null,
    logout
  }
}
