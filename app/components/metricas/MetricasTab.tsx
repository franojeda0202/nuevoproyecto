'use client'

import { useState, useEffect, useMemo } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  MetricasResumen,
  PRejercicio,
  PRejercicioDisplay,
  EjercicioRutinaActiva,
} from '@/lib/types/database'
import {
  obtenerMetricasResumen,
  obtenerPRsEjercicios,
  obtenerEjerciciosRutinaActiva,
} from '@/lib/services/metricas-service'
import HeroStat from './HeroStat'
import MiniStats from './MiniStats'
import CalendarioMes from './CalendarioMes'
import PRsPanel from './PRsPanel'

const LS_KEY = 'gymlogic_pr_pins'
const MAX_PINNED = 4
const TOP_DEFAULTS = 4

interface MetricasTabProps {
  userId: string
  supabase: SupabaseClient
}

export default function MetricasTab({ userId, supabase }: MetricasTabProps) {
  const [subTab, setSubTab] = useState<'resumen' | 'progreso'>('resumen')
  const [metricas, setMetricas] = useState<MetricasResumen | null>(null)
  const [prsData, setPrsData] = useState<PRejercicio[]>([])
  const [ejerciciosDisponibles, setEjerciciosDisponibles] = useState<EjercicioRutinaActiva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [prsPinned, setPrsPinned] = useState<string[]>([])

  // Cargar pinned desde localStorage al montar (solo client-side)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        // Limitar al máximo por si acaso
        setPrsPinned(parsed.slice(0, MAX_PINNED))
      }
    } catch {
      // localStorage no disponible o JSON inválido — ignorar
    }
  }, [])

  // Cargar datos
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    Promise.all([
      obtenerMetricasResumen(supabase, userId),
      obtenerEjerciciosRutinaActiva(supabase, userId),
    ]).then(async ([metricasResult, ejerciciosResult]) => {
      if (cancelled) return

      if (!metricasResult.success || !ejerciciosResult.success) {
        setError(true)
        setLoading(false)
        return
      }

      setMetricas(metricasResult.data!)
      setEjerciciosDisponibles(ejerciciosResult.data!)

      // Calcular ejercicios a mostrar en PRs
      const ejercicios = ejerciciosResult.data!
      const compuestosPorFrecuencia = ejercicios
        .filter(e => e.esCompuesto)
        .sort((a, b) => b.frecuencia - a.frecuencia)
        .slice(0, TOP_DEFAULTS)
        .map(e => e.ejercicioId)

      // Leer pinned actuales (podría haber cambiado, usar state actualizado)
      let pinnedActuales: string[] = []
      try {
        const stored = localStorage.getItem(LS_KEY)
        pinnedActuales = stored ? (JSON.parse(stored) as string[]).slice(0, MAX_PINNED) : []
      } catch { /* ignore */ }

      // Filtrar pinned que ya no existen en la rutina activa
      const ejercicioIdsValidos = new Set(ejercicios.map(e => e.ejercicioId))
      const pinnedValidos = pinnedActuales.filter(id => ejercicioIdsValidos.has(id))

      // IDs a consultar para PRs (defaults + pinned, sin duplicados)
      const idsParaPRs = Array.from(new Set([...compuestosPorFrecuencia, ...pinnedValidos]))

      if (idsParaPRs.length > 0) {
        const prsResult = await obtenerPRsEjercicios(supabase, userId, idsParaPRs)
        if (!cancelled) {
          if (!prsResult.success) {
            setError(true)
            setLoading(false)
            return
          }
          setPrsData(prsResult.data!)
        }
      }

      if (!cancelled) {
        setPrsPinned(pinnedValidos)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [userId, supabase, retryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinChange = (nuevosIds: string[]) => {
    const limitados = nuevosIds.slice(0, MAX_PINNED)
    setPrsPinned(limitados)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(limitados))
    } catch { /* ignore */ }

    // Re-fetch PRs con los nuevos IDs
    const ejerciciosCompuestos = ejerciciosDisponibles
      .filter(e => e.esCompuesto)
      .sort((a, b) => b.frecuencia - a.frecuencia)
      .slice(0, TOP_DEFAULTS)
      .map(e => e.ejercicioId)
    const idsParaPRs = Array.from(new Set([...ejerciciosCompuestos, ...limitados]))

    if (idsParaPRs.length > 0) {
      obtenerPRsEjercicios(supabase, userId, idsParaPRs).then(result => {
        if (result.success) setPrsData(result.data!)
      })
    }
  }

  // Construir lista de PRs para mostrar (defaults + pinned, con nombres)
  const prsDisplay = useMemo((): PRejercicioDisplay[] => {
    const defaultIds = ejerciciosDisponibles
      .filter(e => e.esCompuesto)
      .sort((a, b) => b.frecuencia - a.frecuencia)
      .slice(0, TOP_DEFAULTS)
      .map(e => e.ejercicioId)

    const idsAMostrar = Array.from(new Set([...defaultIds, ...prsPinned]))

    return idsAMostrar.map(ejId => {
      const ejercicio = ejerciciosDisponibles.find(e => e.ejercicioId === ejId)
      const pr = prsData.find(p => p.ejercicioId === ejId)
      return {
        ejercicioId: ejId,
        nombre: ejercicio?.nombre ?? ejId,
        pesoKg: pr?.pesoKg ?? null,
        repeticiones: pr?.repeticiones ?? null,
        esPinned: prsPinned.includes(ejId),
      }
    })
  }, [ejerciciosDisponibles, prsPinned, prsData])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-slate-500 mb-4">No se pudieron cargar las métricas. Intentá de nuevo.</p>
        <button
          type="button"
          onClick={() => { setError(false); setLoading(true); setRetryKey(k => k + 1) }}
          className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Sub-tabs: Resumen / Progreso */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSubTab('resumen')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            subTab === 'resumen'
              ? 'bg-yellow-500 text-black'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Resumen
        </button>
        <button
          type="button"
          onClick={() => setSubTab('progreso')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            subTab === 'progreso'
              ? 'bg-yellow-500 text-black'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Progreso
        </button>
      </div>

      {subTab === 'progreso' ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">Próximamente</p>
          <p className="text-slate-400 text-xs mt-1">Gráficos de progresión por ejercicio</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metricas && (
            <>
              <HeroStat
                count={metricas.entrenamientosEsteMes}
                comparacion={metricas.entrenamientosEsteMes - metricas.entrenamientosMesPasado}
              />
              <MiniStats
                racha={metricas.rachaActual}
                duracionPromedio={metricas.duracionPromedioMinutos}
                porcentajeCompletadas={metricas.porcentajeSeriesCompletadas}
              />
              <CalendarioMes diasEntrenados={metricas.diasEntrenadosEsteMes} />
            </>
          )}
          <PRsPanel
            prs={prsDisplay}
            ejerciciosDisponibles={ejerciciosDisponibles}
            pinnedIds={prsPinned}
            sinRutina={ejerciciosDisponibles.length === 0}
            onPinChange={handlePinChange}
          />
        </div>
      )}
    </div>
  )
}
