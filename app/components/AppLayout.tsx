'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks'

interface AppLayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  { label: 'Tu Rutina', href: '/rutinas' },
  { label: 'Entrenamientos', href: '/entrenamiento' },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const cerrar = () => setDrawerOpen(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    if (drawerOpen) document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  const isActivo = (href: string) =>
    pathname === href || (pathname?.startsWith(href + '/') && href !== '/rutinas')

  const navLinks = (onClick?: () => void) => (
    <nav className="flex-1 p-4 space-y-1">
      {NAV_ITEMS.map(item => (
        <button
          key={item.href}
          type="button"
          onClick={() => { router.push(item.href); onClick?.() }}
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
  )

  const navFooter = (onClick?: () => void) => (
    <div className="p-4 border-t border-neutral-800">
      {user?.email && (
        <p className="text-neutral-500 text-xs mb-3 truncate px-1">{user.email}</p>
      )}
      <button
        type="button"
        onClick={() => { onClick?.(); logout() }}
        className="w-full text-left px-4 py-2 text-neutral-400 hover:text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
      >
        Cerrar Sesión
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex">
      {/* ── Sidebar persistente (desktop) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-neutral-900 z-30">
        <div className="p-6 border-b border-neutral-800">
          <span className="text-yellow-500 font-display text-2xl tracking-widest uppercase">
            GymLogic
          </span>
        </div>
        {navLinks()}
        {navFooter()}
      </aside>

      {/* ── Hamburger (mobile only) ── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menú"
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-sm hover:bg-neutral-50 transition-colors"
      >
        <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Backdrop (mobile only) ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={cerrar}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer lateral (mobile only) ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-neutral-900 z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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
        {navLinks(cerrar)}
        {navFooter(cerrar)}
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex-1 md:ml-64">
        {children}
      </div>
    </div>
  )
}
