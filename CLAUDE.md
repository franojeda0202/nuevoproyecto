# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There are no automated tests configured in this project.

## Environment Setup

Copy `env.example` to `.env.local` and fill in the required values:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase project credentials
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

**AI Chat:**
- `ChatBubble` component (fixed bottom-right) sends messages to `/api/chat`
- API calls OpenAI (gpt-4o-mini) with conversation history (max 6 recent messages)
- Conversation stored in localStorage + Supabase; max 10 messages per session

### Key Directories

- `app/api/` — Two API routes: `chat` (OpenAI proxy) and `generar-rutina` (OpenAI routine generation)
- `app/components/` — React components; `rutina/` sub-folder for exercise editing UI
- `app/rutinas/` — Routine management page (full CRUD)
- `lib/hooks/` — `useAuth`, `useCheckRoutine`, `useEjerciciosPool`
- `lib/services/rutina-service.ts` — All Supabase CRUD operations; receives client as parameter
- `lib/types/` — TypeScript types for DB entities (`database.ts`) and chat (`chat.ts`)
- `lib/prompts/system-prompt.txt` — GymLogic AI coach persona for chat (Spanish)
- `lib/prompts/system-prompt-rutina.txt` — GymLogic AI routine generation prompt (Spanish)

### Service Layer Pattern

`rutina-service.ts` functions receive the Supabase client as a parameter and return `ResultadoOperacion<T>` — a consistent `{ data, error }` wrapper. Validation (UUIDs, ranges) happens at the service level.

### Supabase Clients

- `lib/supabase/client.ts` — Browser client (use in client components)
- `lib/supabase/server.ts` — Server client using cookies (use in API routes and server components)

### Rate Limiting

In-memory Map per user ID: 2 routine generations/minute, 30 chat messages/minute. Returns HTTP 429 when exceeded.

### Analytics

Fire-and-forget event tracking that never blocks the UX thread. `lib/analytics.ts` for client-side, `lib/analytics-server.ts` for API routes. Tracked events: `rutina_generada`, `chat_interaccion`, `ejercicio_manual_edit`, `error_sistema`.

## Conventions

- **Language:** All UI text, variable names, types, and comments are in Spanish
- **Client vs Server components:** Pages and interactive components use `'use client'`; the root layout is a server component
- **Path alias:** `@/*` maps to the project root (e.g., `@/lib/hooks`)
- **Styling:** Tailwind CSS v4 (PostCSS plugin); custom CSS variables defined in `globals.css`
- **Naming:** PascalCase for components/types, camelCase for functions, Spanish words throughout (e.g., `obtenerRutinaEditable`, `EjercicioEditable`)
