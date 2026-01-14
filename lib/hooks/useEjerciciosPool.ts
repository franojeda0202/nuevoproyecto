'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ejercicio, FiltroEjercicios } from '@/lib/types/database'

interface UseEjerciciosPoolReturn {
  ejercicios: Ejercicio[]
  loading: boolean
  error: string | null
  
  // Funciones de filtrado
  filtrarPorContexto: (segmento: string, patronMovimiento: string, excluirId?: string) => Ejercicio[]
  filtrarPorBusqueda: (filtros: FiltroEjercicios) => Ejercicio[]
  
  // Obtener un ejercicio específico
  obtenerEjercicio: (id: string) => Ejercicio | undefined
  
  // Recargar catálogo (por si se agregan ejercicios)
  recargar: () => Promise<void>
}

/**
 * Hook para cachear el catálogo de ejercicios
 * Carga todos los ejercicios una vez y permite filtrarlos en cliente
 */
export function useEjerciciosPool(): UseEjerciciosPoolReturn {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Cargar catálogo completo
  const cargarEjercicios = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: queryError } = await supabase
        .from('ejercicios')
        .select('*')
        .order('nombre', { ascending: true })

      if (queryError) {
        throw queryError
      }

      setEjercicios(data || [])
      console.log(`✅ Catálogo cargado: ${data?.length || 0} ejercicios`)
    } catch (err) {
      console.error('❌ Error cargando catálogo:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar ejercicios')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Cargar al montar
  useEffect(() => {
    cargarEjercicios()
  }, [cargarEjercicios])

  // Filtrar por contexto (segmento + patrón de movimiento)
  // Usado para mostrar alternativas válidas al editar
  const filtrarPorContexto = useCallback((
    segmento: string,
    patronMovimiento: string,
    excluirId?: string
  ): Ejercicio[] => {
    return ejercicios.filter(e => 
      e.segmento === segmento &&
      e.patron_movimiento === patronMovimiento &&
      e.id !== excluirId
    )
  }, [ejercicios])

  // Filtrar con múltiples criterios (para búsqueda avanzada)
  const filtrarPorBusqueda = useCallback((filtros: FiltroEjercicios): Ejercicio[] => {
    return ejercicios.filter(e => {
      // Filtro por segmento
      if (filtros.segmento && e.segmento !== filtros.segmento) {
        return false
      }
      
      // Filtro por patrón de movimiento
      if (filtros.patron_movimiento && e.patron_movimiento !== filtros.patron_movimiento) {
        return false
      }
      
      // Filtro por grupo muscular
      if (filtros.grupo_muscular && e.grupo_muscular !== filtros.grupo_muscular) {
        return false
      }
      
      // Filtro por búsqueda de texto (nombre)
      if (filtros.busqueda) {
        const busquedaLower = filtros.busqueda.toLowerCase()
        if (!e.nombre.toLowerCase().includes(busquedaLower)) {
          return false
        }
      }
      
      return true
    })
  }, [ejercicios])

  // Obtener ejercicio por ID
  const obtenerEjercicio = useCallback((id: string): Ejercicio | undefined => {
    return ejercicios.find(e => e.id === id)
  }, [ejercicios])

  // Valores únicos para filtros (útil para dropdowns)
  const valoresUnicos = useMemo(() => ({
    segmentos: [...new Set(ejercicios.map(e => e.segmento))].sort(),
    patrones: [...new Set(ejercicios.map(e => e.patron_movimiento))].sort(),
    gruposMusculares: [...new Set(ejercicios.map(e => e.grupo_muscular))].sort(),
  }), [ejercicios])

  return {
    ejercicios,
    loading,
    error,
    filtrarPorContexto,
    filtrarPorBusqueda,
    obtenerEjercicio,
    recargar: cargarEjercicios,
  }
}

// Exportar también los valores únicos como hook separado si se necesita
export function useEjerciciosFiltros() {
  const { ejercicios } = useEjerciciosPool()
  
  return useMemo(() => ({
    segmentos: [...new Set(ejercicios.map(e => e.segmento))].sort(),
    patrones: [...new Set(ejercicios.map(e => e.patron_movimiento))].sort(),
    gruposMusculares: [...new Set(ejercicios.map(e => e.grupo_muscular))].sort(),
  }), [ejercicios])
}
