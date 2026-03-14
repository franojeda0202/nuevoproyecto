'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validatePassword } from '@/lib/utils/validaciones'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const supabase = useMemo(() => createClient(), [])
  const exchanged = useRef(false)

  type PageState = 'loading' | 'invalid' | 'ready'
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!code) {
      setPageState('invalid')
      return
    }
    // Guard contra doble ejecución en React Strict Mode (dev)
    if (exchanged.current) return
    exchanged.current = true
    ;(async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      setPageState(exchangeError ? 'invalid' : 'ready')
    })()
  }, [code, supabase])

  const handlePasswordBlur = () => {
    if (!password) return
    const validation = validatePassword(password)
    setPasswordError(validation.valid ? null : validation.message)
  }

  const handleConfirmBlur = () => {
    if (!confirmPassword) return
    setConfirmError(confirmPassword !== password ? 'Las contraseñas no coinciden' : null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Re-validar antes de enviar (no confiar solo en onBlur)
    const validation = validatePassword(password)
    if (!validation.valid) {
      setPasswordError(validation.message)
      return
    }
    if (confirmPassword !== password) {
      setConfirmError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Ocurrió un error al guardar la contraseña. Intenta nuevamente.')
        return
      }
      router.push('/')
    } finally {
      setSubmitting(false)
    }
  }

  // ————————————————
  // Markup compartido: panel izquierdo (idéntico a LoginForm)
  // ————————————————
  const panelIzquierdo = (
    <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-neutral-900">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/gym-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-neutral-900/65" />
      <div className="relative z-10 flex flex-col justify-end px-12 py-16">
        <div className="flex items-center gap-3 mb-8">
          <svg className="w-9 h-9 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
          </svg>
          <span className="text-4xl font-display text-white tracking-widest uppercase leading-none">
            GymLogic
          </span>
        </div>
        <p className="text-5xl font-display text-white tracking-wider uppercase leading-tight">
          Tu rutina lista<br />en segundos.<br />Sin excusas.
        </p>
        <div className="mt-6 h-1 w-16 bg-yellow-500 rounded-full" />
      </div>
    </div>
  )

  // ————————————————
  // Bloque móvil de logo (idéntico a LoginForm)
  // ————————————————
  const logoMobile = (
    <div className="flex flex-col items-center mb-10 md:hidden">
      <div className="flex items-center justify-center gap-3 mb-1">
        <svg className="w-10 h-10 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
        </svg>
        <h1 className="text-6xl font-display text-slate-900 tracking-widest uppercase leading-none">
          GymLogic
        </h1>
      </div>
      <p className="text-slate-500 text-base font-medium mt-3">
        Tu coach digital personal
      </p>
    </div>
  )

  // ————————————————
  // Estado: loading
  // ————————————————
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex">
        {panelIzquierdo}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
          <div className="w-full max-w-md">
            {logoMobile}
            <p className="text-slate-500 text-center">Verificando...</p>
          </div>
        </div>
      </div>
    )
  }

  // ————————————————
  // Estado: invalid
  // ————————————————
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex">
        {panelIzquierdo}
        <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
          <div className="w-full max-w-md">
            {logoMobile}
            <div className="hidden md:block mb-8">
              <h1 className="text-4xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
                Link inválido
              </h1>
              <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
            </div>
            <div className="md:hidden mb-8">
              <h2 className="text-3xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
                Link inválido
              </h2>
              <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
            </div>
            <p className="text-slate-600 mb-6">
              Este link no es válido o ya expiró. Pedí uno nuevo desde la pantalla de inicio.
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10 flex items-center justify-center"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ————————————————
  // Estado: ready — form de nueva contraseña
  // ————————————————
  return (
    <div className="min-h-screen flex">
      {panelIzquierdo}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md">
          {logoMobile}

          <div className="hidden md:block mb-8">
            <h1 className="text-4xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
              Nueva contraseña
            </h1>
            <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
          </div>

          <div className="md:hidden mb-8">
            <h2 className="text-3xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
              Nueva contraseña
            </h2>
            <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Nueva contraseña
                <span className="text-gray-500 font-normal ml-2">
                  (mín. 6 caracteres, 1 mayúscula, 1 número)
                </span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                className={`w-full px-4 py-3.5 h-12 border rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all outline-none ${
                  passwordError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'
                }`}
                placeholder="••••••••"
                required
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-600 font-medium">{passwordError}</p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={handleConfirmBlur}
                className={`w-full px-4 py-3.5 h-12 border rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all outline-none ${
                  confirmError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-200'
                }`}
                placeholder="••••••••"
                required
              />
              {confirmError && (
                <p className="mt-2 text-sm text-red-600 font-medium">{confirmError}</p>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10 flex items-center justify-center"
            >
              {submitting ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-8">
            Rutinas personalizadas con IA • Powered by GymLogic
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-slate-500">Verificando...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
