# Important Issues Pre-Producción — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver los 4 issues "importantes" detectados en la auditoría pre-producción para mayor robustez y seguridad de GymLogic.

**Architecture:** Fixes quirúrgicos sin dependencias nuevas. El chat se cierra a usuarios autenticados únicamente. Los timeouts de OpenAI se configuran a nivel de instancia del SDK. La actualización de ejercicios detecta filas no afectadas.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, OpenAI SDK v6

---

## Issues a resolver

| # | Issue | Archivo principal | Prioridad |
|---|-------|------------------|-----------|
| I5 | Dead code: variable `dia` sin usar en `handleOpenEditModal` | `app/rutinas/page.tsx` | Baja pero fácil |
| I6 | `actualizarEjercicio` no detecta si el UPDATE afectó 0 filas | `lib/services/rutina-service.ts` | Media |
| I8 | Rate limit anónimo en chat usa `x-forwarded-for` spoofeable | `app/api/chat/route.ts` | Alta |
| I9 | Sin timeout en llamadas a OpenAI (puede colgar hasta límite de Vercel) | `app/api/chat/route.ts` + `app/api/generar-rutina/route.ts` | Alta |

---

### Task 1: I5 — Eliminar dead code en handleOpenEditModal

**Contexto:** `handleOpenEditModal` en `app/rutinas/page.tsx` computa `const dia = ...` pero nunca lo usa. Es código muerto que ESLint ya reporta como warning.

**Files:**
- Modify: `app/rutinas/page.tsx:83-91`

**Step 1: Leer el bloque afectado**

Leer `/Users/franciscoojeda/Documents/proyects/nuevoproyecto/app/rutinas/page.tsx` y ubicar la función `handleOpenEditModal` (alrededor de la línea 83).

**Step 2: Eliminar la variable `dia`**

El bloque actual:
```typescript
const handleOpenEditModal = (ejercicio: EjercicioEditable) => {
  const dia = rutinaData?.dias.find(d => d.id === ejercicio.dia_id)
  setModalState({
    isOpen: true,
    mode: 'edit',
    diaId: ejercicio.dia_id,
    ejercicio
  })
}
```

Debe quedar:
```typescript
const handleOpenEditModal = (ejercicio: EjercicioEditable) => {
  setModalState({
    isOpen: true,
    mode: 'edit',
    diaId: ejercicio.dia_id,
    ejercicio
  })
}
```

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: eliminar variable dia sin usar en handleOpenEditModal"
```

---

### Task 2: I6 — Detectar UPDATE sin filas afectadas en actualizarEjercicio

**Contexto:** En `lib/services/rutina-service.ts`, la función `actualizarEjercicio` llama a:
```typescript
const { error: updateError } = await supabase
  .from('rutina_ejercicios')
  .update(updateData)
  .eq('id', datos.id)
```

Si `datos.id` no existe en la tabla (por ejemplo, el ejercicio fue eliminado por otro tab abierto), Supabase no retorna error pero actualiza **0 filas**. La función entonces intenta hacer un `select` del mismo ID que no existe, y falla con el mensaje confuso `"No se pudo obtener el ejercicio actualizado"` en vez de uno claro.

**Solución:** Agregar `.select('id')` al update para que Supabase retorne las filas afectadas, y verificar que al menos 1 fila fue actualizada.

**Files:**
- Modify: `lib/services/rutina-service.ts:166-174`

**Step 1: Leer el bloque afectado**

Leer `/Users/franciscoojeda/Documents/proyects/nuevoproyecto/lib/services/rutina-service.ts` y ubicar el bloque del UPDATE (alrededor de la línea 166).

**Step 2: Agregar .select('id') al update y verificar filas afectadas**

El bloque actual (líneas ~166-174):
```typescript
// Ejecutar actualización
const { error: updateError } = await supabase
  .from('rutina_ejercicios')
  .update(updateData)
  .eq('id', datos.id)

if (updateError) {
  throw updateError
}
```

Debe quedar:
```typescript
// Ejecutar actualización
const { data: filasActualizadas, error: updateError } = await supabase
  .from('rutina_ejercicios')
  .update(updateData)
  .eq('id', datos.id)
  .select('id')

if (updateError) {
  throw updateError
}

if (!filasActualizadas || filasActualizadas.length === 0) {
  return { success: false, error: 'El ejercicio no existe o ya fue eliminado' }
}
```

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso. Si hay error de tipos de TypeScript con `filasActualizadas`, ajustar el tipado según el error.

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/services/rutina-service.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: detectar UPDATE sin filas afectadas en actualizarEjercicio"
```

---

### Task 3: I8 — Requerir autenticación en el chat API y eliminar path anónimo

**Contexto:** `app/api/chat/route.ts` tiene dos paths de rate limiting:
- Usuario autenticado: key = `chat:{userId}` ✅ correcto
- Usuario anónimo: key = `chat:anon:{x-forwarded-for}` ❌ el header `x-forwarded-for` puede ser spoofeable — cualquier atacante puede cambiar este header en cada request y bypassear el rate limit

**Solución:** Requerir autenticación para el chat. `ChatBubble` ya no se renderiza para usuarios no autenticados, por lo que ningún usuario legítimo llega al endpoint sin sesión. Rechazar requests sin sesión con 401 y eliminar la lógica del path anónimo.

**Files:**
- Modify: `app/api/chat/route.ts:22-39`

**Step 1: Leer el bloque afectado**

Leer `/Users/franciscoojeda/Documents/proyects/nuevoproyecto/app/api/chat/route.ts` y ubicar el bloque de sesión y rate limit (líneas 22-39).

**Step 2: Refactorizar para requerir auth**

El bloque actual:
```typescript
let userId: string | null = null

try {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  userId = session?.user?.id || null

  // Rate limit por usuario (o por IP si no hay sesión, usando un fallback)
  const rateKey = userId ? `chat:${userId}` : `chat:anon:${request.headers.get('x-forwarded-for') || 'unknown'}`
  const { limit, windowMs } = RATE_LIMIT.CHAT
  const rate = checkRateLimit(rateKey, limit, windowMs)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Has enviado muchos mensajes. Espera un minuto antes de continuar.' },
      { status: 429 }
    )
  }
```

Debe quedar:
```typescript
let userId: string | null = null

try {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  userId = session?.user?.id || null

  // Requerir autenticación (ChatBubble no se muestra a usuarios no autenticados)
  if (!userId) {
    return NextResponse.json(
      { error: 'Debes iniciar sesión para usar el chat' },
      { status: 401 }
    )
  }

  // Rate limit por usuario autenticado
  const { limit, windowMs } = RATE_LIMIT.CHAT
  const rate = checkRateLimit(`chat:${userId}`, limit, windowMs)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Has enviado muchos mensajes. Espera un minuto antes de continuar.' },
      { status: 429 }
    )
  }
```

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/api/chat/route.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: requerir autenticación en chat API, eliminar rate limit anónimo spoofeable"
```

---

### Task 4: I9 — Agregar timeout a llamadas de OpenAI

**Contexto:** Ni `app/api/chat/route.ts` ni `app/api/generar-rutina/route.ts` configuran un timeout para las llamadas a OpenAI. En Vercel:
- Plan Hobby: timeout de función = 10s
- Plan Pro: timeout de función = 60s (Fluid Compute) o 300s (Pro)

Si OpenAI tarda más que el timeout de Vercel, el usuario recibe un error 504 genérico sin ningún mensaje útil. Configurar un timeout en el SDK permite capturar el error y retornar un mensaje claro.

**Timeouts recomendados:**
- Chat (`gpt-4o-mini`, respuestas cortas): **25 segundos**
- Generar rutina (`gpt-4.1-mini`, JSON complejo): **50 segundos**

El timeout se configura a nivel del **constructor de OpenAI** como opción `timeout` (en milisegundos).

**Files:**
- Modify: `app/api/chat/route.ts:11` (constructor del client OpenAI)
- Modify: `app/api/generar-rutina/route.ts:13` (constructor del client OpenAI)

**Step 1: Leer ambos archivos para ubicar los constructores**

- `/Users/franciscoojeda/Documents/proyects/nuevoproyecto/app/api/chat/route.ts` (línea ~11)
- `/Users/franciscoojeda/Documents/proyects/nuevoproyecto/app/api/generar-rutina/route.ts` (línea ~13)

**Step 2: Agregar timeout en chat/route.ts**

Cambiar:
```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

Por:
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25_000, // 25s — por debajo del límite de Vercel Hobby (10s) y Pro (60s)
})
```

**Step 3: Agregar timeout en generar-rutina/route.ts**

Cambiar:
```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

Por:
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 50_000, // 50s — rutina compleja, requiere más tiempo que el chat
})
```

**Step 4: Verificar que el error de timeout se maneje correctamente**

El SDK de OpenAI lanza `OpenAI.APIConnectionTimeoutError` cuando se excede el timeout. Verificar que el catch genérico en ambos archivos lo captura:

En `chat/route.ts`, el catch existente ya maneja `OpenAI.APIError` (que incluye timeout):
```typescript
const status = error instanceof OpenAI.APIError ? (error.status || 500) : 500
```

En `generar-rutina/route.ts`, el catch genérico retorna `GENERIC_ERROR_MESSAGE` — correcto.

No se necesita lógica adicional. El timeout se captura automáticamente por los catches existentes.

**Step 5: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```
Expected: Build exitoso

**Step 6: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/api/chat/route.ts app/api/generar-rutina/route.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "fix: agregar timeouts a clientes OpenAI (25s chat, 50s rutina)"
```

---

## Checklist final

- [ ] Task 1 ✅ Dead code eliminado en `handleOpenEditModal`
- [ ] Task 2 ✅ `actualizarEjercicio` detecta 0 filas afectadas
- [ ] Task 3 ✅ Chat API requiere autenticación — path anónimo eliminado
- [ ] Task 4 ✅ Timeouts configurados en ambos clientes OpenAI
- [ ] `npm run build` pasa sin errores
