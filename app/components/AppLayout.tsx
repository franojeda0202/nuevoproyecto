'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks'

interface AppLayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  { label: 'Mi Rutina', href: '/rutinas' },
  { label: 'Entrenamiento', href: '/entrenamiento' },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const cerrar = () => setDrawerOpen(false)

  const isActivo = (href: string) =>
    pathname === href || (pathname?.startsWith(href + '/') && href !== '/rutinas')

  return (
    <div className="relative">
      {/* Botón hamburger */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menú"
        className="fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={cerrar}
          aria-hidden="true"
        />
      )}

      {/* Drawer lateral */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-neutral-900 z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!drawerOpen}
      >
        {/* Logo */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-yellow-500 font-display text-2xl tracking-widest uppercase">
            GymLogic
          </span>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Links de navegación */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              type="button"
              onClick={() => { router.push(item.href); cerrar() }}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold transition-colors ${
                isActivo(item.href)
                  ? 'bg-yellow-500 text-black'
                  : 'text-white hover:bg-neutral-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer: email + cerrar sesión */}
        <div className="p-4 border-t border-neutral-800">
          {user?.email && (
            <p className="text-neutral-500 text-xs mb-3 truncate px-1">{user.email}</p>
          )}
          <button
            type="button"
            onClick={() => { cerrar(); logout() }}
            className="w-full text-left px-4 py-2 text-neutral-400 hover:text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Contenido de la página */}
      {children}
    </div>
  )
}
