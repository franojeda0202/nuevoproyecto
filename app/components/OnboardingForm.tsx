'use client'

import { useState, useCallback } from 'react'

export interface OnboardingData {
  daysPerWeek: number
  gender: 'male' | 'female' | 'other'
  location: 'gym' | 'home'
  muscleFocus?: string // Opcional: preferencia de grupo muscular
}

interface OnboardingFormProps {
  onSubmit: (data: OnboardingData) => void
}

interface FormErrors {
  daysPerWeek?: string
  gender?: string
  location?: string
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
    location: 'gym',
    muscleFocus: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validar un campo específico
  const validateField = useCallback((field: keyof OnboardingData, value: unknown): string | undefined => {
    switch (field) {
      case 'daysPerWeek':
        if (!value || (value as number) < 2 || (value as number) > 6) {
          return 'Selecciona entre 2 y 6 días'
        }
        break
      case 'gender':
        if (!value || !['male', 'female', 'other'].includes(value as string)) {
          return 'Selecciona un género'
        }
        break
      case 'location':
        if (!value || !['gym', 'home'].includes(value as string)) {
          return 'Selecciona dónde entrenarás'
        }
        break
    }
    return undefined
  }, [])

  // Validar todo el formulario
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    
    const daysError = validateField('daysPerWeek', formData.daysPerWeek)
    if (daysError) newErrors.daysPerWeek = daysError
    
    const genderError = validateField('gender', formData.gender)
    if (genderError) newErrors.gender = genderError
    
    const locationError = validateField('location', formData.location)
    if (locationError) newErrors.location = locationError
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, validateField])

  // Manejar cambio de campo con validación
  const handleFieldChange = (field: keyof OnboardingData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Validar solo si el campo ya fue tocado
    if (touched[field]) {
      const error = validateField(field, value)
      setErrors(prev => ({ ...prev, [field]: error }))
    }
  }

  // Marcar campo como tocado
  const handleFieldBlur = (field: keyof OnboardingData) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    const error = validateField(field, formData[field])
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Marcar todos los campos como tocados
    setTouched({ daysPerWeek: true, gender: true, location: true })
    
    // Validar formulario completo
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  // Helper para clases de error
  const getFieldClasses = (field: keyof FormErrors, baseClasses: string) => {
    const hasError = touched[field] && errors[field]
    return `${baseClasses} ${hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`
  }

  return (
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
            GymLogic
          </h1>
          <div className="h-1 w-16 bg-blue-600 mx-auto mt-3 rounded-full" />
          <p className="text-slate-600 text-lg font-medium mt-3">
            Tu coach digital personal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-8 md:p-10 space-y-8 border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-blue-500" />
          {/* Días por semana */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuántos días puedes entrenar por semana?
            </label>
            <select
              value={formData.daysPerWeek}
              onChange={(e) => handleFieldChange('daysPerWeek', parseInt(e.target.value))}
              onBlur={() => handleFieldBlur('daysPerWeek')}
              className={getFieldClasses('daysPerWeek', 'w-full px-4 py-3.5 h-12 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none cursor-pointer')}
              required
            >
              <option value={2}>2 días</option>
              <option value={3}>3 días</option>
              <option value={4}>4 días</option>
              <option value={5}>5 días</option>
              <option value={6}>6 días</option>
            </select>
            {touched.daysPerWeek && errors.daysPerWeek && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.daysPerWeek}
              </p>
            )}
          </div>

          {/* Género - Desplegable */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Género
            </label>
            <select
              value={formData.gender}
              onChange={(e) => handleFieldChange('gender', e.target.value as 'male' | 'female' | 'other')}
              onBlur={() => handleFieldBlur('gender')}
              className={getFieldClasses('gender', 'w-full px-4 py-3.5 h-12 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none cursor-pointer')}
              required
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
            {touched.gender && errors.gender && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.gender}
              </p>
            )}
          </div>

          {/* Lugar de entrenamiento */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Dónde entrenarás?
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`relative flex items-center justify-center p-4 border-2 rounded-xl transition-all ${
                'border-gray-400 bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'
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
                <span className="absolute -top-2 -right-2 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Próximamente
                </span>
              </label>
              <label className={`relative flex items-center justify-center p-4 border rounded-xl cursor-pointer transition-all ${
                formData.location === 'gym' 
                  ? 'border-blue-600 bg-blue-50 text-slate-900' 
                  : touched.location && errors.location
                    ? 'border-red-500 bg-white text-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}>
                <input
                  type="radio"
                  name="location"
                  value="gym"
                  checked={formData.location === 'gym'}
                  onChange={(e) => handleFieldChange('location', e.target.value as 'gym' | 'home')}
                  onBlur={() => handleFieldBlur('location')}
                  className="sr-only"
                />
                <span className="font-semibold">Gimnasio</span>
                {formData.location === 'gym' && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full" />
                )}
              </label>
            </div>
            {touched.location && errors.location && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.location}
              </p>
            )}
          </div>

          {/* Preferencia de foco muscular - Desplegable */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Preferencia de foco muscular <span className="text-gray-500 font-normal">(Opcional)</span>
            </label>
            <select
              value={formData.muscleFocus || ''}
              onChange={(e) => handleFieldChange('muscleFocus', e.target.value || undefined)}
              className="w-full px-4 py-3.5 h-12 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none cursor-pointer"
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

          {/* Resumen de configuración */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Tu configuración:</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700">
                {formData.daysPerWeek} días/semana
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                {formData.gender === 'male' ? 'Masculino' : formData.gender === 'female' ? 'Femenino' : 'Otro'}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                {formData.location === 'gym' ? 'Gimnasio' : 'En casa'}
              </span>
              {formData.muscleFocus && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                  Foco: {MUSCLE_FOCUS_OPTIONS.find(o => o.value === formData.muscleFocus)?.label}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 h-12 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-900/25 flex items-center justify-center gap-2"
          >
            <span>Generar mi rutina</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
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

