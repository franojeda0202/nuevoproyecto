'use client'

import { useState, useEffect } from 'react'

interface SkeletonProps {
  className?: string
}

// Componente base para skeletons animados
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  )
}

// Skeleton para texto
export function SkeletonText({ className = '', lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'} ${className}`} 
        />
      ))}
    </div>
  )
}

// Skeleton para la página de rutinas
export function RutinaSkeleton() {
  return (
    <div className="min-h-screen app-page-bg p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-12 w-32 rounded-xl" />
            <Skeleton className="h-12 w-36 rounded-xl" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-2xl shadow-black/5 border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
              <div className="space-y-2">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-10 w-28 rounded-lg" />
                <Skeleton className="h-10 w-28 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Días skeleton */}
          <div className="p-6 space-y-8">
            {[1, 2, 3].map((dia) => (
              <div key={dia}>
                {/* Día header */}
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-6 w-24" />
                </div>
                
                {/* Tabla skeleton */}
                <div className="bg-slate-50/50 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-slate-50/80">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Skeleton para la página principal (loading inicial)
export function HomeSkeleton() {
  return (
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 p-8 space-y-6">
          {/* Logo/Title */}
          <div className="text-center space-y-2">
            <Skeleton className="h-10 w-10 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          
          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
          
          {/* Button */}
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// Skeleton para generar rutina (waiting for n8n)
export function GenerandoRutinaSkeleton() {
  const [currentStep, setCurrentStep] = useState(0)
  const steps = ['Analizando perfil', 'Seleccionando ejercicios', 'Optimizando rutina']
  // Tiempos en ms: paso 1 dura 5s, paso 2 dura 15s, paso 3 hasta que termine
  const stepDurations = [5000, 20000]

  useEffect(() => {
    // Timer para paso 1 → 2 (después de 5 segundos)
    const timer1 = setTimeout(() => {
      setCurrentStep(1)
    }, stepDurations[0])

    // Timer para paso 2 → 3 (después de 5 + 15 = 20 segundos)
    const timer2 = setTimeout(() => {
      setCurrentStep(2)
    }, stepDurations[0] + stepDurations[1])

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  return (
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin" />
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
          Generando tu rutina personalizada
        </h2>
        <p className="text-slate-600 mb-6">
          Nuestro sistema está creando un plan adaptado a tus objetivos...
        </p>
        
        <div className="bg-white rounded-2xl p-4 shadow-xl shadow-slate-900/10 border border-slate-200">
          <div className="space-y-3">
            {steps.map((step, i) => {
              const isCompleted = i < currentStep
              const isCurrent = i === currentStep
              
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-blue-600 text-white' : 
                    'bg-slate-100'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isCurrent ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-xs text-gray-400">{i + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm transition-all duration-300 ${
                    isCompleted ? 'text-green-600 font-medium' :
                    isCurrent ? 'text-slate-900 font-medium' : 
                    'text-slate-400'
                  }`}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        
        <p className="mt-4 text-xs text-slate-400">
          Esto puede tardar unos momentos
        </p>
      </div>
    </div>
  )
}
