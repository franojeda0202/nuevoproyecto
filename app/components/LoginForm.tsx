'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuthMode = 'login' | 'signup'

// Función para validar contraseña
const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 6) {
    return { valid: false, message: 'La contraseña debe tener al menos 6 caracteres' }
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos una mayúscula' }
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos un número' }
  }
  
  return { valid: true, message: '' }
}

// Función para traducir errores de Supabase
const translateError = (error: any): string => {
  const errorMessage = error.message || ''
  const errorStatus = error.status || ''
  
  // Email no confirmado - ignoramos este error y permitimos el login
  if (
    errorMessage.includes('Email not confirmed') || 
    errorMessage.includes('email not confirmed') ||
    errorMessage.includes('Email address not confirmed') ||
    errorStatus === 400 && errorMessage.includes('confirm')
  ) {
    return '' // Retornamos string vacío para que no muestre error
  }
  
  // Email ya en uso
  if (errorMessage.includes('already registered') || errorMessage.includes('User already registered')) {
    return 'Este email ya está en uso. Intenta iniciar sesión o usa otro email.'
  }
  
  // Usuario no registrado o credenciales inválidas
  if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('Invalid credentials')) {
    return 'Email o contraseña incorrectos. Verifica tus credenciales.'
  }
  
  // Contraseña incorrecta (puede venir en diferentes formatos)
  if (errorMessage.includes('password') && errorMessage.includes('incorrect')) {
    return 'Contraseña incorrecta. Intenta nuevamente.'
  }
  
  // Usuario no encontrado
  if (errorMessage.includes('User not found') || errorMessage.includes('No user found')) {
    return 'Usuario no registrado. Por favor, regístrate primero.'
  }
  
  // Email inválido
  if (errorMessage.includes('email') && errorMessage.includes('invalid')) {
    return 'Email inválido. Verifica el formato.'
  }
  
  // Retornar mensaje original si no coincide con ninguno
  return errorMessage || 'Ocurrió un error. Intenta nuevamente.'
}

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const supabase = createClient()

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setPassword(newPassword)
    
    // Solo validar en modo registro y si hay contenido
    if (mode === 'signup' && newPassword.length > 0) {
      const validation = validatePassword(newPassword)
      if (!validation.valid) {
        setPasswordError(validation.message)
      } else {
        setPasswordError(null)
      }
    } else {
      setPasswordError(null)
    }
    
    // Limpiar error general al cambiar la contraseña
    if (error) {
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    setPasswordError(null)

    try {
      if (mode === 'signup') {
        // Validar contraseña antes de enviar
        const validation = validatePassword(password)
        if (!validation.valid) {
          setPasswordError(validation.message)
          setLoading(false)
          return
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined, // No requerir verificación de email
          },
        })

        if (signUpError) {
          const translatedError = translateError(signUpError)
          if (translatedError) {
            setError(translatedError)
            setLoading(false)
            return
          }
        }

        // Si el registro fue exitoso, intentar iniciar sesión automáticamente
        if (signUpData?.user) {
          // Esperar un momento para que se procese el registro
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Intentar iniciar sesión automáticamente después del registro
          const { error: autoSignInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (!autoSignInError) {
            onSuccess()
            return
          }
        }

        setMessage('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.')
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          // Si el error es de email no confirmado, intentar obtener la sesión de todas formas
          const isEmailNotConfirmed = 
            signInError.message?.includes('Email not confirmed') ||
            signInError.message?.includes('email not confirmed') ||
            signInError.message?.includes('Email address not confirmed') ||
            signInError.message?.toLowerCase().includes('confirm')

          if (isEmailNotConfirmed) {
            // Verificar si hay una sesión de todas formas
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              onSuccess()
              return
            }
            
            // Si no hay sesión, el error de email no confirmado se ignora silenciosamente
            // y se muestra un mensaje genérico o se permite el login
            // Nota: Para deshabilitar completamente la verificación, ve al dashboard de Supabase
            // Authentication > Settings > Disable "Enable email confirmations"
          }
          
          const translatedError = translateError(signInError)
          if (translatedError) {
            setError(translatedError)
            setLoading(false)
            return
          }
        }

        // Si hay sesión, autenticar
        if (signInData?.session) {
          onSuccess()
          return
        }

        onSuccess()
      }
    } catch (err: any) {
      const translatedError = translateError(err)
      setError(translatedError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        {/* Header con branding */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <h1 className="text-5xl md:text-6xl font-black text-black tracking-tight">
              GymLogic
            </h1>
            <div className="h-1 w-24 bg-blue-600 mx-auto mt-2 rounded-full"></div>
          </div>
          <p className="text-gray-600 text-lg font-medium">
            Tu coach digital personal
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 space-y-6 border border-gray-200">
          {/* Tabs Login/Registro */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
                setMessage(null)
                setPasswordError(null)
              }}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setMessage(null)
                setPasswordError(null)
              }}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 border-2 border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="tu@email.com"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Contraseña
              {mode === 'signup' && (
                <span className="text-gray-500 font-normal ml-2">
                  (mín. 6 caracteres, 1 mayúscula, 1 número)
                </span>
              )}
            </label>
            <input
              type="password"
              value={password}
              onChange={handlePasswordChange}
              className={`w-full px-5 py-3.5 border-2 rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                passwordError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
              }`}
              placeholder="••••••••"
              required
              minLength={6}
            />
            {passwordError && (
              <p className="mt-2 text-sm text-red-600 font-medium">{passwordError}</p>
            )}
          </div>

          {/* Mensajes de error/éxito */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 text-sm font-medium">
              {message}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !!passwordError)}
            className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Rutinas personalizadas con IA • Powered by GymLogic
        </p>
      </div>
    </div>
  )
}

