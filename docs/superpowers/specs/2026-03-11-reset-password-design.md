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
                 └─ Mensaje de confirmación: "Te enviamos un email"
                      └─ [Usuario clickea link en email]
                           └─ Supabase redirige a /auth/reset-password?code=xxx
                                └─ Página intercambia el code por sesión (exchangeCodeForSession)
                                     └─ Usuario ingresa nueva contraseña → supabase.auth.updateUser()
                                          └─ Auto-login → redirect a /
```

---

## Componentes

### 1. `LoginForm.tsx` — modificar

**Cambios:**
- Agregar `'forgot'` al type `AuthMode`: `'login' | 'signup' | 'forgot'`
- En modo `'login'`: mostrar link "¿Olvidaste tu contraseña?" debajo del campo contraseña (alineado a la derecha, estilo `text-yellow-500 text-sm font-semibold`)
- En modo `'forgot'`: los tabs de Login/Registro desaparecen; el form muestra:
  - Heading "Recuperar contraseña" + línea amarilla decorativa (mismo patrón que el heading de desktop)
  - Descripción breve: "Ingresa tu email y te enviamos un link para restablecer tu contraseña."
  - Campo email
  - Botón primario "Enviar link de recuperación"
  - Link "← Volver al login" (llama `setMode('login')`)
- Handler `handleForgotPassword`:
  - Llama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth/reset-password' })`
  - Independientemente de si el email existe o no, muestra mensaje de éxito: "Si ese email está registrado, recibirás las instrucciones en breve." (no revelar existencia de cuenta)
  - En caso de error de red o Supabase: mostrar mensaje de error genérico

**No cambia:** el layout split desktop (panel oscuro + panel blanco), la validación de contraseña existente, el flujo de login/signup.

---

### 2. `app/auth/reset-password/page.tsx` — crear (nuevo)

**Layout:** mismo split visual que `LoginForm`:
- Panel izquierdo: fondo `bg-neutral-900` con imagen de gym y overlay, logo GymLogic, tagline — idéntico al panel de `LoginForm`
- Panel derecho: form centrado en `bg-white`

**Estados de la página:**

| Estado | Descripción |
|--------|-------------|
| `loading` | Skeleton mientras se intercambia el code por sesión |
| `invalid` | El code falta o `exchangeCodeForSession` falló — mostrar error + link al login |
| `ready` | Form activo: nueva contraseña + confirmar contraseña |
| `success` | Contraseña actualizada — redirect automático a `/` |

**Lógica al montar (`useEffect`):**
1. Leer `code` de `searchParams`
2. Si no hay `code`: ir a estado `invalid` directamente
3. Llamar `supabase.auth.exchangeCodeForSession(code)`
4. Si error: estado `invalid`
5. Si ok: estado `ready` (la sesión ya está activa)

**Form (estado `ready`):**
- Campo "Nueva contraseña" con validación igual al registro (min 6, 1 mayúscula, 1 número)
- Campo "Confirmar contraseña" — debe coincidir con la nueva
- Botón "Guardar contraseña"
- Al submit: `supabase.auth.updateUser({ password: nuevaContraseña })`
- En éxito: `router.push('/')` (el hook `useAuth` detectará la sesión activa)

**Estado `invalid`:**
- Mensaje: "Este link no es válido o ya expiró."
- Link: "Solicitar nuevo link" → `router.push('/')` (lleva al LoginForm donde podrán pedir otro)

**Validaciones inline:**
- Las contraseñas deben coincidir (validar en `onBlur` del segundo campo)
- Reutilizar la función `validatePassword` existente de `LoginForm`

---

## Configuración Supabase Dashboard

Antes de probar en desarrollo y antes de deploy:

1. **Authentication > URL Configuration > Redirect URLs** — agregar:
   - `http://localhost:3000/auth/reset-password`
   - `https://<tu-dominio-vercel>/auth/reset-password`

2. El email template de "Reset Password" de Supabase ya está configurado por defecto — no requiere cambios.

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Email no registrado | Mostrar mismo mensaje de éxito (no revelar si la cuenta existe) |
| Link expirado o inválido | Estado `invalid` en `/auth/reset-password` con link para solicitar nuevo |
| Contraseñas no coinciden | Validación inline antes de enviar (no llega al servidor) |
| Error de red al enviar email | Mensaje: "Ocurrió un error. Intenta nuevamente." |
| Error al actualizar contraseña | Mensaje de error genérico en el form |

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `app/components/LoginForm.tsx` | Modificar — agregar modo `'forgot'` y link |
| `app/auth/reset-password/page.tsx` | Crear — página nueva con layout split |

---

## Fuera de alcance

- Rate limiting en el endpoint de reset (Supabase lo maneja internamente)
- Email templates personalizados (usar el default de Supabase)
- Magic link / OAuth (no está en el alcance de esta funcionalidad)
