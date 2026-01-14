'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Este componente maneja errores en el root layout
// Debe incluir su propio <html> y <body> porque reemplaza todo
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Error global capturado:', error)
  }, [error])

  return (
    <html lang="es">
      <body className="antialiased">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-gray-200">
            {/* Icono de error crítico */}
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg 
                className="w-10 h-10 text-red-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Error crítico
            </h1>
            
            <p className="text-gray-600 mb-6">
              La aplicación encontró un error grave. Por favor, recarga la página para continuar.
            </p>

            <button
              onClick={reset}
              className="w-full px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
