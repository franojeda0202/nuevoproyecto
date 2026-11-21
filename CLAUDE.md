# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Antes de proponer features nuevas, leer `docs/product-direction.md`: dice qué se construye ahora, qué está en espera y por qué. El feedback de uso real va en `docs/feedback/`.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # vitest run — solo lógica pura (ver abajo)
```

Vitest cubre solo funciones puras, sin Supabase ni componentes (hoy: `lib/utils/rangos-series.ts`). Los tests van al lado del archivo, como `*.test.ts`. Lo demás se verifica con build, lint y probando en el teléfono.

## Environment Setup

Copy `env.example` to `.env.local` and fill in the required values:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project credentials
- `OPENAI_API_KEY` — OpenAI API key for chat (gpt-4o-mini) and routine generation (gpt-4.1-mini)

## Architecture

GymLogic is a Next.js 16 App Router app for generating and managing personalized workout routines via AI.

### Request Flows

**Routine Generation:**
1. Authenticated user submits `OnboardingForm` (days/week, gender, location, muscle focus)
2. `/api/generar-rutina` validates session, applies rate limiting, fetches all exercises from Supabase
3. Calls OpenAI (gpt-4.1-mini) with system prompt (`lib/prompts/system-prompt-rutina.txt`) and exercise list
4. Writes synchronously: `rutinas` → `rutina_dias` → `rutina_ejercicios` (with orphan cleanup on failure)
5. Frontend redirects immediately to `/rutinas` — no polling needed

**Workout Session (Entrenamiento):**
1. User selects a routine day in `/entrenar` → `crearSesion` inserts into `sesiones` + pre-creates all `sesion_series` rows (one per exercise × sets)
2. Active session at `/entrenar/[sesionId]` — auto-saves on blur (`handleBlur`) and toggle (`handleToggleCompletada`), both fire-and-forget
3. "Finalizar" sets `finalizada_at` timestamp — session is immutable after this
4. History at `/entrenamiento` (list) and `/entrenamiento/[sesionId]` (read-only detail)
5. Only one active session per user enforced by DB unique partial index on `sesiones(user_id) WHERE finalizada_at IS NULL`

**AI Chat:**
- `ChatBubble` component (fixed bottom-right) sends messages to `/api/chat`
- API calls OpenAI (gpt-4o-mini) with conversation history (max 6 recent messages)
- Conversation stored in localStorage + Supabase; max 10 messages per session

### Key Directories

- `app/api/` — Two API routes: `chat` (OpenAI proxy) and `generar-rutina` (OpenAI routine generation)
- `app/components/` — React components; `rutina/` sub-folder for exercise editing UI; `sesion/` sub-folder for `SerieRow`
- `app/hoy/` — Pantalla de inicio con sesión iniciada: el día que toca (el siguiente al último entrenado), la semana y la última sesión. Lógica pura en `lib/utils/hoy.ts`
- `app/rutinas/` — Routine management page (full CRUD)
- `app/entrenar/` — Start session page + active session UI (`[sesionId]/page.tsx`)
- `app/entrenamiento/` — Training history list + read-only session detail (`[sesionId]/page.tsx`)
- `lib/hooks/` — `useAuth`, `useCheckRoutine`, `useEjerciciosPool`
- `lib/services/rutina-service.ts` — All Supabase CRUD operations; receives client as parameter
- `lib/services/sesion-service.ts` — All session CRUD (crear, obtener, actualizar serie, finalizar, historial, eliminar)
- `lib/types/` — TypeScript types for DB entities (`database.ts`) and chat (`chat.ts`)
- `lib/prompts/system-prompt.txt` — GymLogic AI coach persona for chat (Spanish)
- `lib/prompts/system-prompt-rutina.txt` — GymLogic AI routine generation prompt (Spanish)

### Navegación

En el celular hay una barra inferior (Hoy, Rutina, Historial, Cuenta) en `AppLayout`; en escritorio, la barra lateral. La sesión activa (`/entrenar/[id]`) no muestra la barra ni el chat: tiene su propia barra inferior y el botón flotante tapaba la columna de completar serie. En el celular el chat no tiene botón flotante; se abre con `abrirChat()` de `lib/utils/chat-evento.ts` (hoy, desde el encabezado de Hoy). Con rutina, el inicio redirige a `/hoy`.

Sesión activa: el ejercicio "de ahora" es el primero con series sin completar (`lib/utils/sesion-activa.ts`); va abierto y los demás plegados. Completar una serie arranca solo el descanso (`BandaDescanso`), con la última duración elegida en el panel. El dato "Última vez" se busca por `ejercicio_id` en las últimas 30 sesiones, no por día de la rutina.

El contenedor de `AppLayout` usa `overflow-x-clip`, no `overflow-x-hidden`: hidden lo convierte en contenedor de scroll y rompe los encabezados `sticky`.

Terminar una sesión siempre pasa por `ConfirmarFinalizarPanel`: una sesión finalizada no se puede editar, así que nunca es un solo toque.

### Service Layer Pattern

`rutina-service.ts` functions receive the Supabase client as a parameter and return `ResultadoOperacion<T>` — a consistent `{ data, error }` wrapper. Validation (UUIDs, ranges) happens at the service level.

### Supabase Clients

- `lib/supabase/client.ts` — Browser client (use in client components)
- `lib/supabase/server.ts` — Server client using cookies (use in API routes and server components)

### Rate Limiting

- **Routine generation** (`/api/generar-rutina`): Supabase-based — counts rows in `rutinas` table with `created_at >= now - 1 min`. Limit: 2/minute per user. Works correctly in Vercel serverless multi-instance.
- **Chat** (`/api/chat`): In-memory Map, best-effort only (not reliable across serverless instances). Limit: 30/minute per user. For production robustness, migrate to Vercel KV or Upstash Redis.

### Row Level Security (RLS)

The service layer (`rutina-service.ts`) relies entirely on Supabase RLS for authorization — it does **not** perform ownership checks at the application layer. Before deploying to production, verify that RLS is **enabled** in the Supabase Dashboard for these tables:

- `rutinas` — SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`
- `rutina_dias` — ALL scoped via join: `rutina_id IN (SELECT id FROM rutinas WHERE user_id = auth.uid())`
- `rutina_ejercicios` — ALL scoped via join through `rutina_dias`
- `sesiones` — SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`
- `sesion_series` — ALL scoped via: `sesion_id IN (SELECT id FROM sesiones WHERE user_id = auth.uid())`
- `user_events` — INSERT only for authenticated user's own rows

Note: `eliminarSesion` also enforces ownership at the app layer as defense-in-depth.

If RLS is misconfigured or disabled, any authenticated user could read or modify another user's data.

### Analytics

Fire-and-forget event tracking that never blocks the UX thread. `lib/analytics.ts` for client-side, `lib/analytics-server.ts` for API routes. Tracked events: `rutina_generada`, `chat_interaccion`, `ejercicio_manual_edit`, `error_sistema`.

## Conventions

### Uso en el teléfono, en el gimnasio

La app se usa con una mano, cansado, entre series. Dos reglas:

- **Inputs a 16px mínimo** (`text-base` o sin clase de tamaño). Con menos, iOS Safari hace zoom automático al enfocar un campo, y en la pantalla de sesión activa eso pasa en cada serie.
- **Todo lo que se toca mide al menos 44px** (`min-h-11`, `w-11 h-11`). Si el objetivo visual es chico, agrandarlo con padding, no con texto más grande.

### Auth en el servidor: `getUser()`, nunca `getSession()`

En API routes y código de servidor, `getSession()` solo lee la cookie sin validarla, así que puede venir adulterada. `getUser()` valida el token contra Supabase. En componentes de cliente `getSession()` está bien.

### React / Supabase pattern (critical)

Always memoize the Supabase browser client in hooks and page components:
```ts
const supabase = useMemo(() => createClient(), [])
```
Without `useMemo`, `createClient()` returns a new object each render → unstable `useEffect`/`useCallback` deps → infinite re-render loops. Reference: `useAuth.ts`.

### Side-effects in setState updaters

Never call async functions (DB writes, fetch) inside `setState(prev => ...)` updaters — React Strict Mode invokes them twice, causing double writes. Pattern: capture data in an external variable inside the updater, call the service outside. See `handleBlur` and `handleToggleCompletada` in `app/entrenar/[sesionId]/page.tsx`.

**TypeScript note:** Variables mutated inside setState updaters are inferred as `never` by TypeScript after the `if (variable)` check. Use an explicit cast: `const casted = variable as Type | null`.

**Do NOT use `setTimeout` to read variables captured in setState updaters.** React 18 may batch state updates, so there is no guarantee the updater has run before `setTimeout` fires. Read the captured variable synchronously immediately after the `setSesion(...)` call.

### Reacting to state changes from intervals

`setInterval` callbacks cannot reliably read the result of a `setState` updater — in React 18 the updater is deferred, so an external variable mutated inside the updater may still be the initial value when the interval callback continues executing. **Never detect "done" conditions inside a `setInterval` callback by mutating a variable inside `setState`.** Instead, use a separate `useEffect` that declares the target state as a dependency:

```ts
// ✅ Correct: detect timer end in a dedicated useEffect
useEffect(() => {
  if (tiempoRestante !== 0 || !timerCorriendo) return
  setTimerCorriendo(false)
  // fire side-effects here
}, [tiempoRestante, timerCorriendo])

// The interval only decrements — no side-effects
useEffect(() => {
  if (!timerCorriendo) return
  const id = setInterval(() => {
    setTiempoRestante(prev => (prev <= 1 ? 0 : prev - 1))
  }, 1000)
  return () => clearInterval(id)
}, [timerCorriendo])
```

### Rangos de repeticiones por serie

`rutina_ejercicios.repeticiones` es texto y puede tener un rango distinto por serie, separado por `/`: `"6-8 / 8-10"`. Si hay menos rangos que series, el último se repite. Toda lectura o validación de ese campo pasa por `lib/utils/rangos-series.ts`; no partir el string a mano.

### Supabase row limit

Supabase JS v2 returns a maximum of **1000 rows** by default. Queries using `.in('column', largeArray)` (e.g., fetching `sesion_series` for all historical sessions) will silently truncate results if the total exceeds 1000 rows. Any query that could scale beyond that needs explicit `.range()` pagination or an RPC (stored function) with server-side aggregation. Current known risk: `obtenerHistorialSesiones` in `sesion-service.ts`.

- **Language:** All UI text, variable names, types, and comments are in Spanish
- **Client vs Server components:** Pages and interactive components use `'use client'`; the root layout is a server component
- **Path alias:** `@/*` maps to the project root (e.g., `@/lib/hooks`)
- **Styling:** Tailwind CSS v4 (PostCSS plugin); custom CSS variables defined in `globals.css`
- **Naming:** PascalCase for components/types, camelCase for functions, Spanish words throughout (e.g., `obtenerRutinaEditable`, `EjercicioEditable`)
