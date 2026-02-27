# Critical Issues Pre-Producción — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver los 5 issues críticos detectados en la auditoría pre-producción para que GymLogic pueda lanzarse de forma segura en Vercel.

**Architecture:** Fixes quirúrgicos en archivos existentes — sin nuevas dependencias externas. El rate limiting se migra a una solución basada en Supabase (ya disponible) para que funcione en serverless multi-instancia.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + Auth), OpenAI SDK, Tailwind CSS v4

---

## Orden de ejecución

| # | Issue | Dificultad | Archivo principal |
|---|-------|-----------|-------------------|
| 1 | C4: Limpiar env.example | Trivial | `env.example` |
| 2 | C1: Bug de ordenación de hooks | Simple | `app/rutinas/page.tsx` |
| 3 | I7: Console.log con email del usuario | Simple | `lib/hooks/useAuth.ts` |
| 4 | I1: readFileSync a nivel de módulo | Simple | `app/api/chat/route.ts` |
| 5 | I3+I4: Validar inputs del config | Moderado | `app/api/generar-rutina/route.ts` |
| 6 | C3: Rate limiter serverless-compatible | Moderado | `lib/rate-limit.ts` + ambas rutas |
| 7 | C5: Documentar decisión email bypass | Trivial | `app/components/LoginForm.tsx` |
| 8 | C2: Verificar y documentar RLS | Manual | Supabase Dashboard + `CLAUDE.md` |

---

### Task 1: Limpiar SUPABASE_SERVICE_ROLE_KEY de env.example

**Contexto:** La clave `SUPABASE_SERVICE_ROLE_KEY` está en `env.example` pero nunca se usa en el código. Deja confusión y riesgo si alguien la referencia en código futuro sin saber que bypassea RLS.

**Files:**
- Modify: `env.example`

**Step 1: Eliminar la línea de SUPABASE_SERVICE_ROLE_KEY**

En `env.example`, cambiar el bloque de Supabase de:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

A:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 2: Verificar que no se usa en ningún lado**

```bash
grep -r "SUPABASE_SERVICE_ROLE_KEY" . --include="*.ts" --include="*.tsx" --include="*.js"
```
Expected: sin resultados (o solo en `.env.local` del usuario, que está en .gitignore)

**Step 3: Commit**

```bash
git add env.example
git commit -m "chore: eliminar SUPABASE_SERVICE_ROLE_KEY no utilizada de env.example"
```

---

### Task 2: Fix C1 — Reordenar useCallback antes del useEffect que lo llama

**Contexto:** En `app/rutinas/page.tsx`, el `useEffect` en línea 50 llama a `loadRutina()` (línea 58), pero `loadRutina` se declara como `useCallback` en la línea 61. Además el useEffect omite `loadRutina` y `router` de sus dependencias.

**Files:**
- Modify: `app/rutinas/page.tsx:50-77`

**Step 1: Mover la declaración de loadRutina antes del useEffect**

El bloque actual (líneas 49-77) debe quedar en este orden:

```typescript
// Cargar rutina cuando el usuario está autenticado
const loadRutina = useCallback(async () => {
  if (!userId) return

  setLoadingRutina(true)
  const resultado = await obtenerRutinaEditable(supabase, userId)

  if (resultado.success && resultado.data) {
    setRutinaData(resultado.data)
  } else {
    setRutinaData(null)
    if (resultado.error && resultado.error !== 'No se encontró ninguna rutina') {
      toast.error(resultado.error)
    }
  }

  setLoadingRutina(false)
}, [userId, supabase])

useEffect(() => {
  if (loadingAuth) return

  if (!authenticated || !userId) {
    router.push('/')
    return
  }

  loadRutina()
}, [loadingAuth, authenticated, userId, loadRutina, router])
```

Cambios clave:
1. `loadRutina` se declara ANTES del `useEffect`
2. El array de dependencias del `useEffect` ahora incluye `loadRutina` y `router`

**Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: Build exitoso sin errores de TypeScript

**Step 3: Commit**

```bash
git add app/rutinas/page.tsx
git commit -m "fix: corregir ordenación de useCallback loadRutina antes del useEffect"
```

---

### Task 3: Eliminar console.log con email del usuario

**Contexto:** `lib/hooks/useAuth.ts` loguea el email del usuario autenticado en cada cambio de estado de auth. Esto es una fuga de PII (datos personales) visible a cualquiera que abra DevTools.

**Files:**
- Modify: `lib/hooks/useAuth.ts:22-26`

**Step 1: Eliminar las líneas de console.log**

Cambiar el bloque del `useEffect` de:
```typescript
useEffect(() => {
  console.log('🚀 useAuth: Iniciando listener de autenticación')

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('👤 useAuth:', event, session?.user?.email || 'sin sesión')

    if (session?.user) {
```

A:
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
```

**Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: Build exitoso

**Step 3: Commit**

```bash
git add lib/hooks/useAuth.ts
git commit -m "fix: eliminar console.log con email del usuario (PII leak)"
```

---

### Task 4: Fix I1 — Mover readFileSync dentro del handler en chat/route.ts

**Contexto:** En `app/api/chat/route.ts` líneas 11-14, el system prompt se lee con `readFileSync` a nivel de módulo (fuera del handler). En Vercel serverless, el working directory en tiempo de inicialización del módulo no está garantizado, lo que puede causar un crash de startup que dejará el chat API permanentemente caído.

**Files:**
- Modify: `app/api/chat/route.ts`

**Step 1: Mover readFileSync dentro del POST handler y el OpenAI client al módulo**

El archivo actual tiene:
- `SYSTEM_PROMPT` (readFileSync) a nivel de módulo — líneas 11-14
- `openai` client creado dentro del handler — líneas 87-89

El resultado correcto es el inverso:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatMessage } from '@/lib/types/chat'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { trackEventServer, trackErrorServer } from '@/lib/analytics-server'
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'

// Cliente OpenAI a nivel de módulo (consistente con generar-rutina/route.ts)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MODEL = 'gpt-4o-mini'
const GENERIC_CHAT_ERROR = 'No se pudo procesar tu mensaje. Intenta de nuevo en unos momentos.'

export async function POST(request: NextRequest) {
  let userId: string | null = null

  // Leer system prompt dentro del handler (seguro en Vercel serverless)
  const SYSTEM_PROMPT = readFileSync(
    join(process.cwd(), 'lib', 'prompts', 'system-prompt.txt'),
    'utf-8'
  ).trim()

  try {
    // ... resto del handler igual
```

Cambios clave:
1. `openai` client sube al módulo (como en `generar-rutina/route.ts`)
2. `SYSTEM_PROMPT` baja dentro del handler
3. Eliminar la inicialización de `openai` que estaba en las líneas 87-89 dentro del handler

**Step 2: Verificar que el build pasa**

```bash
npm run build
```
Expected: Build exitoso

**Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "fix: mover readFileSync dentro del handler para compatibilidad con Vercel serverless"
```

---

### Task 5: Fix I3 + I4 — Validar inputs de config contra allowlists

**Contexto:** Los campos `config.enfoque`, `config.genero`, `config.ubicacion` se incluyen directamente en el prompt de OpenAI vía `JSON.stringify(config)` sin validar su contenido. Un usuario malicioso puede enviar strings arbitrarios para intentar prompt injection. Además, `frecuencia` no tiene validación de rango (puede llegar 99 o -1).

**Files:**
- Modify: `app/api/generar-rutina/route.ts:57-71`

**Step 1: Agregar constantes de allowlist y función de validación**

Agregar después de las imports, antes de la función `buildUserPrompt`:

```typescript
const VALORES_VALIDOS = {
  genero: ['masculino', 'femenino', 'otro'] as const,
  ubicacion: ['gimnasio', 'casa', 'ambos'] as const,
  enfoque: ['pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'core', 'fullbody', 'upper', 'lower', 'push', 'pull', 'cardio'] as const,
  frecuencia: { min: 3, max: 6 },
}

function validarConfig(config: GenerarRutinaRequest['config']): string | null {
  if (typeof config.frecuencia !== 'number' ||
      config.frecuencia < VALORES_VALIDOS.frecuencia.min ||
      config.frecuencia > VALORES_VALIDOS.frecuencia.max) {
    return `Frecuencia inválida: debe ser entre ${VALORES_VALIDOS.frecuencia.min} y ${VALORES_VALIDOS.frecuencia.max}`
  }
  if (config.genero && !VALORES_VALIDOS.genero.includes(config.genero as never)) {
    return 'Género inválido'
  }
  if (config.ubicacion && !VALORES_VALIDOS.ubicacion.includes(config.ubicacion as never)) {
    return 'Ubicación inválida'
  }
  if (config.enfoque && !VALORES_VALIDOS.enfoque.includes(config.enfoque as never)) {
    return 'Enfoque muscular inválido'
  }
  return null
}
```

**Step 2: Reemplazar la validación existente**

Cambiar el bloque actual (líneas 57-61):
```typescript
const config = body?.config as GenerarRutinaRequest['config'] | undefined
if (!config || typeof config !== 'object' || typeof config.frecuencia !== 'number') {
  return NextResponse.json({ error: 'Configuración de rutina inválida' }, { status: 400 })
}
```

Por:
```typescript
const config = body?.config as GenerarRutinaRequest['config'] | undefined
if (!config || typeof config !== 'object') {
  return NextResponse.json({ error: 'Configuración de rutina inválida' }, { status: 400 })
}

const configError = validarConfig(config)
if (configError) {
  return NextResponse.json({ error: 'Configuración de rutina inválida' }, { status: 400 })
}
```

Nota: No exponer `configError` al cliente — siempre retornar mensaje genérico.

**Step 3: Verificar tipos con TypeScript**

```bash
npm run build
```
Expected: Build exitoso sin errores de tipo

**Step 4: Revisar el type de GenerarRutinaRequest para saber los campos exactos**

```bash
grep -r "GenerarRutinaRequest" lib/types/ --include="*.ts" -A 20
```
Ajustar los allowlists según los valores reales del tipo antes de commitear.

**Step 5: Commit**

```bash
git add app/api/generar-rutina/route.ts
git commit -m "fix: agregar allowlist de validación en config de generar-rutina (prevenir prompt injection)"
```

---

### Task 6: Fix C3 — Rate limiter compatible con Vercel serverless

**Contexto:** El `Map` en memoria de `lib/rate-limit.ts` no persiste entre instancias serverless de Vercel, haciendo que el rate limit sea inefectivo en producción.

**Solución:** Sin agregar dependencias externas, usar Supabase para el rate limit de generación de rutinas (consultar la tabla `rutinas` por `created_at` reciente). Para el chat, el rate limit in-memory se mantiene como protección best-effort de UX dado que es de baja criticidad económica.

**Files:**
- Modify: `app/api/generar-rutina/route.ts` (reemplazar llamada a checkRateLimit)
- Keep: `lib/rate-limit.ts` (se sigue usando para chat como best-effort)

**Step 1: En generar-rutina/route.ts, reemplazar el checkRateLimit por consulta a Supabase**

Cambiar el bloque de rate limit (líneas 63-71):
```typescript
// Rate limit
const { limit, windowMs } = RATE_LIMIT.GENERAR_RUTINA
const rate = checkRateLimit(`generar-rutina:${userId}`, limit, windowMs)
if (!rate.allowed) {
  return NextResponse.json(
    { error: 'Has alcanzado el límite de generación. Espera un minuto antes de intentar de nuevo.' },
    { status: 429 }
  )
}
```

Por:
```typescript
// Rate limit basado en Supabase (funciona en serverless multi-instancia)
const unMinutoAtras = new Date(Date.now() - 60_000).toISOString()
const { count: rutinasRecientes, error: rateLimitError } = await supabase
  .from('rutinas')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', unMinutoAtras)

if (!rateLimitError && (rutinasRecientes ?? 0) >= 2) {
  return NextResponse.json(
    { error: 'Has alcanzado el límite de generación. Espera un minuto antes de intentar de nuevo.' },
    { status: 429 }
  )
}
```

**Step 2: Eliminar el import de checkRateLimit en generar-rutina/route.ts (si ya no se usa)**

```typescript
// Eliminar esta línea si ya no se usa en el archivo:
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'
```

Verificar que `RATE_LIMIT` tampoco se use en otro lugar del archivo antes de eliminar.

**Step 3: Agregar un comentario explicativo en rate-limit.ts**

En `lib/rate-limit.ts`, actualizar el comentario inicial:
```typescript
/**
 * Rate limiter in-memory (best-effort para entornos single-instance).
 *
 * IMPORTANTE: Este limiter NO es confiable en Vercel serverless (multi-instancia).
 * - Para /api/generar-rutina: se usa un rate limit basado en Supabase (ver route.ts)
 * - Para /api/chat: este limiter se usa como protección de UX best-effort.
 *   Para rate limiting robusto en chat, migrar a Vercel KV o Upstash Redis.
 */
```

**Step 4: Verificar build**

```bash
npm run build
```
Expected: Build exitoso

**Step 5: Commit**

```bash
git add app/api/generar-rutina/route.ts lib/rate-limit.ts
git commit -m "fix: migrar rate limit de generar-rutina a Supabase para compatibilidad serverless"
```

---

### Task 7: Documentar decisión de email bypass (C5)

**Contexto:** `LoginForm.tsx` permite el login aunque el email no esté confirmado. Es una decisión de producto intencional pero no documentada, lo que genera riesgo de que alguien la "corrija" en el futuro sin entender las implicaciones.

**Files:**
- Modify: `app/components/LoginForm.tsx` (solo comentarios)

**Step 1: Agregar comentario explícito en el bloque del bypass**

Buscar el bloque donde se maneja `Email not confirmed` (alrededor de las líneas 31-37 y 162-180) y agregar:

```typescript
// DECISIÓN DE PRODUCTO (intencional): No requerimos confirmación de email.
// Razón: Reducir fricción en el onboarding. Los usuarios pueden usar la app
// inmediatamente después de registrarse sin esperar el email de confirmación.
// Implicación de seguridad conocida: permite registrar emails ajenos sin verificación.
// Si se quiere cambiar, activar email verification en Supabase Dashboard:
//   Authentication > Email > "Enable email confirmations"
// y eliminar este bypass.
```

**Step 2: Commit**

```bash
git add app/components/LoginForm.tsx
git commit -m "docs: documentar decisión intencional de bypass de email confirmation"
```

---

### Task 8: Verificar y documentar RLS de Supabase (C2) — MANUAL

**Contexto:** Todo el service layer (`rutina-service.ts`) depende de que Supabase Row Level Security (RLS) esté activo en las tablas correspondientes. Si RLS está desactivado, cualquier usuario autenticado puede leer/modificar datos de otros usuarios.

**Este task NO es código — es verificación en el dashboard de Supabase.**

**Step 1: Ir al Dashboard de Supabase → Table Editor → Authentication Policies**

Para cada tabla, verificar que RLS está habilitado (toggle "Enable RLS" activo):
- `rutinas`
- `rutina_dias`
- `rutina_ejercicios`
- `user_events`
- `ejercicios` (read-only para usuarios, no debería tener políticas de escritura)

**Step 2: Verificar que existen policies correctas**

Para `rutinas`, las policies mínimas son:
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

Repetir para `rutina_dias` y `rutina_ejercicios` (que tienen relación con `rutinas.user_id` vía join).

Para `rutina_dias` y `rutina_ejercicios`, la policy puede requerir un join:
```sql
-- Ejemplo para rutina_dias (verificar con el esquema real)
CREATE POLICY "Users can only access their own rutina_dias"
ON rutina_dias
FOR ALL
USING (
  rutina_id IN (
    SELECT id FROM rutinas WHERE user_id = auth.uid()
  )
);
```

**Step 3: Documentar en CLAUDE.md**

Agregar en la sección de Supabase:
```markdown
### Row Level Security (RLS)
RLS verificado y activo en producción para: `rutinas`, `rutina_dias`, `rutina_ejercicios`, `user_events`.
Las policies garantizan que cada usuario solo accede a sus propios datos.
El service layer (`rutina-service.ts`) asume RLS activo — no hace ownership checks a nivel de aplicación.
```

**Step 4: Commit de la documentación**

```bash
git add CLAUDE.md
git commit -m "docs: documentar estado de RLS en Supabase y dependencia del service layer"
```

---

## Checklist final pre-deploy

Antes de hacer `git push` al main y triggerear el deploy en Vercel:

- [ ] Task 1 ✅ `SUPABASE_SERVICE_ROLE_KEY` eliminada de `env.example`
- [ ] Task 2 ✅ `loadRutina` declarada antes del `useEffect`
- [ ] Task 3 ✅ `console.log` con email eliminado de `useAuth.ts`
- [ ] Task 4 ✅ `readFileSync` dentro del handler en `chat/route.ts`
- [ ] Task 5 ✅ Config de rutina validada contra allowlists
- [ ] Task 6 ✅ Rate limit de rutinas usa Supabase
- [ ] Task 7 ✅ Decisión de email bypass documentada en código
- [ ] Task 8 ✅ RLS verificado en Supabase Dashboard y documentado
- [ ] `npm run build` pasa sin errores
- [ ] Variables de entorno configuradas en Vercel Dashboard
