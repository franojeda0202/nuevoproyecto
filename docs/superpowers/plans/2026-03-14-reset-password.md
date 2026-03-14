# Reset Password Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que usuarios que olvidaron su contraseña la restablezcan vía email usando el flujo PKCE de Supabase Auth.

**Architecture:** La validación de contraseña se extrae a `lib/utils/validaciones.ts` para compartirla entre `LoginForm` y la nueva página. `LoginForm` gana un modo `'forgot'` que se activa desde un link bajo el campo contraseña. La página `/auth/reset-password` recibe el `code` de Supabase, lo intercambia por una sesión con `exchangeCodeForSession`, y luego permite al usuario ingresar su nueva contraseña.

**Tech Stack:** Next.js 16 App Router, `'use client'`, Supabase Auth (PKCE), TypeScript, Tailwind CSS v4.

---

## Chunk 1: Utilidad compartida y modificaciones a LoginForm

### Task 1: Crear `lib/utils/validaciones.ts`

**Files:**
- Create: `lib/utils/validaciones.ts`
- Modify: `app/components/LoginForm.tsx`

La función `validatePassword` vive actualmente en `LoginForm.tsx` (líneas 9–23). Hay que moverla a un módulo compartido para que la nueva página de reset password también pueda usarla.

- [ ] **Step 1: Crear `lib/utils/validaciones.ts`**

```ts
export const validatePassword = (password: string): { valid: boolean; message: string } => {
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
```

- [ ] **Step 2: En `LoginForm.tsx`, reemplazar la definición local de `validatePassword` por un import**

Eliminar las líneas 8–23 del archivo (el comentario `// Función para validar contraseña` en la línea 8 y la función `validatePassword` completa en las líneas 9–23).

Actualizar la línea de imports de React para agregar `useMemo`:
```ts
// ANTES:
import { useState } from 'react'

// DESPUÉS:
import { useState, useMemo } from 'react'
```

Agregar import de `validatePassword` justo después del import de `createClient`:
```ts
import { validatePassword } from '@/lib/utils/validaciones'
```

- [ ] **Step 3: Memoizar el cliente Supabase en `LoginForm.tsx`**

Localizar la línea (actualmente línea 83, pero puede haber movido por el paso anterior):
```ts
const supabase = createClient()
```

Reemplazarla por:
```ts
const supabase = useMemo(() => createClient(), [])
```

Esto es una convención obligatoria del proyecto (ver CLAUDE.md) — sin `useMemo`, `createClient()` genera una nueva instancia en cada render.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores. El comportamiento de `LoginForm` no cambia — solo se movió la función.

- [ ] **Step 5: Verificar en navegador que login y registro siguen funcionando**

```bash
npm run dev
```

Ir a la raíz `/`. Probar login con credenciales válidas. Probar que la validación de contraseña en modo registro sigue funcionando.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/validaciones.ts app/components/LoginForm.tsx
git commit -m "refactor: extraer validatePassword a lib/utils/validaciones y memoizar cliente Supabase en LoginForm"
```

---

### Task 2: Agregar modo `'forgot'` a `LoginForm.tsx`

**Files:**
- Modify: `app/components/LoginForm.tsx`

Este task agrega el flujo completo de "olvidé mi contraseña" dentro del componente existente, sin tocar el flujo de login/signup.

- [ ] **Step 1: Agregar `'forgot'` al tipo `AuthMode`**

```ts
// ANTES:
type AuthMode = 'login' | 'signup'

// DESPUÉS:
type AuthMode = 'login' | 'signup' | 'forgot'
```

- [ ] **Step 2: Agregar el handler `handleForgotPassword` antes de `handleSubmit`**

Insertar esta función antes de `const handleSubmit`:

```ts
const handleForgotPassword = async () => {
  setLoading(true)
  try {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/reset-password',
    })
    if (resetError) {
      setError('Ocurrió un error. Intenta nuevamente.')
      return
    }
    // Mostrar mensaje genérico independientemente de si el email existe
    setMessage('Si ese email está registrado, recibirás las instrucciones en breve.')
  } finally {
    setLoading(false)
  }
}
```

Nota sobre `redirectTo`: la URL debe coincidir exactamente con la entrada en Supabase Dashboard > Authentication > URL Configuration > Redirect URLs. Sin trailing slash. El dev URL es `http://localhost:3000/auth/reset-password`.

- [ ] **Step 3: Agregar el branch `'forgot'` al inicio de `handleSubmit`**

Dentro de `handleSubmit`, justo al inicio del bloque `try` (antes del `if (mode === 'signup')`), agregar:

```ts
if (mode === 'forgot') {
  await handleForgotPassword()
  return
}
```

El bloque `try` quedará así:
```ts
try {
  if (mode === 'forgot') {
    await handleForgotPassword()
    return
  }

  if (mode === 'signup') {
    // ... código existente sin cambios
```

- [ ] **Step 4: Actualizar el label del botón submit para el modo `'forgot'`**

Localizar la línea del botón submit que actualmente dice:
```tsx
{loading ? 'Cargando...' : mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
```

Reemplazarla por:
```tsx
{loading
  ? (mode === 'forgot' ? 'Enviando...' : 'Cargando...')
  : mode === 'login'
    ? 'Iniciar Sesión'
    : mode === 'signup'
      ? 'Crear Cuenta'
      : 'Enviar link'}
```

- [ ] **Step 5: Actualizar la condición `disabled` del botón submit**

La línea actual es:
```tsx
disabled={loading || (mode === 'signup' && !!passwordError)}
```

No necesita cambios — en modo `'forgot'` solo `loading` importa, y eso ya está cubierto.

- [ ] **Step 6: Envolver los tabs Login/Registro para que desaparezcan en modo `'forgot'`**

Localizar el bloque de tabs (empieza con `{/* Tabs Login/Registro */}`):
```tsx
{/* Tabs Login/Registro */}
<div className="flex gap-2">
  ...
</div>
```

Envolverlo en un condicional:
```tsx
{mode !== 'forgot' && (
  <div className="flex gap-2">
    ...
  </div>
)}
```

- [ ] **Step 7: Actualizar el heading desktop para el modo `'forgot'`**

Localizar el bloque `{/* Título del form — solo desktop */}`:
```tsx
{/* Título del form — solo desktop */}
<div className="hidden md:block mb-8">
  <h1 className="text-4xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
    Bienvenido
  </h1>
  <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
</div>
```

Reemplazarlo por:
```tsx
{/* Título del form — solo desktop */}
<div className="hidden md:block mb-8">
  <h1 className="text-4xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
    {mode === 'forgot' ? 'Recuperar contraseña' : 'Bienvenido'}
  </h1>
  <div className="h-0.5 w-10 bg-yellow-500 rounded-full" />
</div>
```

- [ ] **Step 8: Envolver el campo de contraseña para que desaparezca en modo `'forgot'`**

Localizar el bloque `{/* Password */}` (empieza con `<div>` y contiene el `<label>Contraseña`):
```tsx
{/* Password */}
<div>
  <label ...>Contraseña...</label>
  <input type="password" ... />
  {passwordError && ...}
</div>
```

Envolverlo en un condicional:
```tsx
{mode !== 'forgot' && (
  <div>
    <label ...>Contraseña...</label>
    <input type="password" ... />
    {passwordError && ...}
  </div>
)}
```

- [ ] **Step 9: Agregar el contenido del modo `'forgot'` al form**

El spec establece este orden en modo forgot: (1) "← Volver al login", (2) descripción, (3) email, (4) submit. Por lo tanto el bloque de back link y descripción va al **inicio del form**, ANTES de los tabs (que ya están envueltos en el condicional `{mode !== 'forgot' && ...}` del paso anterior).

Insertar este bloque como PRIMER elemento dentro de `<form>`, antes de los tabs:

```tsx
{mode === 'forgot' && (
  <div className="space-y-4">
    {/* Volver al login */}
    <button
      type="button"
      onClick={() => {
        setMode('login')
        setEmail('')
        setPassword('')
        setError(null)
        setMessage(null)
        setPasswordError(null)
      }}
      className="text-slate-500 text-sm hover:text-slate-700 transition-colors"
    >
      ← Volver al login
    </button>

    {/* Descripción */}
    <p className="text-slate-600 text-sm">
      Ingresa tu email y te enviamos un link para restablecer tu contraseña.
    </p>
  </div>
)}
```

- [ ] **Step 10: Agregar el link "¿Olvidaste tu contraseña?" debajo del campo contraseña**

Dentro del bloque `{mode !== 'forgot' && (...)}` del campo contraseña, después del `{passwordError && ...}`, agregar:

```tsx
{mode === 'login' && (
  <div className="flex justify-end mt-1">
    <button
      type="button"
      onClick={() => {
        setMode('forgot')
        setEmail('')
        setPassword('')
        setError(null)
        setMessage(null)
        setPasswordError(null)
      }}
      className="text-yellow-500 text-sm font-semibold cursor-pointer bg-transparent border-none p-0 hover:text-yellow-600 transition-colors"
    >
      ¿Olvidaste tu contraseña?
    </button>
  </div>
)}
```

- [ ] **Step 11: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 12: Verificar en navegador**

```bash
npm run dev
```

Verificar:
- Modo login: aparece link "¿Olvidaste tu contraseña?" bajo el campo contraseña (alineado derecha)
- Hacer click → transiciona a modo forgot: desaparecen los tabs, aparece "← Volver al login", desaparece campo contraseña, heading desktop cambia a "Recuperar contraseña"
- Hacer click "← Volver al login" → vuelve al modo login, campos reseteados
- Ingresar email y hacer submit en modo forgot → aparece mensaje de éxito (aunque el email no exista)
- Verificar que login y signup normales siguen funcionando

- [ ] **Step 13: Commit**

```bash
git add app/components/LoginForm.tsx
git commit -m "feat: agregar modo forgot password a LoginForm con link y handler de reset"
```

---

## Chunk 2: Página de nueva contraseña

### Task 3: Crear `app/auth/reset-password/page.tsx`

**Files:**
- Create: `app/auth/reset-password/page.tsx`

Página que recibe el `?code=xxx` de Supabase, intercambia el código por una sesión, y permite al usuario ingresar su nueva contraseña. Usa el mismo layout split que `LoginForm` (panel izquierdo oscuro con imagen + panel derecho blanco).

- [ ] **Step 1: Crear el directorio**

```bash
mkdir -p app/auth/reset-password
```

- [ ] **Step 2: Crear `app/auth/reset-password/page.tsx` con el contenido completo**

```tsx
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
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Verificar build de producción**

```bash
npm run build
```

Esperado: build exitoso. La página `/auth/reset-password` debe aparecer en el output como una ruta estática o dinámica (con Suspense).

- [ ] **Step 5: Configurar Redirect URLs en Supabase Dashboard**

Antes de probar el flujo completo:

1. Ir a Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
2. Agregar (sin trailing slash):
   - `http://localhost:3000/auth/reset-password`
3. Guardar

> ⚠️ Sin este paso, el email de Supabase redirigirá a la URL incorrecta y el `code` no llegará.

- [ ] **Step 6: Verificar flujo completo en navegador**

```bash
npm run dev
```

**Flujo 1 — link inválido:**
- Abrir `http://localhost:3000/auth/reset-password` (sin `?code=`)
- Esperado: pantalla "Link inválido" con botón "Volver al inicio"
- Click "Volver al inicio" → redirige a `/`

**Flujo 2 — flujo completo:**
- Ir a `/` → login → hacer click "¿Olvidaste tu contraseña?" → ingresar email → submit
- Revisar email → click en el link de Supabase
- Debería llegar a `/auth/reset-password?code=xxx` → pantalla muestra "Verificando..." brevemente → luego el form de nueva contraseña
- Ingresar contraseña inválida → ver error de validación en onBlur
- Ingresar contraseña válida + confirmación incorrecta → ver error de confirmación
- Ingresar contraseña válida + confirmación correcta → submit → redirige a `/` (auto-login)

- [ ] **Step 7: Commit**

```bash
git add app/auth/reset-password/page.tsx
git commit -m "feat: agregar página de reset password con flujo PKCE y layout split"
```
