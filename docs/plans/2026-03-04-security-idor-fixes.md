# Security — IDOR Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Agregar ownership checks a nivel de aplicación en las funciones de sesión para que ningún usuario autenticado pueda leer o modificar datos de otro.

**Architecture:** Todas las funciones de servicio que aceptan un `sesionId` arbitrario pasan a requerir `userId` (o `sesionId` como scope adicional para series). Las queries agregan `.eq('user_id', userId)` o `.eq('sesion_id', sesionId)` para que Supabase rechace filas que no pertenezcan al usuario, independientemente del estado de RLS.

**Tech Stack:** TypeScript, Supabase JS client, Next.js 16 App Router

---

### Task 1: Agregar `userId` a `obtenerSesionActiva` y `finalizarSesion`

**Files:**
- Modify: `lib/services/sesion-service.ts` (líneas 122-248)
- Modify: `app/entrenar/[sesionId]/page.tsx` (líneas 22, 35, 129)

**Context:** `obtenerSesionActiva` filtra solo por `sesionId` — cualquier usuario puede leer la sesión activa de otro si conoce el UUID. `finalizarSesion` actualiza solo por `sesionId` — cualquier usuario puede finalizar la sesión de otro.

**Step 1: Modificar `obtenerSesionActiva` en `lib/services/sesion-service.ts`**

Cambiar la firma (línea 122-124) y agregar validación + filtro:

```ts
// ANTES
export async function obtenerSesionActiva(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<SesionActiva>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

// DESPUÉS
export async function obtenerSesionActiva(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<SesionActiva>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) return { success: false, error: 'IDs inválidos' }
```

Agregar `.eq('user_id', userId)` a la query de sesiones (línea 132):

```ts
// ANTES
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, user_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .single()

// DESPUÉS
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, user_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .eq('user_id', userId)
      .single()
```

**Step 2: Modificar `finalizarSesion` en `lib/services/sesion-service.ts`**

Cambiar la firma (línea 233-235) y agregar validación + filtro:

```ts
// ANTES
export async function finalizarSesion(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

// DESPUÉS
export async function finalizarSesion(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) return { success: false, error: 'IDs inválidos' }
```

Agregar `.eq('user_id', userId)` a la query de update (línea 239):

```ts
// ANTES
    const { data: updated, error } = await supabase
      .from('sesiones')
      .update({ finalizada_at: new Date().toISOString() })
      .eq('id', sesionId)
      .select('id')

// DESPUÉS
    const { data: updated, error } = await supabase
      .from('sesiones')
      .update({ finalizada_at: new Date().toISOString() })
      .eq('id', sesionId)
      .eq('user_id', userId)
      .select('id')
```

**Step 3: Actualizar el caller en `app/entrenar/[sesionId]/page.tsx`**

Agregar `userId` al destructuring de `useAuth` (línea 22):

```ts
// ANTES
  const { loading: loadingAuth, authenticated } = useAuth()

// DESPUÉS
  const { loading: loadingAuth, authenticated, userId } = useAuth()
```

Pasar `userId` en las llamadas (líneas 35 y 129):

```ts
// ANTES (línea 35)
    obtenerSesionActiva(supabase, sesionId).then(result => {

// DESPUÉS
    obtenerSesionActiva(supabase, sesionId, userId!).then(result => {
```

```ts
// ANTES (línea 129)
    const resultado = await finalizarSesion(supabase, sesionId)

// DESPUÉS
    const resultado = await finalizarSesion(supabase, sesionId, userId!)
```

Nota: `userId!` es seguro porque el `useEffect` no corre si `!authenticated || !userId` (línea 30-33 del componente ya tiene ese guard).

**Step 4: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: sin errores TypeScript.

**Step 5: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/services/sesion-service.ts "app/entrenar/[sesionId]/page.tsx"
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
security: agregar userId a obtenerSesionActiva y finalizarSesion

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Agregar `sesionId` a `actualizarSerie`

**Files:**
- Modify: `lib/services/sesion-service.ts` (líneas 211-229)
- Modify: `app/entrenar/[sesionId]/page.tsx` (líneas 81-86 y 117-122)

**Context:** `actualizarSerie` actualiza `sesion_series` filtrando solo por `serie.id`. Cualquier usuario que conozca el UUID de una serie puede sobreescribirla. Agregar `.eq('sesion_id', ...)` scope la update a una sesión específica; combinado con el ownership ya verificado de la sesión (Task 1), provee defensa en profundidad.

**Step 1: Modificar la firma y la query en `lib/services/sesion-service.ts`**

```ts
// ANTES (línea 211-229)
export async function actualizarSerie(
  supabase: SupabaseClient,
  serie: {
    id: string
    peso_kg: number | null
    repeticiones: number | null
    completada: boolean
  }
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(serie.id)) return { success: false, error: 'ID inválido' }

  try {
    const { error } = await supabase
      .from('sesion_series')
      .update({
        peso_kg: serie.peso_kg,
        repeticiones: serie.repeticiones,
        completada: serie.completada,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serie.id)

// DESPUÉS
export async function actualizarSerie(
  supabase: SupabaseClient,
  serie: {
    id: string
    sesionId: string
    peso_kg: number | null
    repeticiones: number | null
    completada: boolean
  }
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(serie.id) || !isValidUUID(serie.sesionId)) return { success: false, error: 'IDs inválidos' }

  try {
    const { error } = await supabase
      .from('sesion_series')
      .update({
        peso_kg: serie.peso_kg,
        repeticiones: serie.repeticiones,
        completada: serie.completada,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serie.id)
      .eq('sesion_id', serie.sesionId)
```

**Step 2: Actualizar los callers en `app/entrenar/[sesionId]/page.tsx`**

En `handleBlur` (línea 81-86), agregar `sesionId`:

```ts
// ANTES
        Promise.resolve().then(() => {
          actualizarSerie(supabase, {
            id: serieId,
            peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
            repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
            completada: serie.completada,
          })
        })

// DESPUÉS
        Promise.resolve().then(() => {
          actualizarSerie(supabase, {
            id: serieId,
            sesionId,
            peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
            repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
            completada: serie.completada,
          })
        })
```

En `handleToggleCompletada` (línea 117-122), agregar `sesionId`:

```ts
// ANTES
        actualizarSerie(supabase, {
          id: serieId,
          peso_kg: serieActualizada.peso_kg ? parseFloat(serieActualizada.peso_kg) : null,
          repeticiones: serieActualizada.repeticiones ? parseInt(serieActualizada.repeticiones) : null,
          completada: serieActualizada.completada,
        })

// DESPUÉS
        actualizarSerie(supabase, {
          id: serieId,
          sesionId,
          peso_kg: serieActualizada.peso_kg ? parseFloat(serieActualizada.peso_kg) : null,
          repeticiones: serieActualizada.repeticiones ? parseInt(serieActualizada.repeticiones) : null,
          completada: serieActualizada.completada,
        })
```

Nota: `sesionId` ya está disponible en el scope del componente (`const sesionId = params.sesionId as string`).

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: sin errores TypeScript.

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/services/sesion-service.ts "app/entrenar/[sesionId]/page.tsx"
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
security: agregar sesionId scope a actualizarSerie

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Agregar `userId` a `obtenerDetalleSesion`

**Files:**
- Modify: `lib/services/sesion-service.ts` (líneas 284-321)
- Modify: `app/entrenamiento/[sesionId]/page.tsx` (líneas 22, 37)

**Context:** `obtenerDetalleSesion` retorna el detalle de cualquier sesión dado su ID, sin verificar que pertenezca al usuario. La página de historial no debería ser accesible para sesiones ajenas.

**Step 1: Modificar `obtenerDetalleSesion` en `lib/services/sesion-service.ts`**

Cambiar la firma (línea 284-286):

```ts
// ANTES
export async function obtenerDetalleSesion(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<SesionDetalle>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

// DESPUÉS
export async function obtenerDetalleSesion(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<SesionDetalle>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) return { success: false, error: 'IDs inválidos' }
```

Agregar `.eq('user_id', userId)` a la query de sesión (línea 289-291):

```ts
// ANTES
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .not('finalizada_at', 'is', null)
      .single()

// DESPUÉS
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .eq('user_id', userId)
      .not('finalizada_at', 'is', null)
      .single()
```

**Step 2: Actualizar el caller en `app/entrenamiento/[sesionId]/page.tsx`**

Agregar `userId` al destructuring de `useAuth` (línea 22 aprox.):

```ts
// ANTES
  const { loading: loadingAuth, authenticated } = useAuth()

// DESPUÉS
  const { loading: loadingAuth, authenticated, userId } = useAuth()
```

Pasar `userId` en la llamada (línea 37):

```ts
// ANTES
    obtenerDetalleSesion(supabase, sesionId).then(result => {

// DESPUÉS
    obtenerDetalleSesion(supabase, sesionId, userId!).then(result => {
```

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: sin errores TypeScript.

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/services/sesion-service.ts "app/entrenamiento/[sesionId]/page.tsx"
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
security: agregar userId a obtenerDetalleSesion

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Reemplazar `select('*')` en generar-rutina

**Files:**
- Modify: `app/api/generar-rutina/route.ts` (línea 100)

**Context:** `select('*')` manda todas las columnas de la tabla `ejercicios` (incluyendo `instrucciones_base` que puede ser texto largo) a OpenAI en cada request. Esto infla el costo de tokens y expone más datos de los necesarios al modelo. Solo se necesitan 6 columnas para que el prompt funcione.

**Step 1: Cambiar el select**

```ts
// ANTES (línea 98-100)
    const { data: ejercicios, error: ejerciciosError } = await supabase
      .from('ejercicios')
      .select('*')

// DESPUÉS
    const { data: ejercicios, error: ejerciciosError } = await supabase
      .from('ejercicios')
      .select('id, nombre, segmento, patron_movimiento, grupo_muscular, equipamiento')
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: sin errores TypeScript. Nota: `buildUserPrompt` recibe los ejercicios y los serializa. Si usa propiedades que no están en el nuevo select (como `instrucciones_base`, `dificultad_tecnica`, `tipo_ejercicio`), TypeScript lo detectará en el build. Si no hay error, el prompt solo usaba las 6 columnas incluidas.

**Step 3: Verificar `buildUserPrompt` manualmente**

Leer la función `buildUserPrompt` en el mismo archivo y confirmar que no referencia `instrucciones_base`, `dificultad_tecnica` u otras columnas excluidas. Si las referencia, ajustar el select para incluirlas también (prioridad: token budget mínimo).

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/api/generar-rutina/route.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
security: reemplazar select('*') por columnas mínimas en generar-rutina

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist final

- [ ] Task 1 ✅ `obtenerSesionActiva` recibe `userId`, query filtra `.eq('user_id', userId)`
- [ ] Task 1 ✅ `finalizarSesion` recibe `userId`, update filtra `.eq('user_id', userId)`
- [ ] Task 1 ✅ `entrenar/[sesionId]/page.tsx` pasa `userId` a ambas funciones
- [ ] Task 2 ✅ `actualizarSerie` recibe `sesionId`, update filtra `.eq('sesion_id', serie.sesionId)`
- [ ] Task 2 ✅ `handleBlur` y `handleToggleCompletada` pasan `sesionId`
- [ ] Task 3 ✅ `obtenerDetalleSesion` recibe `userId`, query filtra `.eq('user_id', userId)`
- [ ] Task 3 ✅ `entrenamiento/[sesionId]/page.tsx` pasa `userId`
- [ ] Task 4 ✅ `generar-rutina` usa `select('id, nombre, segmento, patron_movimiento, grupo_muscular, equipamiento')`
- [ ] Build limpio en todos los tasks
