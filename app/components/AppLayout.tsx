'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks'
import { useLateralColapsado } from '@/lib/hooks/useLateralColapsado'
import { createClient } from '@/lib/supabase/client'
import { obtenerSesionEnProgreso } from '@/lib/services/sesion-service'
import BarraEntrenamientoEnCurso from '@/app/components/sesion/BarraEntrenamientoEnCurso'

interface AppLayoutProps {
  children: React.ReactNode
}

type Icono = 'hoy' | 'rutina' | 'historial' | 'cuenta' | 'salir'

const NAV_ITEMS: Array<{ label: string; labelCorto: string; href: string; icono: Icono; tambien?: string[] }> = [
  // /entrenar (elegir día) es parte del flujo de "Hoy"
  { label: 'Hoy', labelCorto: 'Hoy', href: '/hoy', icono: 'hoy', tambien: ['/entrenar'] },
  { label: 'Tu Rutina', labelCorto: 'Rutina', href: '/rutinas', icono: 'rutina' },
  { label: 'Entrenamientos', labelCorto: 'Historial', href: '/entrenamiento', icono: 'historial' },
]

function IconoNav({ icono }: { icono: Icono }) {
  const trazos: Record<Icono, React.ReactNode> = {
    hoy: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
    rutina: <path d="M6 5v14M18 5v14M3 9h3M18 9h3M3 15h3M18 15h3M6 12h12" />,
    historial: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M4 11h16" />
      </>
    ),
    cuenta: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0116 0" />
      </>
    ),
    salir: <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3" />,
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      {trazos[icono]}
    </svg>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [colapsado, alternarLateral] = useLateralColapsado()
  const pathname = usePathname()
  const router = useRouter()
  const { user, userId, logout } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [enCurso, setEnCurso] = useState<{ sesionId: string; diaNombre: string; iniciadaAt: string } | null>(null)

  // La sesión activa tiene su propia barra inferior (descanso y terminar):
  // ahí la navegación sobra y competiría por el pulgar.
  const enSesionActiva = !!pathname?.startsWith('/entrenar/')

  // Entrenamiento sin terminar: se busca en cada pantalla (cada una monta su
  // AppLayout), así la barra aparece apenas salís de la sesión con "Volver".
  useEffect(() => {
    if (!userId) return
    let vigente = true
    obtenerSesionEnProgreso(supabase, userId).then((r) => {
      if (vigente && r.success) setEnCurso(r.data ?? null)
    })
    return () => {
      vigente = false
    }
  }, [supabase, userId, pathname])

  // En todas las pantallas salvo la sesión misma: al salir con "Volver", el
  // entrenamiento tiene que seguir a la vista siempre en el mismo lugar,
  // también en Hoy aunque ahí haya una tarjeta grande.
  const mostrarBarraEnCurso = !!enCurso && !enSesionActiva

  useEffect(() => {
    if (!cuentaAbierta) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCuentaAbierta(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cuentaAbierta])

  const isActivo = (item: (typeof NAV_ITEMS)[number]) =>
    [item.href, ...(item.tambien ?? [])].some(
      (ruta) => pathname === ruta || (pathname?.startsWith(ruta + '/') && ruta !== '/entrenar')
    )

  return (
    // overflow-x-clip y no hidden: hidden convierte este div en contenedor de
    // scroll y rompe los encabezados sticky (el de la sesión activa)
    <div
      className="min-h-screen flex overflow-x-clip"
      style={{ '--ancho-lateral': colapsado ? '76px' : '256px' } as React.CSSProperties}
    >
      {/* ── Panel lateral (escritorio): expandido con textos o contraído a íconos ──
          Su ancho vive en --ancho-lateral (ver el div raíz), y el contenido y
          las barras fijas de abajo lo usan para no quedar debajo del panel. */}
      <aside
        className="hidden md:flex md:flex-col md:w-[var(--ancho-lateral)] md:fixed md:inset-y-0 bg-neutral-900 z-30 transition-[width] duration-200 overflow-hidden"
      >
        <div className={`h-20 border-b border-neutral-800 flex items-center ${colapsado ? 'justify-center' : 'justify-between pl-6 pr-3'}`}>
          {!colapsado && (
            <span className="text-yellow-500 font-display text-2xl tracking-widest uppercase whitespace-nowrap">
              GymLogic
            </span>
          )}
          <button
            type="button"
            onClick={alternarLateral}
            aria-label={colapsado ? 'Expandir el menú' : 'Contraer el menú'}
            aria-expanded={!colapsado}
            title={colapsado ? 'Expandir el menú' : 'Contraer el menú'}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${colapsado ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"
            >
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
        </div>
        <nav aria-label="Navegación principal" className={`flex-1 space-y-1 ${colapsado ? 'p-3' : 'p-4'}`}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              aria-current={isActivo(item) ? 'page' : undefined}
              title={colapsado ? item.label : undefined}
              className={`w-full h-12 flex items-center gap-3 rounded-xl font-semibold transition-colors ${
                colapsado ? 'justify-center' : 'px-4'
              } ${isActivo(item) ? 'bg-yellow-500 text-black' : 'text-white hover:bg-neutral-800'}`}
            >
              <IconoNav icono={item.icono} />
              <span className={colapsado ? 'sr-only' : 'whitespace-nowrap'}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className={`border-t border-neutral-800 ${colapsado ? 'p-3' : 'p-4'}`}>
          {user?.email && !colapsado && <p className="text-neutral-400 text-xs mb-3 truncate px-1">{user.email}</p>}
          <button
            type="button"
            onClick={logout}
            title={colapsado ? 'Cerrar sesión' : undefined}
            className={`w-full h-11 flex items-center gap-3 text-neutral-300 hover:text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors ${
              colapsado ? 'justify-center' : 'px-4'
            }`}
          >
            <IconoNav icono="salir" />
            <span className={colapsado ? 'sr-only' : 'whitespace-nowrap'}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      {/* pb: deja lugar para las barras fijas de abajo, que si no tapan lo último de cada pantalla */}
      <div
        className={`flex-1 md:ml-[var(--ancho-lateral)] min-w-0 transition-[margin] duration-200 ${
          enSesionActiva ? '' : mostrarBarraEnCurso ? 'pb-44 md:pb-28' : 'pb-24 md:pb-0'
        }`}
      >
        {children}
      </div>

      {/* ── Barras fijas de abajo: entrenamiento en curso y navegación (móvil) ── */}
      {!enSesionActiva && (
      <div className="fixed bottom-0 inset-x-0 md:left-[var(--ancho-lateral)] z-40 flex flex-col md:px-4 md:pb-4 md:pointer-events-none">
      {mostrarBarraEnCurso && enCurso && (
        <div className="md:max-w-lg md:w-full md:mx-auto md:pointer-events-auto">
          <BarraEntrenamientoEnCurso {...enCurso} />
        </div>
      )}
      {/* Navegación (móvil): se alcanza con el pulgar, a diferencia del menú hamburguesa */}
        <nav
          aria-label="Navegación principal"
          className="md:hidden bg-white border-t border-slate-200 grid grid-cols-4 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {NAV_ITEMS.map((item) => {
            const activo = isActivo(item)
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                aria-current={activo ? 'page' : undefined}
                className={`min-h-14 flex flex-col items-center justify-center gap-1 text-xs ${
                  activo ? 'text-neutral-900 font-bold' : 'text-slate-600 font-semibold'
                }`}
              >
                <span className={`w-14 h-8 rounded-full flex items-center justify-center ${activo ? 'bg-yellow-500' : ''}`}>
                  <IconoNav icono={item.icono} />
                </span>
                {item.labelCorto}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCuentaAbierta(true)}
            aria-haspopup="dialog"
            className="min-h-14 flex flex-col items-center justify-center gap-1 text-xs text-slate-600 font-semibold"
          >
            <span className="w-14 h-8 rounded-full flex items-center justify-center">
              <IconoNav icono="cuenta" />
            </span>
            Cuenta
          </button>
        </nav>
      </div>
      )}

      {/* ── Hoja de cuenta (móvil) ── */}
      {cuentaAbierta && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setCuentaAbierta(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cuenta"
            className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl px-4 pt-3 pb-8 flex flex-col gap-4"
          >
            <div className="flex justify-center" aria-hidden="true">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div>
              <h2 id="titulo-cuenta" className="text-2xl font-display text-slate-900 tracking-widest uppercase leading-none">
                Tu cuenta
              </h2>
              {user?.email && <p className="text-slate-600 mt-1 break-all">{user.email}</p>}
            </div>
            <button
              type="button"
              onClick={() => { setCuentaAbierta(false); logout() }}
              className="h-12 border-2 border-neutral-900 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-100 transition-colors"
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => setCuentaAbierta(false)}
              className="h-12 text-slate-700 font-semibold rounded-2xl hover:bg-slate-100 transition-colors"
            >
              Volver
            </button>
          </div>
        </>
      )}
    </div>
  )
}
