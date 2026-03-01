'use client'

import { useEffect } from 'react'

interface PremiumModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out_both]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden animate-[scaleIn_0.15s_ease-out_both]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de acento */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />

        <div className="p-8 text-center">
          {/* Ícono de candado */}
          <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Función Premium</h3>
          <p className="text-slate-500 text-sm mb-6">
            Esta función estará disponible en la próxima versión de GymLogic.
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
