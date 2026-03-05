# Important Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver 7 issues importantes identificados en la CTO review: rendimiento, estabilidad, UX y seguridad.

**Architecture:** Fixes independientes, ordenados de menor a mayor complejidad. Cada task toca uno o dos archivos. No hay tests automatizados — la verificación es manual (lint + build + prueba en dev).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS client, React hooks

---

## Contexto

Los 7 issues vienen de la CTO review del 2026-03-04. Los críticos (IDOR) ya fueron resueltos. Estos son los "importantes": correctness bugs, pequeños riesgos de seguridad y mejoras de robustez.

**Archivos clave:**
- `lib/hooks/useAuth.ts` — hook de autenticación
- `app/api/chat/route.ts` — handler POST del chat
- `app/api/generar-rutina/route.ts` — handler POST de generación de rutina
- `app/entrenar/[sesionId]/page.tsx` — sesión activa de entrenamiento
- `app/rutinas/page.tsx` — pantalla de gestión de rutina
- `lib/services/sesion-service.ts` — service layer para sesiones

---

### Task 1: Mover `readFileSync` a scope de módulo (Issues 7)

**Problema:** `app/api/chat/route.ts:21` y `app/api/generar-rutina/route.ts:111` llaman `readFileSync(...)` dentro del handler POST. Esto lee el archivo desde disco en **cada request**. En Vercel serverless, el módulo se mantiene "caliente" entre requests — mover la lectura a nivel de módulo la hace ocurrir solo al inicio del cold start.

**Files:**
- Modify: `app/api/chat/route.ts:1-25`
- Modify: `app/api/generar-rutina/route.ts:1-15, 110-115`

**Step 1: Editar `app/api/chat/route.ts`**

Mover la lectura del system prompt de dentro de `POST` a nivel de módulo, junto con las otras constantes:

```typescript
// ANTES (línea 21, dentro de POST):
export async function POST(request: NextRequest) {
  const SYSTEM_PROMPT = readFileSync(
    join(process.cwd(), 'lib', 'prompts', 'system-prompt.txt'),
    'utf-8'
  ).trim()
  // ...
}

// DESPUÉS (línea ~16, nivel de módulo, junto a MODEL y GENERIC_CHAT_ERROR):
const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'lib', 'prompts', 'system-prompt.txt'),
  'utf-8'
).trim()

export async function POST(request: NextRequest) {
  // SYSTEM_PROMPT ya disponible, no leer aquí
  // ...
}
```

Eliminar las líneas del `readFileSync` dentro de `POST` y eliminar el comentario `// Leer system prompt dentro del handler (seguro en Vercel serverless)`.

**Step 2: Editar `app/api/generar-rutina/route.ts`**

Igual que el paso anterior, mover la lectura del prompt a nivel de módulo:

```typescript
// ANTES (línea 110-114, dentro de POST):
// 2. Leer system prompt
const systemPrompt = readFileSync(
  join(process.cwd(), 'lib/prompts/system-prompt-rutina.txt'),
  'utf-8'
)

// DESPUÉS (nivel de módulo, línea ~16, junto a GENERIC_ERROR_MESSAGE):
const SYSTEM_PROMPT_RUTINA = readFileSync(
  join(process.cwd(), 'lib/prompts/system-prompt-rutina.txt'),
  'utf-8'
)
```

Luego en `POST`, reemplazar `systemPrompt` por `SYSTEM_PROMPT_RUTINA` (línea ~121 en el `openai.chat.completions.create`):
```typescript
{ role: 'system', content: SYSTEM_PROMPT_RUTINA },
```

Y eliminar el bloque `// 2. Leer system prompt` con el `readFileSync` de dentro del handler.

**Step 3: Verificar**

```bash
npm run lint
npm run build
```

Esperado: sin errores ni warnings nuevos.

**Step 4: Commit**

```bash
git add app/api/chat/route.ts app/api/generar-rutina/route.ts
git commit -m "perf: mover readFileSync a scope de módulo en rutas de API"
```

---

### Task 2: `useMemo` para `createClient()` en `useAuth` (Issue 8)

**Problema:** `lib/hooks/useAuth.ts:20` crea `const supabase = createClient()` en el cuerpo del hook, sin memoización. Cada render del componente crea una nueva instancia del cliente Supabase. Esto hace que `supabase.auth` sea una nueva referencia en cada render, lo que re-dispara el `useEffect` de `onAuthStateChange` en cada render, creando y destruyendo la subscripción constantemente.

**Files:**
- Modify: `lib/hooks/useAuth.ts:1-10, 20, 35, 54`

**Step 1: Agregar `useMemo` al import**

Línea 3 actual:
```typescript
import { useState, useEffect, useCallback } from 'react'
```

Cambiar a:
```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'
```

**Step 2: Wrappear `createClient()` con `useMemo`**

Línea 20 actual:
```typescript
const supabase = createClient()
```

Cambiar a:
```typescript
const supabase = useMemo(() => createClient(), [])
```

**Step 3: Actualizar la dependencia del `useEffect`**

Línea 35 actual:
```typescript
  }, [supabase.auth])
```

Cambiar a:
```typescript
  }, [supabase])
```

La referencia a `supabase` es ahora estable (memoizada), así que `supabase.auth` también es estable. Usar `supabase` directamente como dependencia es más correcto.

**Step 4: Verificar**

```bash
npm run lint
npm run build
```

Esperado: sin errores. Verificar manualmente en dev que el login/logout sigue funcionando.

**Step 5: Commit**

```bash
git add lib/hooks/useAuth.ts
git commit -m "fix: memoizar cliente Supabase en useAuth para evitar re-subscripciones"
```

---

### Task 3: Eliminar `completada` de `handleBlur` (Issue 6)

**Problema:** `app/entrenar/[sesionId]/page.tsx:73-92` — `handleBlur` guarda `completada: serie.completada` junto con `peso_kg` y `repeticiones`. Si el usuario ingresa un peso, hace tap en el checkbox (toggle completada), y luego el blur del input se dispara, `handleBlur` sobrescribe el `completada` recién guardado por `handleToggleCompletada` con el valor previo (race condition).

`handleBlur` solo debe guardar `peso_kg` y `repeticiones`. El campo `completada` solo debe guardarse desde `handleToggleCompletada`.

**Files:**
- Modify: `app/entrenar/[sesionId]/page.tsx:73-92`

**Step 1: Actualizar `handleBlur` para no pasar `completada`**

Bloque actual (líneas ~78-91):
```typescript
  const handleBlur = useCallback((serieId: string, ejId: string) => {
    setSesion(prev => {
      if (!prev) return prev
      const ej = prev.ejercicios.find(e => e.rutina_ejercicio_id === ejId)
      const serie = ej?.series.find(s => s.id === serieId)
      if (serie) {
        // Fire-and-forget auto-save — fuera del loop de render para evitar doble ejecución en Strict Mode
        Promise.resolve().then(() => {
          actualizarSerie(supabase, {
            id: serieId,
            sesionId,
            peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
            repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
            completada: serie.completada,   // ← PROBLEMA: puede ser stale
          })
        })
      }
      return prev
    })
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps
```

El tipo de `actualizarSerie` requiere `completada`. Como `handleBlur` no debe cambiar el estado de `completada`, hay que pasar el valor actual pero asegurarse de que proviene del estado más reciente. La solución es quitar `completada` del UPDATE en `actualizarSerie` cuando el caller es `handleBlur`.

La forma más simple sin cambiar el tipo de `actualizarSerie` es hacer que `handleBlur` pase siempre el valor actual de `completada` desde el estado en el momento del blur (que ya hace), **pero** en la función `actualizarSerie` del service layer, hacer que el UPDATE solo toque los campos de peso/reps cuando `completada` no cambia.

Alternativa más simple: en `handleBlur`, leer `serie.completada` desde el estado en el `Promise.resolve().then()` con una segunda lectura del estado. Sin embargo, lo más limpio es usar una variable de cierre para capturar los valores en el momento del blur (que ya hace correctamente), y simplemente **no incluir `completada` en el objeto del UPDATE**.

La mejor solución es crear un tipo diferenciado o pasar `completada` como `undefined` / opcional. Pero como `actualizarSerie` tiene un tipo fijo, la forma más directa es hacer que el handler pase el flag `soloPesosReps: true` o crear un segundo método.

**La solución más simple y sin over-engineering:** extraer el valor de `completada` del estado **en el mismo ciclo** del `setSesion`, que ya lo hace. El problema real es que si `handleToggleCompletada` llama `actualizarSerie` con `completada: true` y luego (milisegundos después) `handleBlur` llama `actualizarSerie` con `completada: false` (stale del closure), se pisará.

La solución correcta: en `actualizarSerie` del service, hacer el UPDATE solo de `peso_kg` y `repeticiones` cuando se llama desde `handleBlur`. Para esto, cambiar `actualizarSerie` para aceptar `completada` como opcional:

En `lib/services/sesion-service.ts` (línea 256-290), cambiar la firma:

```typescript
// ANTES
serie: {
  id: string
  sesionId: string
  peso_kg: number | null
  repeticiones: number | null
  completada: boolean
}

// DESPUÉS
serie: {
  id: string
  sesionId: string
  peso_kg: number | null
  repeticiones: number | null
  completada?: boolean   // opcional
}
```

Y en el cuerpo del UPDATE, excluir `completada` si es `undefined`:

```typescript
const { error } = await supabase
  .from('sesion_series')
  .update({
    peso_kg: serie.peso_kg,
    repeticiones: serie.repeticiones,
    ...(serie.completada !== undefined && { completada: serie.completada }),
    updated_at: new Date().toISOString(),
  })
  .eq('id', serie.id)
  .eq('sesion_id', serie.sesionId)
```

Luego en `app/entrenar/[sesionId]/page.tsx`, en `handleBlur`, quitar `completada` del objeto:

```typescript
actualizarSerie(supabase, {
  id: serieId,
  sesionId,
  peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
  repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
  // sin completada — solo se guarda desde handleToggleCompletada
})
```

**Files:**
- Modify: `lib/services/sesion-service.ts:256-290`
- Modify: `app/entrenar/[sesionId]/page.tsx:78-92`

**Step 1: Hacer `completada` opcional en `actualizarSerie`**

En `lib/services/sesion-service.ts`, cambiar la definición del tipo del parámetro `serie` (línea ~258-264):

```typescript
// Cambiar:
serie: {
  id: string
  sesionId: string
  peso_kg: number | null
  repeticiones: number | null
  completada: boolean
}

// Por:
serie: {
  id: string
  sesionId: string
  peso_kg: number | null
  repeticiones: number | null
  completada?: boolean
}
```

Y el bloque `.update(...)` (líneas ~270-276):

```typescript
// Cambiar:
.update({
  peso_kg: serie.peso_kg,
  repeticiones: serie.repeticiones,
  completada: serie.completada,
  updated_at: new Date().toISOString(),
})

// Por:
.update({
  peso_kg: serie.peso_kg,
  repeticiones: serie.repeticiones,
  ...(serie.completada !== undefined && { completada: serie.completada }),
  updated_at: new Date().toISOString(),
})
```

**Step 2: Quitar `completada` del call en `handleBlur`**

En `app/entrenar/[sesionId]/page.tsx`, dentro del `Promise.resolve().then(...)` en `handleBlur` (línea ~81-87):

```typescript
// Cambiar:
actualizarSerie(supabase, {
  id: serieId,
  sesionId,
  peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
  repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
  completada: serie.completada,
})

// Por:
actualizarSerie(supabase, {
  id: serieId,
  sesionId,
  peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
  repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
})
```

**Step 3: Verificar**

```bash
npm run lint
npm run build
```

Esperado: sin errores de TypeScript (completada es ahora opcional). Verificar manualmente en dev que al marcar una serie como completada y luego mover el foco, el estado no se revierte.

**Step 4: Commit**

```bash
git add lib/services/sesion-service.ts app/entrenar/[sesionId]/page.tsx
git commit -m "fix: eliminar completada de handleBlur para evitar race condition con toggle"
```

---

### Task 4: Rollback en reordenamiento de ejercicios (Issue 5)

**Problema:** `app/rutinas/page.tsx:91-92` — `handleDragEnd` actualiza el estado local (optimistic update) y llama `reordenarEjercicios` fire-and-forget. Si la llamada a DB falla, la UI queda en el orden equivocado y el usuario no lo sabe.

**Fix:** Guardar el orden previo antes del optimistic update, y si `reordenarEjercicios` falla, revertir al orden previo y mostrar un toast de error.

**Files:**
- Modify: `app/rutinas/page.tsx:79-103`

**Step 1: Hacer `handleDragEnd` async con rollback**

Bloque actual (líneas ~79-103):
```typescript
const handleDragEnd = (event: DragEndEvent, diaId: string) => {
  const { active, over } = event
  if (!over || active.id === over.id || !rutinaData) return

  const dia = rutinaData.dias.find(d => d.id === diaId)
  if (!dia) return

  const oldIndex = dia.ejercicios.findIndex(e => e.id === active.id)
  const newIndex = dia.ejercicios.findIndex(e => e.id === over.id)
  const reordenados = arrayMove(dia.ejercicios, oldIndex, newIndex)
    .map((ej, idx) => ({ ...ej, orden: idx + 1 }))

  // Fire-and-forget: guardar en DB sin bloquear la UI
  reordenarEjercicios(supabase, reordenados.map(e => ({ id: e.id, orden: e.orden })))

  setRutinaData(prev => {
    if (!prev) return prev
    return {
      ...prev,
      dias: prev.dias.map(d =>
        d.id === diaId ? { ...d, ejercicios: reordenados } : d
      ),
    }
  })
}
```

Reemplazar por:
```typescript
const handleDragEnd = async (event: DragEndEvent, diaId: string) => {
  const { active, over } = event
  if (!over || active.id === over.id || !rutinaData) return

  const dia = rutinaData.dias.find(d => d.id === diaId)
  if (!dia) return

  const oldIndex = dia.ejercicios.findIndex(e => e.id === active.id)
  const newIndex = dia.ejercicios.findIndex(e => e.id === over.id)
  const reordenados = arrayMove(dia.ejercicios, oldIndex, newIndex)
    .map((ej, idx) => ({ ...ej, orden: idx + 1 }))

  // Guardar orden previo para rollback en caso de error
  const ordenPrevio = dia.ejercicios

  // Optimistic update
  setRutinaData(prev => {
    if (!prev) return prev
    return {
      ...prev,
      dias: prev.dias.map(d =>
        d.id === diaId ? { ...d, ejercicios: reordenados } : d
      ),
    }
  })

  const resultado = await reordenarEjercicios(supabase, reordenados.map(e => ({ id: e.id, orden: e.orden })))

  if (!resultado.success) {
    // Revertir al orden previo
    setRutinaData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        dias: prev.dias.map(d =>
          d.id === diaId ? { ...d, ejercicios: ordenPrevio } : d
        ),
      }
    })
    toast.error('No se pudo guardar el nuevo orden. Intentá de nuevo.')
  }
}
```

**Step 2: Verificar que `reordenarEjercicios` retorna `ResultadoOperacion`**

Buscar la firma de `reordenarEjercicios` en `lib/services/rutina-service.ts`. Debe retornar `Promise<ResultadoOperacion<...>>`. Si ya lo hace, no hay cambios en el service. Si retornaba `void`, actualizar para retornar `ResultadoOperacion<null>`.

Para verificar, buscar:
```bash
grep -n "reordenarEjercicios" lib/services/rutina-service.ts
```

Si retorna `void`, cambiar el `return` final a `return { success: true, data: null }` y el tipo a `Promise<ResultadoOperacion<null>>`.

**Step 3: Verificar**

```bash
npm run lint
npm run build
```

Verificar en dev que al hacer drag-and-drop el orden se actualiza inmediatamente en la UI (optimistic), y que si hay error de red (desconectar internet temporalmente), el orden revierte y aparece el toast.

**Step 4: Commit**

```bash
git add app/rutinas/page.tsx lib/services/rutina-service.ts
git commit -m "fix: agregar rollback al reordenar ejercicios si falla el guardado"
```

---

### Task 5: Validar que `diaId` pertenece al usuario en `crearSesion` (Issue 9)

**Problema:** `lib/services/sesion-service.ts:44-48` — al crear una sesión, se consultan los ejercicios del `diaId` sin verificar que ese `diaId` pertenezca al `rutinaId` del usuario. Un usuario podría pasar un `diaId` de otra rutina si RLS falla.

**Fix:** Antes de crear la sesión, verificar que `rutina_dias WHERE id = diaId AND rutina_id = rutinaId` existe. Si no, retornar error.

**Files:**
- Modify: `lib/services/sesion-service.ts:18-85`

**Step 1: Agregar verificación de ownership del diaId**

Después de la validación de UUIDs (línea 22) y antes del INSERT de la sesión (línea 28), agregar:

```typescript
  // Verificar que el día pertenece a la rutina
  const { data: diaValido, error: diaError } = await supabase
    .from('rutina_dias')
    .select('id')
    .eq('id', params.diaId)
    .eq('rutina_id', params.rutinaId)
    .single()

  if (diaError || !diaValido) {
    return { success: false, error: 'Día no encontrado en la rutina' }
  }
```

El bloque completo de `crearSesion` al inicio del `try` quedará:

```typescript
  try {
    // Verificar que el día pertenece a la rutina
    const { data: diaValido, error: diaError } = await supabase
      .from('rutina_dias')
      .select('id')
      .eq('id', params.diaId)
      .eq('rutina_id', params.rutinaId)
      .single()

    if (diaError || !diaValido) {
      return { success: false, error: 'Día no encontrado en la rutina' }
    }

    // Crear la sesión
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      // ...
```

**Step 2: Verificar**

```bash
npm run lint
npm run build
```

Verificar en dev que crear una sesión normalmente sigue funcionando.

**Step 3: Commit**

```bash
git add lib/services/sesion-service.ts
git commit -m "fix: validar que diaId pertenece a la rutina en crearSesion"
```

---

### Task 6: Índice único para prevenir sesiones simultáneas (Issue 4)

**Problema:** Si el usuario hace doble tap en un día, `crearSesion` puede ejecutarse dos veces en paralelo antes de que la primera respuesta llegue, creando dos sesiones abiertas. La UI tiene un guard (`if (sesionEnProgreso) return`), pero hay una ventana de tiempo antes de que el estado se cargue.

**Fix en dos partes:**
1. **DB:** Agregar un índice único parcial en `sesiones (user_id) WHERE finalizada_at IS NULL` en Supabase para rechazar la segunda inserción a nivel de DB.
2. **Código:** Manejar el error de constraint en `crearSesion` con un mensaje amigable.

**Files:**
- Modify: `lib/services/sesion-service.ts:28-41` (manejo de error de conflicto)
- Manual: Ejecutar SQL en Supabase Dashboard

**Step 1: Crear el índice en Supabase Dashboard**

Ir a Supabase Dashboard → SQL Editor y ejecutar:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS sesiones_user_sesion_activa_unique
  ON sesiones (user_id)
  WHERE finalizada_at IS NULL;
```

Este índice garantiza que un usuario solo pueda tener **una** sesión activa al mismo tiempo. Al intentar insertar una segunda, Supabase retorna un error con code `23505` (unique_violation).

**Step 2: Manejar el error de conflicto en `crearSesion`**

En `lib/services/sesion-service.ts`, actualizar el bloque de manejo de error del INSERT de sesión (líneas ~38-41):

```typescript
// ANTES:
if (sesionError || !sesion) {
  console.error('Error creando sesión:', sesionError)
  return { success: false, error: 'Error al crear la sesión' }
}

// DESPUÉS:
if (sesionError || !sesion) {
  // Error 23505 = unique_violation: ya existe una sesión activa
  if (sesionError?.code === '23505') {
    return { success: false, error: 'Ya tenés una sesión activa. Finalizala antes de empezar una nueva.' }
  }
  console.error('Error creando sesión:', sesionError)
  return { success: false, error: 'Error al crear la sesión' }
}
```

**Step 3: Verificar**

```bash
npm run lint
npm run build
```

Para probar el índice: intentar crear dos sesiones simultáneas (abrir dos tabs y hacer click en el mismo momento). La segunda debe mostrar el toast de error.

**Step 4: Commit**

```bash
git add lib/services/sesion-service.ts
git commit -m "fix: manejar conflicto de sesión activa única en crearSesion"
```

---

### Task 7: Logging de errores en `limpiarRutinaHuerfana` (Issue 10)

**Problema:** `app/api/generar-rutina/route.ts:180-182` — `limpiarRutinaHuerfana` falla silenciosamente si el DELETE retorna error. Si esto ocurre, queda una rutina vacía/incompleta en la DB sin ningún registro de que el cleanup falló.

**Fix:** Agregar logging del error de cleanup y también trackear el evento de error para observabilidad.

**Files:**
- Modify: `app/api/generar-rutina/route.ts:180-182`

**Step 1: Agregar logging al helper**

Bloque actual (líneas ~179-182):
```typescript
    async function limpiarRutinaHuerfana() {
      await supabase.from('rutinas').delete().eq('id', rutina!.id)
    }
```

Reemplazar por:
```typescript
    async function limpiarRutinaHuerfana() {
      const { error: cleanupError } = await supabase
        .from('rutinas')
        .delete()
        .eq('id', rutina!.id)
      if (cleanupError) {
        console.error('[generar-rutina] Error limpiando rutina huérfana:', cleanupError, 'rutina_id:', rutina!.id)
        if (userId) trackErrorServer(userId, 'api/generar-rutina', `cleanup_failed:${rutina!.id}`)
      }
    }
```

**Nota sobre CASCADE:** El cleanup solo borra la fila de `rutinas`. Las filas de `rutina_dias` y `rutina_ejercicios` se eliminan solo si la DB tiene `ON DELETE CASCADE`. Si no hay CASCADE, las filas hijas quedarán huérfanas.

Para verificar si hay CASCADE, revisar en Supabase Dashboard → Table Editor → `rutina_dias` → Foreign Keys. Debe mostrar `rutina_id → rutinas.id ON DELETE CASCADE`. Si no tiene CASCADE, agregar en SQL Editor:

```sql
-- Solo si NO existe CASCADE. Verificar antes de ejecutar.
ALTER TABLE rutina_dias
  DROP CONSTRAINT rutina_dias_rutina_id_fkey,
  ADD CONSTRAINT rutina_dias_rutina_id_fkey
    FOREIGN KEY (rutina_id) REFERENCES rutinas(id) ON DELETE CASCADE;

ALTER TABLE rutina_ejercicios
  DROP CONSTRAINT rutina_ejercicios_dia_id_fkey,
  ADD CONSTRAINT rutina_ejercicios_dia_id_fkey
    FOREIGN KEY (dia_id) REFERENCES rutina_dias(id) ON DELETE CASCADE;
```

Si CASCADE ya existe (lo más probable dado que el proyecto asume limpieza funciona), no es necesario.

**Step 2: Verificar**

```bash
npm run lint
npm run build
```

Esperado: sin errores nuevos.

**Step 3: Commit**

```bash
git add app/api/generar-rutina/route.ts
git commit -m "fix: agregar logging de errores en limpiarRutinaHuerfana"
```

---

## Resumen de Tasks

| # | Issue | Archivos | Complejidad |
|---|-------|----------|-------------|
| 1 | `readFileSync` en scope de módulo | `app/api/chat/route.ts`, `app/api/generar-rutina/route.ts` | Baja |
| 2 | `useMemo` en `useAuth` | `lib/hooks/useAuth.ts` | Baja |
| 3 | Eliminar `completada` de `handleBlur` | `lib/services/sesion-service.ts`, `app/entrenar/[sesionId]/page.tsx` | Baja |
| 4 | Rollback en reordenamiento | `app/rutinas/page.tsx` | Media |
| 5 | Validar `diaId` en `crearSesion` | `lib/services/sesion-service.ts` | Baja |
| 6 | Índice único + manejo en `crearSesion` | `lib/services/sesion-service.ts` + SQL en Supabase | Media |
| 7 | Logging en `limpiarRutinaHuerfana` | `app/api/generar-rutina/route.ts` | Baja |
