# Reset Password — Design Spec

**Date:** 2026-03-11
**App:** GymLogic (Next.js 16 App Router + Supabase Auth)
**Status:** Approved

---

## Objetivo

Permitir que usuarios que olvidaron su contraseña puedan restablecerla vía email, sin interrumpir el flujo de autenticación existente.

---

## Flujo completo

```
LoginForm (modo login)
  └─ Link "¿Olvidaste tu contraseña?" bajo el campo contraseña
       └─ LoginForm transiciona a modo 'forgot'
            └─ Usuario ingresa email → supabase.auth.resetPasswordForEmail()
                 └─ Mensaje de confirmación en pantalla
                      └─ [Usuario clickea link en email]
                           └─ Supabase redirige a /auth/reset-password?code=xxx
                                └─ Página intercambia el code por sesión (exchangeCodeForSession)
                                     └─ Usuario ingresa nueva contraseña → supabase.auth.updateUser()
                                          └─ Auto-login → redirect a /
```

---

## Componentes

### 1. `lib/utils/validaciones.ts` — crear (nuevo, hacer primero)

Extraer `validatePassword` de `LoginForm.tsx` a un módulo compartido para que pueda ser importada por ambas páginas:

```ts
export const validatePassword = (password: string): { valid: boolean; message: string } => {
  // misma lógica que hoy existe en LoginForm.tsx líneas 9-23
}
```

Ambos `LoginForm.tsx` y `app/auth/reset-password/page.tsx` importarán desde aquí. Eliminar la definición local de `LoginForm.tsx`.

---

### 2. `LoginForm.tsx` — modificar

**Imports a actualizar:**
- Agregar `useMemo` a la importación de React: `import { useState, useMemo } from 'react'`
- Agregar import de `validatePassword`: `import { validatePassword } from '@/lib/utils/validaciones'`
- Eliminar la definición local de `validatePassword`

**Cambios de estado y tipos:**
- Memoizar el cliente Supabase: cambiar `const supabase = createClient()` por `const supabase = useMemo(() => createClient(), [])` (convención obligatoria del proyecto, actualmente violada en este archivo)
- Agregar `'forgot'` al type `AuthMode`: `type AuthMode = 'login' | 'signup' | 'forgot'`

**Transición al modo forgot:**
- Al clickear el link "¿Olvidaste tu contraseña?": llamar a `setMode('forgot')` y también resetear `setEmail('')`, `setPassword('')`, `setError(null)`, `setMessage(null)`, `setPasswordError(null)`
- Al clickear "← Volver al login": llamar a `setMode('login')` y también resetear los mismos states

**En modo `'login'`:** mostrar link "¿Olvidaste tu contraseña?" debajo del campo contraseña (alineado a la derecha). Usar `<button type="button">` para que sea accesible con teclado. Estilo: `text-yellow-500 text-sm font-semibold cursor-pointer bg-transparent border-none p-0`

**Tabs de Login/Registro:** envolver el `<div className="flex gap-2">` de los tabs en `{mode !== 'forgot' && (...)}` para que desaparezcan en modo forgot.

**Heading desktop "Bienvenido":** el bloque `hidden md:block` existente muestra "Bienvenido" en todos los modos. En modo `'forgot'` debe mostrar "Recuperar contraseña" en su lugar. Implementar con condicional: `{mode === 'forgot' ? <h1>Recuperar contraseña</h1> : <h1>Bienvenido</h1>}` (manteniendo el mismo estilo y la línea decorativa amarilla).

**En modo `'forgot'`:** la sección del form muestra (en este orden):
  1. `<button type="button">` "← Volver al login" (estilo `text-slate-500 text-sm`, arriba del todo)
  2. Heading "Recuperar contraseña" + línea amarilla decorativa (mismo patrón que el heading desktop existente)
  3. Párrafo breve: "Ingresa tu email y te enviamos un link para restablecer tu contraseña."
  4. Campo email (el mismo campo existente del form)
  5. Botón submit "Enviar link"
  - El campo de contraseña **no se renderiza** en modo `'forgot'` (renderizado condicional: `{mode !== 'forgot' && <div>...campo contraseña...</div>}`)
  - Bloque móvil de logo (`md:hidden`) igual que en los otros modos — no desaparece
  - El form usa `onSubmit={handleSubmit}` igual que siempre; `handleSubmit` gana un branch para `mode === 'forgot'`

**Cambios en `handleSubmit`:** agregar branch al inicio del bloque `try`:
```ts
if (mode === 'forgot') {
  await handleForgotPassword()
  return
}
// ... resto del código existente sin cambios
```

**Handler `handleForgotPassword` (función separada, llamada desde `handleSubmit`):**
- Estructura: `setLoading(true)` al inicio, `try/finally` con `setLoading(false)` en el `finally` para garantizar que el botón siempre vuelve a habilitarse
- Llama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth/reset-password' })`
  - Nota: la URL en `redirectTo` debe coincidir exactamente (sin trailing slash) con la entrada en Supabase Dashboard > Redirect URLs
- Independientemente de si el email existe o no, mostrar mensaje de éxito usando el state `message` existente: `"Si ese email está registrado, recibirás las instrucciones en breve."`
- En caso de error de red o Supabase: usar el state `error` existente con mensaje genérico

**Botón submit en modo `'forgot'`:**
- Label: actualizar el ternario existente para cubrir el nuevo modo: `mode === 'login' ? 'Iniciar Sesión' : mode === 'signup' ? 'Crear Cuenta' : 'Enviar link'`
- Label loading: `loading ? 'Enviando...' : <label normal>` — solo en modo forgot, los otros modos siguen mostrando 'Cargando...'
- Deshabilitado mientras `loading`

**No cambia:** el layout split desktop (panel oscuro + panel blanco), el flujo de login/signup, la validación de contraseña en signup.

---

### 3. `app/auth/reset-password/page.tsx` — crear (nuevo)

**Directiva:** `'use client'`

**Imports necesarios:**
```ts
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validatePassword } from '@/lib/utils/validaciones'
```

**Estructura del archivo — dos componentes:**

El archivo exporta un componente padre que envuelve el componente interno en `<Suspense>` (requerido por Next.js cuando se usa `useSearchParams`):

```tsx
function ResetPasswordForm() {
  // toda la lógica aquí
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-slate-500">Verificando...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
```

**Dentro de `ResetPasswordForm`:**

Supabase client: `const supabase = useMemo(() => createClient(), [])`

Lectura del code: `const searchParams = useSearchParams(); const code = searchParams.get('code')`

**Estados del componente:**
```ts
type PageState = 'loading' | 'invalid' | 'ready'
const [pageState, setPageState] = useState<PageState>('loading')
```
Estados adicionales: `password`, `confirmPassword`, `passwordError`, `confirmError`, `error`, `submitting`

**Lógica al montar (`useEffect`):**
```ts
useEffect(() => {
  if (!code) {
    setPageState('invalid')
    return
  }
  ;(async () => {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      setPageState('invalid')
    } else {
      setPageState('ready')
    }
  })()
}, [code, supabase])
```
Notas:
- Usar IIFE async `(async () => { ... })()` dentro del `useEffect` — no hacer el callback del `useEffect` directamente async.
- PKCE debe estar habilitado en Supabase Dashboard (es el default para proyectos nuevos). Si se deshabilita, el `code` no llegará en la query string y el flujo fallará silenciosamente.
- **React Strict Mode (dev):** el `useEffect` se ejecuta dos veces. El segundo `exchangeCodeForSession` fallará con error y sobreescribirá `pageState` a `'invalid'`, rompiendo la página en dev. Proteger con un `useRef`:
  ```ts
  const exchanged = useRef(false)
  useEffect(() => {
    if (!code) { setPageState('invalid'); return }
    if (exchanged.current) return
    exchanged.current = true
    ;(async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      setPageState(error ? 'invalid' : 'ready')
    })()
  }, [code, supabase])
  ```

**UI según `pageState`:**

- `'loading'`: mostrar el layout split completo pero el panel derecho muestra solo un texto centrado "Verificando..." con el logo GymLogic
- `'invalid'`: panel derecho muestra mensaje de error "Este link no es válido o ya expiró." + botón "Volver al inicio" → `router.push('/')`
- `'ready'`: panel derecho muestra el form de nueva contraseña

**Layout (igual para los tres estados):** mismo split visual que `LoginForm`:
- Panel izquierdo: `bg-neutral-900` con imagen de gym (`/images/gym-bg.jpg`), overlay `bg-neutral-900/65`, logo GymLogic y tagline — markup idéntico al panel de `LoginForm`
- Panel derecho: `bg-white`, contenido centrado
- Bloque móvil de logo (`md:hidden`): mismo que `LoginForm`, encima del contenido del panel derecho

**Form (estado `'ready'`):**
- Campo "Nueva contraseña" (`type="password"`): `validatePassword` en `onBlur` y re-validar antes del submit, error bajo el campo
- Campo "Confirmar contraseña" (`type="password"`): verificar igualdad en `onBlur` (`if (confirmPassword !== password) setConfirmError('Las contraseñas no coinciden')`). No aplicar `validatePassword` al campo de confirmación — solo la comparación de igualdad.
- Al submit: re-validar ambos campos antes de llamar a Supabase (no confiar solo en `onBlur`)
- Botón "Guardar contraseña" (deshabilitado mientras `submitting`, muestra "Guardando..." en ese estado)
- Al submit exitoso: `router.push('/')` inmediatamente (sin mensaje de confirmación intermedio — el redirect es suficiente feedback)
- En error de `updateUser`: mostrar mensaje de error genérico bajo el form

---

## Configuración Supabase Dashboard

Antes de probar en desarrollo y antes de deploy:

1. **Authentication > URL Configuration > Redirect URLs** — agregar (sin trailing slash, debe coincidir exactamente con el `redirectTo` del código):
   - `http://localhost:3000/auth/reset-password`
   - `https://<tu-dominio-vercel>/auth/reset-password`

2. **Authentication > URL Configuration > Site URL** — verificar que esté correctamente configurado (en dev: `http://localhost:3000`, en producción: URL de Vercel). El Site URL afecta cómo Supabase construye los links de email.

3. El email template de "Reset Password" de Supabase ya está configurado por defecto — no requiere cambios.

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Email no registrado | Mostrar mismo mensaje de éxito (no revelar si la cuenta existe) |
| Link expirado o inválido | Estado `invalid` en `/auth/reset-password` con botón "Volver al inicio" |
| Contraseñas no coinciden | Validación inline en `onBlur` antes de enviar |
| Contraseña no cumple requisitos | Validación inline en `onBlur` antes de enviar |
| Error de red al enviar email | Mensaje: "Ocurrió un error. Intenta nuevamente." |
| Error al actualizar contraseña | Mensaje de error genérico en el form |

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `lib/utils/validaciones.ts` | Crear — extraer `validatePassword` como función exportada compartida |
| `app/components/LoginForm.tsx` | Modificar — agregar modo `'forgot'`, link, memoizar Supabase client, importar `validatePassword` |
| `app/auth/reset-password/page.tsx` | Crear — página nueva con layout split y flujo PKCE |

---

## Fuera de alcance

- Rate limiting en el endpoint de reset (Supabase lo maneja internamente)
- Email templates personalizados (usar el default de Supabase)
- Magic link / OAuth (no está en el alcance de esta funcionalidad)
