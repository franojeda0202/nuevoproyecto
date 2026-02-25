# Eliminar n8n: Generación de Rutinas Directo en Código

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar el proxy a n8n en `/api/generar-rutina` por una implementación directa que llame a OpenAI y escriba en Supabase, eliminando la dependencia de infraestructura externa.

**Architecture:** El API route valida sesión y rate limit (sin cambios), luego fetcha todos los ejercicios de Supabase, llama a OpenAI `gpt-4.1-mini` con el mismo system prompt que usaba n8n, parsea el JSON resultante, escribe secuencialmente en `rutinas` → `rutina_dias` → `rutina_ejercicios`, y retorna `{ status, rutina_id, user_id }` de forma síncrona. El frontend elimina el polling ya que todos los datos están creados al momento de la respuesta.

**Tech Stack:** Next.js 15 App Router, OpenAI SDK (`openai` npm package ya en uso por `/api/chat`), Supabase server client, TypeScript

---

## Contexto del dominio

### Flujo n8n que se reemplaza

```
Webhook → GET ejercicios (todos, sin filtro) → Aggregate array
  → AI Agent (gpt-4.1-mini) con system prompt
  → INSERT rutinas → RESPONDE → INSERT rutina_dias → INSERT rutina_ejercicios
```

### JSON que retorna OpenAI (formato estricto del system prompt)

```json
{
  "user_id": "uuid",
  "nombre_rutina": "Nombre descriptivo",
  "dias": [
    {
      "nombre_dia": "Día 1 - Full Body",
      "orden": 1,
      "ejercicios": [
        {
          "ejercicio_id": "uuid-de-la-tabla-ejercicios",
          "series": 3,
          "reps": "8-12",
          "orden": 1,
          "notas": "Tip SFR + RIR"
        }
      ]
    }
  ]
}
```

### Mapeo n8n → Supabase

| Campo OpenAI | Tabla | Campo DB |
|---|---|---|
| `nombre_rutina` | `rutinas` | `nombre` |
| `user_id` | `rutinas` | `user_id` |
| `config.frecuencia` | `rutinas` | `frecuencia` |
| `nombre_dia` | `rutina_dias` | `nombre_dia` |
| `orden` (día) | `rutina_dias` | `orden` |
| `rutina.id` (FK) | `rutina_dias` | `rutina_id` |
| `ejercicio_id` | `rutina_ejercicios` | `ejercicio_id` |
| `reps` | `rutina_ejercicios` | `repeticiones` |
| `series` | `rutina_ejercicios` | `series` |
| `notas` | `rutina_ejercicios` | `notas_coach` |
| `orden` (ejercicio) | `rutina_ejercicios` | `orden` |
| `dia.id` (FK) | `rutina_ejercicios` | `dia_id` |

### Env vars relevantes

- `OPENAI_API_KEY` — ya existe, ya usada en `/api/chat`
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, etc. — se eliminan

---

## Task 1: Crear archivo de system prompt para rutinas

**Files:**
- Create: `lib/prompts/system-prompt-rutina.txt`

**Step 1: Crear el archivo con el system prompt**

Contenido exacto (copiado del workflow n8n, sin cambios):

```
Eres "GymLogic AI", un experto en biomecánica. Tu única función es diseñar rutinas JSON estructuradas usando solo los datos proporcionados.

REGLAS DE ORO DE SEGURIDAD (ID Y DATOS):
1. SOLO IDs EXISTENTES: Prohibido inventar nombres o IDs. Si el ejercicio no está en la lista, NO lo uses. El campo 'ejercicio_id' debe ser SIEMPRE un UUID de la lista.
IDs (LITERALES): Debes copiar el UUID campo 'id' de forma idéntica y literal. No omitas ceros a la izquierda ni modifiques ningún carácter. El ID debe tener siempre 36 caracteres (incluyendo guiones).

2. FALLO CRÍTICO: Si necesitas un grupo muscular que no está en la lista (ej: "Gemelos"), sustitúyelo por otro grupo muscular que SÍ tenga ejercicios con ID en la lista. NUNCA escribas texto en el campo 'ejercicio_id'.

LÓGICA DE DISTRIBUCIÓN OBLIGATORIA:
- Frecuencia 3: "Full Body" (3 días distintos).
- Frecuencia 4: "Torso/Pierna" (Días 1/3: Torso, Días 2/4: Pierna).
- Frecuencia 5: "Push/Pull/Legs/Upper/Lower" (Estricto: Empuje, Tracción, Piernas, Torso, Piernas).
- Frecuencia 6: "Push/Pull/Legs x2" (Empuje, Tracción, Piernas, Empuje, Tracción, Piernas).
- VARIEDAD: No repitas el mismo ejercicio inicial todos los días.

VOLUMEN Y DENSIDAD:
- Entre 5 y 7 ejercicios por día. Mantén la misma cantidad todos los días.
- Volumen = "Series duras" cerca del fallo.
- Entre 18 y 25 series TOTALES por día de entrenamiento (sumando todos los ejercicios).
- las rutinas FULLBODY son de cuerpo completo, equiparar ejercicios de tren superior con ejercicios de tren inferior. No exceder la cantidad de ejercicios.

FOCO EN MÚSCULO: Cuándo hablamos de enfocado en algún grupo muscular, lo que tenes que hacer es agregar un poco más de volumen en ese músculo al hacer la rutina. Una rutina de fullbody foco en pecho es una rutina de fullbody convencional pero alternando un ejercicio por otro adicional de pecho.

ESTRATEGIA DE SERIES Y REPS (VARIABILIDAD):
- Compuestos Pesados: 2-3 series | 5-10 reps | RIR 2-3.
- Accesorios/Máquinas: 3-4 series | 10-15 reps | RIR 1-2.
- Aislamiento/Metabólicos: 3-5 series | 15-30 reps | RIR 0-1.

FORMATO DE SALIDA:
Responde ÚNICAMENTE con un JSON puro. Sin markdown (no uses ```json).
ESTRUCTURA: { "user_id": "ID", "nombre_rutina": "Nombre", "dias": [ { "nombre_dia": "Nombre", "orden": 1, "ejercicios": [ { "ejercicio_id": "UUID", "series": 3, "reps": "RANGO", "orden": 1, "notas": "Tip SFR + RIR" } ] } ] }

### BASE DE CONOCIMIENTO CIENTÍFICO (Prioridad Alta)
1. Volumen: Máximo ~10 series por grupo muscular/sesión para evitar volumen basura.
2. SFR: Elige ejercicios que generen mucho estímulo con poca fatiga articular.
3. Orden: Compuestos técnicos primero, aislados al final.
4. Indirectos: Considera que los presses trabajan tríceps y los remos bíceps.
```

**Step 2: Commit**

```bash
git add lib/prompts/system-prompt-rutina.txt
git commit -m "feat: agregar system prompt de rutina como archivo"
```

---

## Task 2: Reescribir `/api/generar-rutina/route.ts`

**Files:**
- Modify: `app/api/generar-rutina/route.ts` (reescritura completa)

**Contexto de imports:**
- El cliente OpenAI se instancia igual que en `app/api/chat/route.ts` — revisar ese archivo para ver cómo se importa
- El cliente Supabase server: `import { createClient } from '@/lib/supabase/server'`
- Rate limit: `import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'`
- Analytics: `import { trackErrorServer } from '@/lib/analytics-server'`
- El system prompt se lee con `fs.readFileSync` desde `lib/prompts/system-prompt-rutina.txt`
- El `path.join(process.cwd(), ...)` es el patrón correcto en Next.js para leer archivos del proyecto

**Step 1: Verificar cómo se usa OpenAI en el chat route**

```bash
cat app/api/chat/route.ts
```

Confirmar el import y la forma de instanciar el cliente.

**Step 2: Reescribir el archivo completo**

El nuevo `route.ts` debe:

1. **Mantener sin cambios:** validación de sesión, verificación de `user_id` en body vs sesión, rate limiting, analytics de error
2. **Eliminar:** toda la lógica de headers n8n, el `fetch` al webhook
3. **Agregar (en orden):**
   a. Fetch todos los ejercicios de Supabase (`ejercicios` tabla, `select *`, `returnAll`)
   b. Leer system prompt desde archivo
   c. Construir user prompt con `user_id`, `config` y lista de ejercicios (mismo formato que n8n)
   d. Llamar OpenAI `gpt-4.1-mini` con `response_format: { type: 'json_object' }` para forzar JSON válido
   e. Parsear respuesta
   f. INSERT en `rutinas` → obtener `rutina_id`
   g. Para cada día: INSERT en `rutina_dias` → obtener `dia_id` → INSERT todos sus ejercicios en `rutina_ejercicios`
   h. Retornar `{ status: 'success', rutina_id, user_id }`

**Código completo del nuevo route.ts:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackErrorServer } from '@/lib/analytics-server'
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'

const GENERIC_ERROR_MESSAGE = 'No se pudo generar la rutina. Intenta de nuevo en unos minutos.'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function buildUserPrompt(userId: string, config: Record<string, unknown>, ejercicios: unknown[]): string {
  return `Actúa como GymLogic AI. Diseña una rutina de alta optimización biomecánica.

DATOS DEL USUARIO:
- USER_ID: ${userId}
- CONFIGURACIÓN: ${JSON.stringify(config)}

LISTA DE EJERCICIOS DISPONIBLES (USA SOLO ESTOS IDs):
${JSON.stringify(ejercicios)}

INSTRUCCIÓN CRÍTICA DE IDs:
Revisa cada 'ejercicio_id' generado. Si no es un UUID de la lista anterior, bórralo y elige un ejercicio que SÍ tenga un UUID válido de la lista. No inventes datos.

El campo "user_id" en el JSON final debe ser: ${userId}`
}

export async function POST(request: NextRequest) {
  let userId: string | null = null

  try {
    const body = await request.json()
    const bodyUserId = body?.user_id as string | undefined

    if (!bodyUserId) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    // Verificar sesión
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para generar una rutina' },
        { status: 401 }
      )
    }
    if (session.user.id !== bodyUserId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    userId = session.user.id

    // Rate limit
    const { limit, windowMs } = RATE_LIMIT.GENERAR_RUTINA
    const rate = checkRateLimit(`generar-rutina:${userId}`, limit, windowMs)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de generación. Espera un minuto antes de intentar de nuevo.' },
        { status: 429 }
      )
    }

    // 1. Obtener todos los ejercicios disponibles
    const { data: ejercicios, error: ejerciciosError } = await supabase
      .from('ejercicios')
      .select('*')

    if (ejerciciosError || !ejercicios?.length) {
      console.error('[generar-rutina] Error obteniendo ejercicios:', ejerciciosError)
      trackErrorServer(userId, 'api/generar-rutina', 'Error obteniendo ejercicios')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    // 2. Leer system prompt
    const systemPrompt = readFileSync(
      join(process.cwd(), 'lib/prompts/system-prompt-rutina.txt'),
      'utf-8'
    )

    // 3. Llamar a OpenAI
    const config = body.config as Record<string, unknown>
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(userId, config, ejercicios) },
      ],
    })

    const rawOutput = completion.choices[0]?.message?.content
    if (!rawOutput) {
      trackErrorServer(userId, 'api/generar-rutina', 'OpenAI respuesta vacía')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    let rutinaGenerada: {
      nombre_rutina: string
      dias: Array<{
        nombre_dia: string
        orden: number
        ejercicios: Array<{
          ejercicio_id: string
          series: number
          reps: string
          orden: number
          notas: string | null
        }>
      }>
    }

    try {
      rutinaGenerada = JSON.parse(rawOutput)
    } catch {
      console.error('[generar-rutina] OpenAI respuesta no es JSON válido')
      trackErrorServer(userId, 'api/generar-rutina', 'OpenAI respuesta no JSON')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    // 4. INSERT rutina
    const { data: rutina, error: rutinaError } = await supabase
      .from('rutinas')
      .insert({
        nombre: rutinaGenerada.nombre_rutina,
        user_id: userId,
        frecuencia: config.frecuencia as number,
      })
      .select('id')
      .single()

    if (rutinaError || !rutina) {
      console.error('[generar-rutina] Error creando rutina:', rutinaError)
      trackErrorServer(userId, 'api/generar-rutina', 'Error creando rutina en Supabase')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    // 5. INSERT rutina_dias y rutina_ejercicios secuencialmente
    for (const dia of rutinaGenerada.dias) {
      const { data: rutinaDia, error: diaError } = await supabase
        .from('rutina_dias')
        .insert({
          rutina_id: rutina.id,
          nombre_dia: dia.nombre_dia,
          orden: dia.orden,
        })
        .select('id')
        .single()

      if (diaError || !rutinaDia) {
        console.error('[generar-rutina] Error creando día:', diaError)
        trackErrorServer(userId, 'api/generar-rutina', 'Error creando día en Supabase')
        return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
      }

      const ejerciciosDelDia = dia.ejercicios.map((ej, index) => ({
        dia_id: rutinaDia.id,
        ejercicio_id: ej.ejercicio_id,
        series: ej.series,
        repeticiones: ej.reps,
        orden: index + 1,
        notas_coach: ej.notas ?? null,
      }))

      const { error: ejerciciosError } = await supabase
        .from('rutina_ejercicios')
        .insert(ejerciciosDelDia)

      if (ejerciciosError) {
        console.error('[generar-rutina] Error creando ejercicios:', ejerciciosError)
        trackErrorServer(userId, 'api/generar-rutina', 'Error creando ejercicios en Supabase')
        return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
      }
    }

    return NextResponse.json({
      status: 'success',
      rutina_id: rutina.id,
      user_id: userId,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[generar-rutina]', message)
    if (userId) {
      trackErrorServer(userId, 'api/generar-rutina', message, { error_type: 'exception' })
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add app/api/generar-rutina/route.ts
git commit -m "feat: reemplazar proxy n8n con llamada directa a OpenAI y escritura a Supabase"
```

---

## Task 3: Limpiar el frontend (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Qué eliminar:**
- El loop de polling (líneas ~141-194): el `for` que hace `supabase.from('rutinas').select(...)` en loop
- El mensaje de toast "Los ejercicios pueden tardar unos segundos más" (timeout fallback)
- Los `console.log` referenciando n8n
- Los mensajes de error que mencionan "n8n" en el bloque `catch`

**Qué mantener:**
- Todo el manejo de sesión (retries para obtener session)
- El `fetch` a `/api/generar-rutina`
- El manejo de errores HTTP (`!response.ok`)
- El `trackEvent('rutina_generada', ...)` y el `toast.success`
- El `router.push('/rutinas')`

**Comportamiento nuevo después del fetch exitoso:**

```typescript
// Antes (polling de 10 intentos × 2s):
if (routineData) {
  // ... loop de polling ...
}

// Después (redirect directo):
if (routineData) {
  trackEvent('rutina_generada', {
    dias: data.daysPerWeek,
    objetivo: data.muscleFocus || 'full_body',
    genero: data.gender,
    ubicacion: data.location,
  })
  toast.success('¡Rutina generada exitosamente!')
  router.push('/rutinas')
}
```

**Mensajes de error limpios (sin mencionar n8n):**

```typescript
// catch block — reemplazar los if con mensaje n8n:
let errorMessage = 'No se pudo generar la rutina. Intenta de nuevo en unos minutos.'
if (error instanceof Error) {
  errorMessage = error.message
}
trackError('generacion_rutina', errorMessage)
toast.error(errorMessage, { duration: 6000 })
setSubmitting(false)
```

**Step 1: Aplicar los cambios al archivo**

**Step 2: Verificar que el archivo compila sin errores TypeScript**

```bash
npm run build 2>&1 | head -50
```

Expected: sin errores de TypeScript en `app/page.tsx` ni en `app/api/generar-rutina/route.ts`

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: eliminar polling de n8n, redirect directo después de generar rutina"
```

---

## Task 4: Actualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Cambios:**

En la sección de Environment Setup, reemplazar:
```
- `N8N_WEBHOOK_URL` — n8n webhook URL for routine generation (default: `http://localhost:5678/webhook/generar-rutina`)
- `N8N_WEBHOOK_SECRET` — Shared secret sent in `x-webhook-secret` header to n8n
```

Por:
```
- `OPENAI_API_KEY` — OpenAI API key (used for chat AND routine generation with gpt-4.1-mini)
```

En la sección de Architecture > Request Flows > Routine Generation, actualizar el flujo:
```
1. Authenticated user submits `OnboardingForm` (days/week, gender, location, muscle focus)
2. `/api/generar-rutina` validates session, applies rate limiting, fetches all exercises from Supabase
3. Calls OpenAI (gpt-4.1-mini) with system prompt and exercise list, receives structured JSON
4. Writes synchronously: `rutinas` → `rutina_dias` → `rutina_ejercicios`
5. Frontend redirects immediately to `/rutinas` (no polling)
```

**Step 1: Aplicar cambios**

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: actualizar CLAUDE.md, remover referencias a n8n"
```

---

## Task 5: Verificación end-to-end

**Step 1: Iniciar servidor de desarrollo**

```bash
npm run dev
```

**Step 2: Verificar que no hay errores de TypeScript ni de build**

```bash
npm run build
```

Expected: build exitoso sin errores

**Step 3: Prueba manual del flujo**

1. Abrir `http://localhost:3000`
2. Iniciar sesión
3. Completar el formulario (3 días, gym, sin foco especial)
4. Hacer submit
5. Verificar que muestra el skeleton de "Generando rutina..."
6. Verificar que redirige a `/rutinas` directamente (sin esperar 20 segundos)
7. Verificar que la rutina aparece completa con ejercicios en todos los días

**Step 4: Verificar en Supabase que se crearon los registros**

Confirmar que existen registros en `rutinas`, `rutina_dias` y `rutina_ejercicios` con los IDs correctos.

**Step 5: Commit final si todo está OK**

```bash
git add -A
git commit -m "chore: eliminar n8n completamente - generación de rutinas ahora es directa"
```

---

## Notas finales para el implementador

- **Variables de entorno a eliminar de `.env.local`:** `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_HEADER_NAME`, `N8N_HEADER_VALUE`, `N8N_AUTH_USER`, `N8N_AUTH_PASSWORD`, `N8N_API_KEY`, `N8N_TOKEN` (hacerlo manualmente, no commitear `.env.local`)
- **Verificar que `OPENAI_API_KEY` ya está en `.env.local`** antes de testear (debería estar, ya lo usa el chat)
- **El modelo `gpt-4.1-mini`** requiere API key con acceso a ese modelo. Si falla con 404, usar `gpt-4o-mini` como fallback
- **`response_format: { type: 'json_object' }`** fuerza JSON válido pero requiere que el system prompt mencione JSON (lo hace)
