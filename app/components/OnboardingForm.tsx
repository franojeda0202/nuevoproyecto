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

const FOCO_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sin preferencia' },
  { value: 'pecho', label: 'Pecho' },
  { value: 'espalda', label: 'Espalda' },
  { value: 'hombros', label: 'Hombros' },
  { value: 'brazos', label: 'Brazos' },
  { value: 'piernas', label: 'Piernas' },
  { value: 'gluteos', label: 'Glúteos' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
]

function PillGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string | number | null; label: string }[]
  value: string | number | null
  onChange: (v: string | number | null) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
            value === opt.value
              ? 'bg-yellow-500 border-yellow-500 text-black'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

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

export default function OnboardingForm({ onSubmit, supabase, userId }: OnboardingFormProps) {
  const [formData, setFormData] = useState<OnboardingData>(DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  // Pre-cargar perfil guardado al montar
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
      // Si falla, ignorar silenciosamente y mantener defaults
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

  const focoLabel = FOCO_OPTIONS.find(o => o.value === formData.focoMuscular)?.label

  return (
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
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

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-8 md:p-10 space-y-8 border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />

          {/* Días por semana */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuántos días podés entrenar por semana?
            </label>
            <PillGroup
              options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: `${n} días` }))}
              value={formData.diasSemana}
              onChange={(v) => set('diasSemana', v as number)}
              disabled={cargando}
            />
          </div>

          {/* Objetivo */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuál es tu objetivo?
            </label>
            <PillGroup
              options={[
                { value: 'musculo', label: 'Ganar músculo' },
                { value: 'fitness', label: 'Fitness general' },
                { value: 'fuerza', label: 'Fuerza' },
              ]}
              value={formData.objetivo}
              onChange={(v) => set('objetivo', v as OnboardingData['objetivo'])}
              disabled={cargando}
            />
          </div>

          {/* Nivel */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuál es tu nivel de experiencia?
            </label>
            <PillGroup
              options={[
                { value: 'principiante', label: 'Principiante' },
                { value: 'intermedio', label: 'Intermedio' },
                { value: 'avanzado', label: 'Avanzado' },
              ]}
              value={formData.nivel}
              onChange={(v) => set('nivel', v as OnboardingData['nivel'])}
              disabled={cargando}
            />
          </div>

          {/* Equipamiento */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Qué equipamiento tenés disponible?
            </label>
            <PillGroup
              options={[
                { value: 'bodyweight', label: 'Bodyweight' },
                { value: 'mancuernas', label: 'Mancuernas' },
                { value: 'barras', label: 'Barras + rack' },
                { value: 'gym_completo', label: 'Gym completo' },
              ]}
              value={formData.equipamiento}
              onChange={(v) => set('equipamiento', v as OnboardingData['equipamiento'])}
              disabled={cargando}
            />
          </div>

          {/* Duración */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuánto tiempo tenés por sesión?
            </label>
            <PillGroup
              options={[
                { value: 30, label: '30 min' },
                { value: 45, label: '45 min' },
                { value: 60, label: '60 min' },
                { value: 90, label: '90 min' },
              ]}
              value={formData.duracionMinutos}
              onChange={(v) => set('duracionMinutos', v as OnboardingData['duracionMinutos'])}
              disabled={cargando}
            />
          </div>

          {/* Foco muscular */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Preferencia de foco muscular <span className="text-gray-500 font-normal">(Opcional)</span>
            </label>
            <PillGroup
              options={FOCO_OPTIONS}
              value={formData.focoMuscular}
              onChange={(v) => set('focoMuscular', v as string)}
              disabled={cargando}
            />
          </div>

          {/* Género */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Género <span className="text-gray-500 font-normal">(Opcional)</span>
            </label>
            <PillGroup
              options={[
                { value: 'masculino', label: 'Masculino' },
                { value: 'femenino', label: 'Femenino' },
                { value: null, label: 'Prefiero no decir' },
              ]}
              value={formData.genero}
              onChange={(v) => set('genero', v as OnboardingData['genero'])}
              disabled={cargando}
            />
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 mb-1">¿Por qué te preguntamos esto?</p>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>La ciencia indica que las diferencias programáticas son menores de lo que se cree</li>
                <li>Las mujeres toleran más volumen y se recuperan más rápido entre series</li>
                <li>Las mujeres responden bien a rep ranges más altos (12–20 reps)</li>
                <li>Ambos sexos ganan músculo con los mismos movimientos — la diferencia es de preferencia y punto de partida</li>
                <li>En la práctica, el enfoque femenino suele ser más en tren inferior/glúteos; el masculino en tren superior</li>
              </ul>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Tu configuración:</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {formData.diasSemana} días/semana
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {OBJETIVO_LABEL[formData.objetivo]}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {NIVEL_LABEL[formData.nivel]}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {EQUIP_LABEL[formData.equipamiento]}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {formData.duracionMinutos} min
              </span>
              {formData.focoMuscular && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-700">
                  Foco: {focoLabel}
                </span>
              )}
              {formData.genero && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-700">
                  {GENERO_LABEL[formData.genero]}
                </span>
              )}
            </div>
          </div>

          {/* Error al guardar perfil */}
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
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Rutinas personalizadas con IA • Powered by GymLogic
        </p>
      </div>
    </div>
  )
}
