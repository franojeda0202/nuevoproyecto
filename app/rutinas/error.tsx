'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Error boundary específico para la página de rutinas
export default function RutinasError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Error en página de rutinas:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 border border-gray-200">
        {/* Header con icono */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg 
              className="w-7 h-7 text-amber-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Error al cargar tu rutina
            </h2>
            <p className="text-gray-500 text-sm">
              No pudimos obtener los datos de tu rutina
            </p>
          </div>
        </div>

        <p className="text-gray-600 mb-6">
          Esto puede deberse a un problema de conexión o un error temporal. 
          Puedes intentar cargar la rutina nuevamente.
        </p>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 px-5 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reintentar
          </button>
          <a
            href="/"
            className="flex-1 px-5 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all text-center"
          >
            Volver al inicio
          </a>
        </div>

        {/* Info adicional */}
        <p className="mt-6 text-xs text-gray-400 text-center">
          Si el problema persiste, intenta cerrar sesión y volver a entrar.
        </p>

        {/* Detalle técnico (solo en desarrollo) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              Ver error técnico
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-red-600 overflow-auto max-h-32">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
