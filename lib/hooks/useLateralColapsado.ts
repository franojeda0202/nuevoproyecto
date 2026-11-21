'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Preferencia del panel lateral (escritorio): expandido con textos o
// contraído a solo íconos. Es una comodidad por navegador, así que vive en
// localStorage; si no está disponible (modo privado), arranca expandido.
const CLAVE = 'gymlogic:lateral-colapsado'
const EVENTO = 'gymlogic:lateral-cambio'

function leer(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  window.addEventListener('storage', avisar)
  return () => {
    window.removeEventListener(EVENTO, avisar)
    window.removeEventListener('storage', avisar)
  }
}

/**
 * useSyncExternalStore y no useState + useEffect: en el servidor se renderiza
 * expandido y el navegador corrige sin desajuste de hidratación ni un
 * setState dentro de un efecto.
 */
export function useLateralColapsado(): [boolean, () => void] {
  const colapsado = useSyncExternalStore(suscribir, leer, () => false)

  const alternar = useCallback(() => {
    try {
      window.localStorage.setItem(CLAVE, leer() ? '0' : '1')
    } catch {
      // Sin almacenamiento: el cambio no se puede guardar ni mostrar
    }
    window.dispatchEvent(new Event(EVENTO))
  }, [])

  return [colapsado, alternar]
}
