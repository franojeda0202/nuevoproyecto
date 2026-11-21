'use client'

import { useEffect } from 'react'

// Registra public/sw.js para que la app se pueda instalar en el teléfono.
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('No se pudo registrar el service worker:', err)
      })
    }
  }, [])

  return null
}
