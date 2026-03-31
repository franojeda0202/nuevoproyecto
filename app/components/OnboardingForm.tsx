'use client'

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { obtenerPerfil, guardarPerfil } from '@/lib/services/perfil-service'

export interface OnboardingData {
  diasSemana: number
  objetivo: 'musculo' | 'fitness' | 'fuerza'
  nivel: 'principiante' | 'intermedio' | 'avanzado'
  equipamiento: 'bodyweight' | 'mancuernas' | 'barras' | 'gym_completo'
  duracionMinutos: 30 | 45 | 60 | 90
  focoMuscular: string
  genero: 'masculino' | 'femenino' | null
}

interface OnboardingFormProps {
  onSubmit: (data: OnboardingData) => void
  supabase: SupabaseClient
  userId: string
}

const DEFAULTS: OnboardingData = {
  diasSemana: 3,
  objetivo: 'musculo',
  nivel: 'principiante',
  equipamiento: 'gym_completo',
  duracionMinutos: 60,
  focoMuscular: '',
  genero: null,
}

const SELECT_CLASS =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed'

const OBJETIVO_LABEL: Record<string, string> = {
  musculo: 'Ganar músculo',
  fitness: 'Fitness general',
  fuerza: 'Fuerza',
}
const NIVEL_LABEL: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}
const EQUIP_LABEL: Record<string, string> = {
  bodyweight: 'Bodyweight',
  mancuernas: 'Mancuernas',
  barras: 'Barras + rack',
  gym_completo: 'Gym completo',
}
const GENERO_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

export default function OnboardingForm({ onSubmit, supabase, userId }: OnboardingFormProps) {
  const [formData, setFormData] = useState<OnboardingData>(DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      const resultado = await obtenerPerfil(supabase, userId)
      if (cancelled) return
      if (resultado.success && resultado.data) {
        const p = resultado.data
        setFormData(prev => ({
          ...prev,
          objetivo: p.objetivo,
          nivel: p.nivel,
          equipamiento: p.equipamiento,
          duracionMinutos: p.duracionMinutos,
          genero: p.genero,
        }))
      }
      setCargando(false)
    }
    cargar()
    return () => { cancelled = true }
  }, [supabase, userId])

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorPerfil(null)
    setGuardando(true)

    const resultado = await guardarPerfil(supabase, userId, {
      objetivo: formData.objetivo,
      nivel: formData.nivel,
      equipamiento: formData.equipamiento,
      duracionMinutos: formData.duracionMinutos,
      genero: formData.genero,
    })

    setGuardando(false)

    if (!resultado.success) {
      setErrorPerfil('No se pudo guardar tu perfil. Intenta de nuevo.')
      return
    }

    onSubmit(formData)
  }

  const focoLabel = formData.focoMuscular
    ? formData.focoMuscular.charAt(0).toUpperCase() + formData.focoMuscular.slice(1).replace('_', ' ')
    : null

  return (
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-1">
            <svg className="w-10 h-10 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
            </svg>
            <h1 className="text-6xl md:text-7xl font-display text-slate-900 tracking-widest uppercase leading-none">
              GymLogic
            </h1>
          </div>
          {cargando ? (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Cargando tu perfil...</span>
            </div>
          ) : (
            <p className="text-slate-500 text-base font-medium mt-3">Tu coach digital personal</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-6 md:p-8 border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />

          <div className="space-y-5">
            {/* Días + Duración — row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Días por semana
                </label>
                <SelectWrapper>
                  <select
                    value={formData.diasSemana}
                    onChange={e => set('diasSemana', Number(e.target.value) as OnboardingData['diasSemana'])}
                    disabled={cargando}
                    className={SELECT_CLASS}
                  >
                    {[2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} días</option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Duración por sesión
                </label>
                <SelectWrapper>
                  <select
                    value={formData.duracionMinutos}
                    onChange={e => set('duracionMinutos', Number(e.target.value) as OnboardingData['duracionMinutos'])}
                    disabled={cargando}
                    className={SELECT_CLASS}
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </SelectWrapper>
              </div>
            </div>

            {/* Objetivo */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Objetivo
              </label>
              <SelectWrapper>
                <select
                  value={formData.objetivo}
                  onChange={e => set('objetivo', e.target.value as OnboardingData['objetivo'])}
                  disabled={cargando}
                  className={SELECT_CLASS}
                >
                  <option value="musculo">Ganar músculo</option>
                  <option value="fitness">Fitness general</option>
                  <option value="fuerza">Fuerza</option>
                </select>
              </SelectWrapper>
            </div>

            {/* Nivel + Equipamiento — row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Nivel
                </label>
                <SelectWrapper>
                  <select
                    value={formData.nivel}
                    onChange={e => set('nivel', e.target.value as OnboardingData['nivel'])}
                    disabled={cargando}
                    className={SELECT_CLASS}
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                  </select>
                </SelectWrapper>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Equipamiento
                </label>
                <SelectWrapper>
                  <select
                    value={formData.equipamiento}
                    onChange={e => set('equipamiento', e.target.value as OnboardingData['equipamiento'])}
                    disabled={cargando}
                    className={SELECT_CLASS}
                  >
                    <option value="bodyweight">Bodyweight</option>
                    <option value="mancuernas">Mancuernas</option>
                    <option value="barras">Barras + rack</option>
                    <option value="gym_completo">Gym completo</option>
                  </select>
                </SelectWrapper>
              </div>
            </div>

            {/* Foco muscular */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Foco muscular <span className="normal-case font-normal text-slate-400">(opcional)</span>
              </label>
              <SelectWrapper>
                <select
                  value={formData.focoMuscular}
                  onChange={e => set('focoMuscular', e.target.value)}
                  disabled={cargando}
                  className={SELECT_CLASS}
                >
                  <option value="">Sin preferencia</option>
                  <option value="pecho">Pecho</option>
                  <option value="espalda">Espalda</option>
                  <option value="hombros">Hombros</option>
                  <option value="brazos">Brazos</option>
                  <option value="piernas">Piernas</option>
                  <option value="gluteos">Glúteos</option>
                  <option value="core">Core</option>
                  <option value="full_body">Full Body</option>
                </select>
              </SelectWrapper>
            </div>

            {/* Género */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Género <span className="normal-case font-normal text-slate-400">(opcional)</span>
              </label>
              <SelectWrapper>
                <select
                  value={formData.genero ?? ''}
                  onChange={e => set('genero', (e.target.value || null) as OnboardingData['genero'])}
                  disabled={cargando}
                  className={SELECT_CLASS}
                >
                  <option value="">Prefiero no decir</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </SelectWrapper>
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-1">¿Por qué te preguntamos esto?</p>
                <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                  <li>Las mujeres toleran más volumen y se recuperan más rápido entre series</li>
                  <li>Las mujeres responden bien a rep ranges más altos (12–20 reps)</li>
                  <li>Ambos sexos ganan músculo con los mismos movimientos — la diferencia es de preferencia y punto de partida</li>
                  <li>En la práctica, el enfoque femenino suele ser más en tren inferior/glúteos; el masculino en tren superior</li>
                </ul>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tu configuración</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">
                  {formData.diasSemana} días/sem
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">
                  {OBJETIVO_LABEL[formData.objetivo]}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">
                  {NIVEL_LABEL[formData.nivel]}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">
                  {EQUIP_LABEL[formData.equipamiento]}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">
                  {formData.duracionMinutos} min
                </span>
                {focoLabel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600 font-medium">
                    {focoLabel}
                  </span>
                )}
                {formData.genero && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600 font-medium">
                    {GENERO_LABEL[formData.genero]}
                  </span>
                )}
              </div>
            </div>

            {errorPerfil && (
              <p className="text-sm text-red-600 text-center">{errorPerfil}</p>
            )}

            <button
              type="submit"
              disabled={cargando || guardando}
              className="w-full py-4 h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{guardando ? 'Guardando...' : 'Generar mi rutina'}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Rutinas personalizadas con IA • Powered by GymLogic
        </p>
      </div>
    </div>
  )
}
