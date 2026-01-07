'use client'

import { useState } from 'react'

export interface OnboardingData {
  daysPerWeek: number
  gender: 'male' | 'female' | 'other'
  location: 'gym' | 'home'
  muscleFocus?: string // Opcional: preferencia de grupo muscular
}

interface OnboardingFormProps {
  onSubmit: (data: OnboardingData) => void
}

const MUSCLE_FOCUS_OPTIONS = [
  { value: '', label: 'Sin preferencia' },
  { value: 'pecho', label: 'Pecho' },
  { value: 'espalda', label: 'Espalda' },
  { value: 'hombros', label: 'Hombros' },
  { value: 'brazos', label: 'Brazos' },
  { value: 'piernas', label: 'Piernas' },
  { value: 'gluteos', label: 'Glúteos' },
  { value: 'core', label: 'Core/Abdominales' },
  { value: 'full_body', label: 'Full Body' },
]

export default function OnboardingForm({ onSubmit }: OnboardingFormProps) {
  const [formData, setFormData] = useState<OnboardingData>({
    daysPerWeek: 3,
    gender: 'male',
    location: 'gym', // Default: gimnasio
    muscleFocus: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        {/* Header con branding */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <h1 className="text-5xl md:text-6xl font-black text-black tracking-tight">
              GymLogic
            </h1>
            <div className="h-1 w-24 bg-blue-600 mx-auto mt-2 rounded-full"></div>
          </div>
          <p className="text-gray-600 text-lg font-medium">
            Tu coach digital personal
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 space-y-8 border border-gray-200">
          {/* Días por semana */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuántos días puedes entrenar por semana?
            </label>
            <select
              value={formData.daysPerWeek}
              onChange={(e) => setFormData({ ...formData, daysPerWeek: parseInt(e.target.value) })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 cursor-pointer"
              required
            >
              <option value={2}>2 días</option>
              <option value={3}>3 días</option>
              <option value={4}>4 días</option>
              <option value={5}>5 días</option>
              <option value={6}>6 días</option>
            </select>
          </div>

          {/* Género - Desplegable */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Género
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'other' })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 cursor-pointer"
              required
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {/* Lugar de entrenamiento */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Dónde entrenarás?
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`relative flex items-center justify-center p-4 border-2 rounded-xl transition-all ${
                'border-gray-400 bg-gray-200 text-gray-500 cursor-not-allowed opacity-60 hover:bg-gray-300 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="location"
                  value="home"
                  checked={false}
                  disabled
                  className="sr-only"
                />
                <span className="font-semibold">En casa</span>
              </label>
              <label className={`relative flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                formData.location === 'gym' 
                  ? 'border-blue-600 bg-blue-50 text-blue-900' 
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="location"
                  value="gym"
                  checked={formData.location === 'gym'}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as 'gym' | 'home' })}
                  className="sr-only"
                />
                <span className="font-semibold">Gimnasio</span>
                {formData.location === 'gym' && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </label>
            </div>
          </div>

          {/* Preferencia de foco muscular - Desplegable */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Preferencia de foco muscular <span className="text-gray-500 font-normal">(Opcional)</span>
            </label>
            <select
              value={formData.muscleFocus || ''}
              onChange={(e) => setFormData({ ...formData, muscleFocus: e.target.value || undefined })}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 cursor-pointer"
            >
              {MUSCLE_FOCUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              Selecciona un área específica o déjalo sin preferencia para entrenamiento completo
            </p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Generar mi rutina 🚀
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Rutinas personalizadas con IA • Powered by GymLogic
        </p>
      </div>
    </div>
  )
}

