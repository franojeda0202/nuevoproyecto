# Mejora del Cerebro de Generación de Rutinas — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir el formulario de onboarding con 5 campos nuevos (objetivo, nivel, equipamiento, duración, género), persistir el perfil del usuario en Supabase, y mejorar el prompt de generación de rutinas para producir programas adaptados al perfil.

**Architecture:** Nueva tabla `perfiles` en Supabase con upsert en cada submit. Nuevo servicio `perfil-service.ts` siguiendo el patrón existente (supabase client como parámetro, `ResultadoOperacion<T>`). `OnboardingForm` completamente reescrito con pill buttons y pre-carga del perfil. La API recibe un body plano (sin wrapper `config`) y construye un prompt estructurado con el perfil completo.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS v2, Tailwind CSS v4, OpenAI SDK v6

**Spec:** `docs/superpowers/specs/2026-03-25-mejora-cerebro-rutina-design.md`

---

## Chunk 1: Base de datos, tipos y servicio

### Task 1: Migración manual en Supabase

> ⚠️ Esta tarea es MANUAL — no hay código que ejecutar en este proyecto. Hacerla PRIMERO antes de cualquier código.

**Files:** ninguno (SQL directo en Supabase Dashboard)

- [ ] **Step 1: Crear tabla `perfiles` en Supabase**

Ir a Supabase Dashboard → SQL Editor → ejecutar:

```sql
CREATE TABLE perfiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo         TEXT NOT NULL,
  nivel            TEXT NOT NULL,
  equipamiento     TEXT NOT NULL,
  duracion_minutos INTEGER NOT NULL,
  genero           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Configurar RLS**

```sql
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve su perfil" ON perfiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usuario crea su perfil" ON perfiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuario actualiza su perfil" ON perfiles
  FOR UPDATE USING (auth.uid() = user_id);
```

- [ ] **Step 3: Verificar en Supabase Dashboard**

Ir a Table Editor → verificar que la tabla `perfiles` aparece con las columnas correctas y que RLS aparece como "enabled".

---

### Task 2: Tipos en `lib/types/database.ts`

**Files:**
- Modify: `lib/types/database.ts` (líneas 84–96, donde están `OnboardingConfig` y `GenerarRutinaRequest`)

- [ ] **Step 1: Reemplazar los tipos de onboarding**

Encontrar y reemplazar el bloque actual (líneas 84–96):
```ts
// Tipos para el formulario de onboarding

export interface OnboardingConfig {
  frecuencia: number
  enfoque: string
  genero: string
  ubicacion: string
}

export interface GenerarRutinaRequest {
  user_id: string
  config: OnboardingConfig
}
```

Por:
```ts
// Tipos para el formulario de onboarding y perfil del usuario

export interface PerfilUsuario {
  objetivo: 'musculo' | 'fitness' | 'fuerza'
  nivel: 'principiante' | 'intermedio' | 'avanzado'
  equipamiento: 'bodyweight' | 'mancuernas' | 'barras' | 'gym_completo'
  duracionMinutos: 30 | 45 | 60 | 90
  genero: 'masculino' | 'femenino' | null
}

// Body del POST /api/generar-rutina (plano, sin wrapper config)
export interface GenerarRutinaRequest {
  user_id: string
  diasSemana: number
  objetivo: PerfilUsuario['objetivo']
  nivel: PerfilUsuario['nivel']
  equipamiento: PerfilUsuario['equipamiento']
  duracionMinutos: PerfilUsuario['duracionMinutos']
  focoMuscular: string  // '' cuando no hay preferencia, nunca undefined
  genero: PerfilUsuario['genero']
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: sin errores de TypeScript relacionados con `OnboardingConfig` o `GenerarRutinaRequest`. Si hay errores, son en archivos que importaban `OnboardingConfig` — los corregiremos en tasks posteriores.

- [ ] **Step 3: Commit**

```bash
git add lib/types/database.ts
git commit -m "feat: reemplazar OnboardingConfig por PerfilUsuario y GenerarRutinaRequest plano"
```

---

### Task 3: Servicio `lib/services/perfil-service.ts`

**Files:**
- Create: `lib/services/perfil-service.ts`

- [ ] **Step 1: Crear el archivo**

```ts
import { SupabaseClient } from '@supabase/supabase-js'
import { ResultadoOperacion, PerfilUsuario } from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Obtener perfil del usuario.
 * Retorna null si el usuario no tiene perfil guardado aún (primera vez).
 */
export async function obtenerPerfil(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<PerfilUsuario | null>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('objetivo, nivel, equipamiento, duracion_minutos, genero')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (!data) return { success: true, data: null }

    return {
      success: true,
      data: {
        objetivo: data.objetivo as PerfilUsuario['objetivo'],
        nivel: data.nivel as PerfilUsuario['nivel'],
        equipamiento: data.equipamiento as PerfilUsuario['equipamiento'],
        duracionMinutos: data.duracion_minutos as PerfilUsuario['duracionMinutos'],
        genero: (data.genero ?? null) as PerfilUsuario['genero'],
      },
    }
  } catch (err) {
    console.error('Error en obtenerPerfil:', err)
    return { success: false, error: 'Error al cargar perfil' }
  }
}

/**
 * Guardar o actualizar perfil del usuario (upsert).
 * Incluye updated_at explícito para que se actualice en cada save.
 */
export async function guardarPerfil(
  supabase: SupabaseClient,
  userId: string,
  datos: PerfilUsuario
): Promise<ResultadoOperacion<PerfilUsuario>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('perfiles')
      .upsert(
        {
          user_id: userId,
          objetivo: datos.objetivo,
          nivel: datos.nivel,
          equipamiento: datos.equipamiento,
          duracion_minutos: datos.duracionMinutos,
          genero: datos.genero,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('objetivo, nivel, equipamiento, duracion_minutos, genero')
      .single()

    if (error) throw error

    return {
      success: true,
      data: {
        objetivo: data.objetivo as PerfilUsuario['objetivo'],
        nivel: data.nivel as PerfilUsuario['nivel'],
        equipamiento: data.equipamiento as PerfilUsuario['equipamiento'],
        duracionMinutos: data.duracion_minutos as PerfilUsuario['duracionMinutos'],
        genero: (data.genero ?? null) as PerfilUsuario['genero'],
      },
    }
  } catch (err) {
    console.error('Error en guardarPerfil:', err)
    return { success: false, error: 'Error al guardar perfil' }
  }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: sin errores en `perfil-service.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/services/perfil-service.ts
git commit -m "feat: agregar perfil-service con obtenerPerfil y guardarPerfil"
```

---

## Chunk 2: Formulario y página principal

### Task 4: Rediseño de `app/components/OnboardingForm.tsx`

**Files:**
- Modify: `app/components/OnboardingForm.tsx` (reescritura completa)

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { obtenerPerfil, guardarPerfil } from '@/lib/services/perfil-service'

export interface OnboardingData {
  diasSemana: number
  objetivo: 'musculo' | 'fitness' | 'fuerza'
  nivel: 'principiante' | 'intermedio' | 'avanzado'
  equipamiento: 'bodyweight' | 'mancuernas' | 'barras' | 'gym_completo'
  duracionMinutos: 30 | 45 | 60 | 90
  focoMuscular: string
  genero: 'masculino' | 'femenino' | null
}

interface OnboardingFormProps {
  onSubmit: (data: OnboardingData) => void
  supabase: SupabaseClient
  userId: string
}

const DEFAULTS: OnboardingData = {
  diasSemana: 3,
  objetivo: 'musculo',
  nivel: 'principiante',
  equipamiento: 'gym_completo',
  duracionMinutos: 60,
  focoMuscular: '',
  genero: null,
}

const FOCO_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sin preferencia' },
  { value: 'pecho', label: 'Pecho' },
  { value: 'espalda', label: 'Espalda' },
  { value: 'hombros', label: 'Hombros' },
  { value: 'brazos', label: 'Brazos' },
  { value: 'piernas', label: 'Piernas' },
  { value: 'gluteos', label: 'Glúteos' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
]

function PillGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string | number | null; label: string }[]
  value: string | number | null
  onChange: (v: string | number | null) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
            value === opt.value
              ? 'bg-yellow-500 border-yellow-500 text-black'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const OBJETIVO_LABEL: Record<string, string> = {
  musculo: 'Ganar músculo',
  fitness: 'Fitness general',
  fuerza: 'Fuerza',
}
const NIVEL_LABEL: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}
const EQUIP_LABEL: Record<string, string> = {
  bodyweight: 'Bodyweight',
  mancuernas: 'Mancuernas',
  barras: 'Barras + rack',
  gym_completo: 'Gym completo',
}
const GENERO_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
}

export default function OnboardingForm({ onSubmit, supabase, userId }: OnboardingFormProps) {
  const [formData, setFormData] = useState<OnboardingData>(DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  // Pre-cargar perfil guardado al montar
  useEffect(() => {
    let cancelled = false
    async function cargar() {
      const resultado = await obtenerPerfil(supabase, userId)
      if (cancelled) return
      if (resultado.success && resultado.data) {
        const p = resultado.data
        setFormData(prev => ({
          ...prev,
          objetivo: p.objetivo,
          nivel: p.nivel,
          equipamiento: p.equipamiento,
          duracionMinutos: p.duracionMinutos,
          genero: p.genero,
        }))
      }
      // Si falla, ignorar silenciosamente y mantener defaults
      setCargando(false)
    }
    cargar()
    return () => { cancelled = true }
  }, [supabase, userId])

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorPerfil(null)
    setGuardando(true)

    const resultado = await guardarPerfil(supabase, userId, {
      objetivo: formData.objetivo,
      nivel: formData.nivel,
      equipamiento: formData.equipamiento,
      duracionMinutos: formData.duracionMinutos,
      genero: formData.genero,
    })

    setGuardando(false)

    if (!resultado.success) {
      setErrorPerfil('No se pudo guardar tu perfil. Intenta de nuevo.')
      return
    }

    onSubmit(formData)
  }

  const focoLabel = FOCO_OPTIONS.find(o => o.value === formData.focoMuscular)?.label

  return (
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-1">
            <svg className="w-10 h-10 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
            </svg>
            <h1 className="text-6xl md:text-7xl font-display text-slate-900 tracking-widest uppercase leading-none">
              GymLogic
            </h1>
          </div>
          {cargando ? (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Cargando tu perfil...</span>
            </div>
          ) : (
            <p className="text-slate-500 text-base font-medium mt-3">Tu coach digital personal</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-8 md:p-10 space-y-8 border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-400" />

          {/* Días por semana */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuántos días podés entrenar por semana?
            </label>
            <PillGroup
              options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: `${n} días` }))}
              value={formData.diasSemana}
              onChange={(v) => set('diasSemana', v as number)}
              disabled={cargando}
            />
          </div>

          {/* Objetivo */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuál es tu objetivo?
            </label>
            <PillGroup
              options={[
                { value: 'musculo', label: 'Ganar músculo' },
                { value: 'fitness', label: 'Fitness general' },
                { value: 'fuerza', label: 'Fuerza' },
              ]}
              value={formData.objetivo}
              onChange={(v) => set('objetivo', v as OnboardingData['objetivo'])}
              disabled={cargando}
            />
          </div>

          {/* Nivel */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuál es tu nivel de experiencia?
            </label>
            <PillGroup
              options={[
                { value: 'principiante', label: 'Principiante' },
                { value: 'intermedio', label: 'Intermedio' },
                { value: 'avanzado', label: 'Avanzado' },
              ]}
              value={formData.nivel}
              onChange={(v) => set('nivel', v as OnboardingData['nivel'])}
              disabled={cargando}
            />
          </div>

          {/* Equipamiento */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Qué equipamiento tenés disponible?
            </label>
            <PillGroup
              options={[
                { value: 'bodyweight', label: 'Bodyweight' },
                { value: 'mancuernas', label: 'Mancuernas' },
                { value: 'barras', label: 'Barras + rack' },
                { value: 'gym_completo', label: 'Gym completo' },
              ]}
              value={formData.equipamiento}
              onChange={(v) => set('equipamiento', v as OnboardingData['equipamiento'])}
              disabled={cargando}
            />
          </div>

          {/* Duración */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              ¿Cuánto tiempo tenés por sesión?
            </label>
            <PillGroup
              options={[
                { value: 30, label: '30 min' },
                { value: 45, label: '45 min' },
                { value: 60, label: '60 min' },
                { value: 90, label: '90 min' },
              ]}
              value={formData.duracionMinutos}
              onChange={(v) => set('duracionMinutos', v as OnboardingData['duracionMinutos'])}
              disabled={cargando}
            />
          </div>

          {/* Foco muscular */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Preferencia de foco muscular <span className="text-gray-500 font-normal">(Opcional)</span>
            </label>
            <PillGroup
              options={FOCO_OPTIONS}
              value={formData.focoMuscular}
              onChange={(v) => set('focoMuscular', v as string)}
              disabled={cargando}
            />
          </div>

          {/* Género */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Género <span className="text-gray-500 font-normal">(Opcional)</span>
            </label>
            <PillGroup
              options={[
                { value: 'masculino', label: 'Masculino' },
                { value: 'femenino', label: 'Femenino' },
                { value: null, label: 'Prefiero no decir' },
              ]}
              value={formData.genero}
              onChange={(v) => set('genero', v as OnboardingData['genero'])}
              disabled={cargando}
            />
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 mb-1">¿Por qué te preguntamos esto?</p>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>La ciencia indica que las diferencias programáticas son menores de lo que se cree</li>
                <li>Las mujeres toleran más volumen y se recuperan más rápido entre series</li>
                <li>Las mujeres responden bien a rep ranges más altos (12–20 reps)</li>
                <li>Ambos sexos ganan músculo con los mismos movimientos — la diferencia es de preferencia y punto de partida</li>
                <li>En la práctica, el enfoque femenino suele ser más en tren inferior/glúteos; el masculino en tren superior</li>
              </ul>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Tu configuración:</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {formData.diasSemana} días/semana
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {OBJETIVO_LABEL[formData.objetivo]}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {NIVEL_LABEL[formData.nivel]}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {EQUIP_LABEL[formData.equipamiento]}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                {formData.duracionMinutos} min
              </span>
              {formData.focoMuscular && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-700">
                  Foco: {focoLabel}
                </span>
              )}
              {formData.genero && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-700">
                  {GENERO_LABEL[formData.genero]}
                </span>
              )}
            </div>
          </div>

          {/* Error al guardar perfil */}
          {errorPerfil && (
            <p className="text-sm text-red-600 text-center">{errorPerfil}</p>
          )}

          <button
            type="submit"
            disabled={cargando || guardando}
            className="w-full py-4 h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{guardando ? 'Guardando...' : 'Generar mi rutina'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Rutinas personalizadas con IA • Powered by GymLogic
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: TypeScript compila sin errores en `OnboardingForm.tsx`. Habrá errores en `app/page.tsx` porque aún espera los props viejos — se resuelven en el siguiente task.

- [ ] **Step 3: Commit**

```bash
git add app/components/OnboardingForm.tsx
git commit -m "feat: rediseñar OnboardingForm con pill buttons y 5 campos nuevos"
```

---

### Task 5: Actualizar `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

El padre del formulario. Necesita:
1. Agregar `useMemo` para estabilizar el cliente Supabase (es pasado al form como dep de useEffect)
2. Pasar `supabase` y `userId` al `<OnboardingForm>`
3. Actualizar el body del POST a la nueva estructura plana

- [ ] **Step 1: Agregar `useMemo` al import y estabilizar `supabase`**

En `app/page.tsx`, el import actual es:
```ts
import { useState } from 'react'
```

Reemplazarlo por:
```ts
import { useState, useMemo } from 'react'
```

Y la línea:
```ts
const supabase = createClient()
```

Reemplazarla por:
```ts
const supabase = useMemo(() => createClient(), [])
```

- [ ] **Step 2: Actualizar `handleFormSubmit`**

Reemplazar el bloque `requestBody` y `trackEvent` actuales:

```ts
// Antes:
const requestBody = {
  user_id: userId,
  config: {
    frecuencia: data.daysPerWeek,
    enfoque: data.muscleFocus || 'full_body',
    genero: data.gender,
    ubicacion: data.location
  }
}
```

Por:
```ts
// Nuevo (body plano, sin wrapper config):
const requestBody = {
  user_id: userId,
  diasSemana: data.diasSemana,
  objetivo: data.objetivo,
  nivel: data.nivel,
  equipamiento: data.equipamiento,
  duracionMinutos: data.duracionMinutos,
  focoMuscular: data.focoMuscular,
  genero: data.genero,
}
```

Y el `trackEvent` actual:
```ts
trackEvent('rutina_generada', {
  dias: data.daysPerWeek,
  objetivo: data.muscleFocus || 'full_body',
  genero: data.gender,
  ubicacion: data.location,
})
```

Por:
```ts
trackEvent('rutina_generada', {
  dias: data.diasSemana,
  objetivo: data.objetivo,
  nivel: data.nivel,
  equipamiento: data.equipamiento,
  duracionMinutos: data.duracionMinutos,
  focoMuscular: data.focoMuscular || 'sin preferencia',
  genero: data.genero || 'no especificado',
})
```

- [ ] **Step 3: Pasar `supabase` y `userId` al formulario**

En el JSX, reemplazar:
```tsx
<OnboardingForm onSubmit={handleFormSubmit} />
```

Por:
```tsx
<OnboardingForm
  onSubmit={handleFormSubmit}
  supabase={supabase}
  userId={userId!}
/>
```

Nota: `userId` viene del hook `useAuth()`. La línea `if (!authenticated)` antes del return garantiza que `userId` no es null aquí.

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Esperado: sin errores de TypeScript. Si `npm run build` da error sobre `OnboardingData` — verificar que `app/page.tsx` importa el tipo del nuevo `OnboardingForm.tsx`:
```ts
import OnboardingForm, { OnboardingData } from './components/OnboardingForm'
```
(Ya está así desde antes — solo verificar que el import persiste.)

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: actualizar page.tsx para pasar supabase/userId al form y nuevo body de API"
```

---

## Chunk 3: API y prompt

### Task 6: Actualizar `app/api/generar-rutina/route.ts`

**Files:**
- Modify: `app/api/generar-rutina/route.ts`

Cambios: nuevo `VALORES_VALIDOS`, nueva función `validarRequest`, nuevo `buildUserPrompt`, body parsing plano, y actualizar el INSERT de rutina.

- [ ] **Step 1: Reemplazar `VALORES_VALIDOS`**

Encontrar y reemplazar:
```ts
const VALORES_VALIDOS = {
  genero: ['male', 'female', 'other'] as const,
  ubicacion: ['gym', 'home'] as const,
  enfoque: ['pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'gluteos', 'core', 'full_body'] as const,
  frecuencia: { min: 2, max: 6 },
}
```

Por:
```ts
const VALORES_VALIDOS = {
  objetivo: ['musculo', 'fitness', 'fuerza'] as const,
  nivel: ['principiante', 'intermedio', 'avanzado'] as const,
  equipamiento: ['bodyweight', 'mancuernas', 'barras', 'gym_completo'] as const,
  duracionMinutos: [30, 45, 60, 90] as const,
  genero: ['masculino', 'femenino'] as const,
  focoMuscular: ['', 'pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'gluteos', 'core', 'full_body'] as const,
  diasSemana: { min: 2, max: 6 },
}
```

- [ ] **Step 2: Reemplazar `validarConfig` por `validarRequest`**

Encontrar y reemplazar la función `validarConfig` completa:
```ts
function validarConfig(config: GenerarRutinaRequest['config']): boolean {
  if (
    typeof config.frecuencia !== 'number' ||
    config.frecuencia < VALORES_VALIDOS.frecuencia.min ||
    config.frecuencia > VALORES_VALIDOS.frecuencia.max
  ) return false
  if (config.genero && !(VALORES_VALIDOS.genero as readonly string[]).includes(config.genero)) return false
  if (config.ubicacion && !(VALORES_VALIDOS.ubicacion as readonly string[]).includes(config.ubicacion)) return false
  if (config.enfoque && !(VALORES_VALIDOS.enfoque as readonly string[]).includes(config.enfoque)) return false
  return true
}
```

Por:
```ts
function validarRequest(body: GenerarRutinaRequest): boolean {
  if (
    typeof body.diasSemana !== 'number' ||
    body.diasSemana < VALORES_VALIDOS.diasSemana.min ||
    body.diasSemana > VALORES_VALIDOS.diasSemana.max
  ) return false
  if (!(VALORES_VALIDOS.objetivo as readonly string[]).includes(body.objetivo)) return false
  if (!(VALORES_VALIDOS.nivel as readonly string[]).includes(body.nivel)) return false
  if (!(VALORES_VALIDOS.equipamiento as readonly string[]).includes(body.equipamiento)) return false
  if (!(VALORES_VALIDOS.duracionMinutos as readonly number[]).includes(body.duracionMinutos)) return false
  if (body.genero !== null && body.genero !== undefined &&
      !(VALORES_VALIDOS.genero as readonly string[]).includes(body.genero)) return false
  if (!(VALORES_VALIDOS.focoMuscular as readonly string[]).includes(body.focoMuscular)) return false
  return true
}
```

- [ ] **Step 3: Reemplazar `buildUserPrompt`**

Encontrar y reemplazar la función `buildUserPrompt` completa:
```ts
function buildUserPrompt(userId: string, config: GenerarRutinaRequest['config'], ejercicios: unknown[]): string {
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
```

Por:
```ts
function buildUserPrompt(userId: string, req: GenerarRutinaRequest, ejercicios: unknown[]): string {
  return `Actúa como GymLogic AI. Diseña una rutina de alta optimización biomecánica.

DATOS DEL USUARIO:
- USER_ID: ${userId}

PERFIL DEL USUARIO:
- Objetivo: ${req.objetivo}
- Nivel de experiencia: ${req.nivel}
- Equipamiento disponible: ${req.equipamiento}
- Duración de sesión: ${req.duracionMinutos} minutos
- Días de entrenamiento: ${req.diasSemana} días/semana
- Foco muscular: ${req.focoMuscular || 'sin preferencia'}
- Género: ${req.genero || 'no especificado'}

LISTA DE EJERCICIOS DISPONIBLES (USA SOLO ESTOS IDs):
${JSON.stringify(ejercicios)}

INSTRUCCIÓN CRÍTICA DE IDs:
Revisa cada 'ejercicio_id' generado. Si no es un UUID de la lista anterior, bórralo y elige un ejercicio que SÍ tenga un UUID válido de la lista. No inventes datos.

El campo "user_id" en el JSON final debe ser: ${userId}`
}
```

- [ ] **Step 4: Actualizar el body parsing y las referencias a `config`**

En el handler `POST`, encontrar:
```ts
// Validar que config exista y tenga la forma esperada
const config = body?.config as GenerarRutinaRequest['config'] | undefined
if (!config || typeof config !== 'object' || !validarConfig(config)) {
  return NextResponse.json({ error: 'Configuración de rutina inválida' }, { status: 400 })
}
```

Reemplazar por:
```ts
// Construir el objeto request y validarlo
const req: GenerarRutinaRequest = {
  user_id: bodyUserId,
  diasSemana: body?.diasSemana,
  objetivo: body?.objetivo,
  nivel: body?.nivel,
  equipamiento: body?.equipamiento,
  duracionMinutos: body?.duracionMinutos,
  focoMuscular: body?.focoMuscular ?? '',
  genero: body?.genero ?? null,
}
if (!validarRequest(req)) {
  return NextResponse.json({ error: 'Configuración de rutina inválida' }, { status: 400 })
}
```

- [ ] **Step 5: Actualizar las llamadas que usan `config`**

Buscar y actualizar:

a) La llamada a `buildUserPrompt`:
```ts
// Antes:
{ role: 'user', content: buildUserPrompt(userId, config, ejercicios) },
// Después:
{ role: 'user', content: buildUserPrompt(userId, req, ejercicios) },
```

b) El INSERT de `rutinas` que usa `config.frecuencia`:
```ts
// Antes:
.insert({
  nombre: rutinaGenerada.nombre_rutina,
  user_id: userId,
  frecuencia: config.frecuencia,
})
// Después:
.insert({
  nombre: rutinaGenerada.nombre_rutina,
  user_id: userId,
  frecuencia: req.diasSemana,
})
```

- [ ] **Step 6: Verificar build**

```bash
npm run build
```

Esperado: sin errores de TypeScript en el route. El build debe pasar completamente limpio.

- [ ] **Step 7: Commit**

```bash
git add "app/api/generar-rutina/route.ts"
git commit -m "feat: actualizar API generar-rutina con body plano, nuevos campos y buildUserPrompt mejorado"
```

---

### Task 7: Actualizar `lib/prompts/system-prompt-rutina.txt`

**Files:**
- Modify: `lib/prompts/system-prompt-rutina.txt`

El contenido actual tiene 8 secciones. Eliminar `## VOLUMEN Y SERIES` y `## EQUIPAMIENTO`, agregar `## PERFIL DEL USUARIO`.

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```
Eres "GymLogic AI". Tu única función es diseñar rutinas de entrenamiento y devolverlas en formato JSON usando exclusivamente los datos proporcionados.

## BASE CIENTÍFICA (aplicar siempre)
1. Orden: Compuestos técnicos primero, aislamientos al final.
2. SFR: Priorizá ejercicios de alto estímulo y baja fatiga articular.
3. Volumen por grupo muscular: máximo 10 series directas por sesión.
4. Volumen indirecto: los presses trabajan tríceps; los remos, bíceps. Contabilizarlo.
5. Series duras: todas las series cerca del fallo (RIR 0-3 según el tipo).

## DISTRIBUCIÓN SEMANAL
- Frecuencia 3: Full Body × 3 días.
- Frecuencia 4: Torso/Pierna (días 1/3: Torso, días 2/4: Pierna).
- Frecuencia 5: Push / Pull / Legs / Upper / Lower.
- Frecuencia 6: Push / Pull / Legs × 2.
- No repetir el mismo ejercicio principal en días consecutivos.

## PERFIL DEL USUARIO
Adaptar la rutina según el perfil recibido en el mensaje. Las reglas de NIVEL y DURACIÓN son las autoridades para volumen — ignorar cualquier regla anterior que contradiga estas tablas.

### Por NIVEL — ejercicios y series por sesión
| Nivel         | Ejercicios/día | Series totales/sesión |
|---------------|----------------|----------------------|
| principiante  | 3–4            | 12–16                |
| intermedio    | 4–5            | 16–20                |
| avanzado      | 5–6            | 20–25                |

Prioridad: el NIVEL define el máximo de ejercicios. La DURACIÓN define las series por ejercicio. Usar el mínimo de ambos como techo.

Reglas adicionales:
- principiante: solo movimientos compuestos básicos, sin ejercicios olímpicos ni variaciones de alta técnica (snatch, clean, etc.)
- avanzado: puede incluir variaciones técnicas avanzadas y mencionar intensification techniques en la nota del coach

### Por DURACIÓN — series por ejercicio
| Duración | Series por ejercicio |
|----------|---------------------|
| 30 min   | 2–3 series          |
| 45 min   | 3 series            |
| 60 min   | 3–4 series          |
| 90 min   | 4–5 series          |

### Por OBJETIVO — rep ranges
- musculo: compuestos principales 6–8 reps (RIR 2–3), accesorios 10–12 reps (RIR 1–2). Combinar ambos rangos en cada sesión.
- fitness: 12–15 reps en todos los ejercicios. Priorizar variedad de patrones (push, pull, hinge, squat, core). Al menos un ejercicio de core por sesión.
- fuerza: compuestos 3–5 reps (RIR 2–3). Priorizar squat con barra, bench press, peso muerto, press militar. Limitar accesorios a 2–3 ejercicios de soporte.

### Por EQUIPAMIENTO — ejercicios disponibles
- bodyweight: solo ejercicios sin equipamiento (push-ups y variantes, sentadillas, estocadas, dominadas si hay barra, dips, plank, core). Progresión por variante de dificultad.
- mancuernas: sin barras olímpicas, sin máquinas de cable, sin máquinas de palanca. Solo mancuernas y peso corporal.
- barras: barras olímpicas, rack y mancuernas disponibles. Sin máquinas. Priorizar squat con barra, bench press, peso muerto, press militar.
- gym_completo: todos los ejercicios de la lista disponibles. Para nivel principiante: priorizar máquinas (mayor seguridad y control).

### Por GÉNERO
- masculino: distribución equilibrada con ligero sesgo hacia tren superior (pecho, espalda, hombros).
- femenino: aumentar volumen en tren inferior — glúteos, isquiotibiales, cuádriceps. Priorizar hip thrust, peso muerto rumano, sentadilla búlgara, abducción de cadera. Rep ranges en el extremo alto del rango del objetivo.
- no especificado: distribución balanceada sin sesgo.

## FOCO MUSCULAR
Cuando el usuario pide foco en un grupo (ej: pecho), agregá 1-2 series extra de ese grupo respecto al resto, dentro del límite de 10 series/grupo. No cambies la estructura base de la distribución.

## NOTAS DEL COACH (campo "notas")
Para cada ejercicio escribí una nota corta (máx 10 palabras) con el tip técnico más importante o el rango de RIR objetivo. Ejemplos: "Codos atrás, no flectés la muñeca. RIR 1-2." / "Controlá la excéntrica 2s. RIR 2."

## REGLAS DE IDs (CRÍTICO — no romper nunca)
1. El campo "ejercicio_id" debe ser SIEMPRE un UUID copiado literalmente de la lista proporcionada. 36 caracteres exactos, incluyendo guiones.
2. Prohibido inventar IDs, abreviarlos o modificar cualquier carácter.
3. Si un grupo muscular no tiene ejercicios en la lista, reemplazarlo por otro grupo que sí tenga. Nunca escribir texto en "ejercicio_id".

## FORMATO DE SALIDA
Respondé ÚNICAMENTE con JSON puro. Sin markdown, sin explicaciones, sin texto fuera del JSON.

Estructura:
{
  "user_id": "<ID del usuario>",
  "nombre_rutina": "<nombre descriptivo>",
  "dias": [
    {
      "nombre_dia": "<ej: Torso 1>",
      "orden": 1,
      "ejercicios": [
        {
          "ejercicio_id": "<UUID exacto de la lista>",
          "series": 3,
          "reps": "8-10",
          "orden": 1,
          "notas": "<tip técnico o RIR>"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: build limpio. El archivo `.txt` no afecta TypeScript — solo verificar que el build pasa sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/prompts/system-prompt-rutina.txt
git commit -m "feat: actualizar prompt de generación con reglas por objetivo, nivel, equipamiento, duración y género"
```

---

## Chunk 4: Verificación end-to-end

### Task 8: Verificación manual

> Sin tests automatizados en este proyecto. Verificar manualmente con `npm run dev`.

- [ ] **Step 1: Iniciar servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Step 2: Verificar formulario — primera vez**

1. Abrir la app en el browser
2. Iniciar sesión con una cuenta de prueba
3. Verificar que el formulario muestra el spinner "Cargando tu perfil..." brevemente
4. Verificar que todos los campos aparecen como pill buttons
5. Verificar que "Prefiero no decir" aparece seleccionado en Género por default
6. Verificar que el bloque informativo de género es visible
7. Verificar que el panel de resumen se actualiza al cambiar pills

- [ ] **Step 3: Verificar formulario — generación y persistencia**

1. Seleccionar: 4 días / Ganar músculo / Intermedio / Gym completo / 60 min / Piernas / Femenino
2. Hacer click en "Generar mi rutina"
3. Verificar que aparece "Guardando..." brevemente en el botón
4. Verificar que la rutina se genera y redirige a `/rutinas`
5. Volver a `/` y verificar que el formulario pre-carga los valores seleccionados

- [ ] **Step 4: Verificar en Supabase**

En Supabase Dashboard → Table Editor → `perfiles`: verificar que hay una fila con los valores correctos para el usuario de prueba.

- [ ] **Step 5: Verificar rutina generada**

En `/rutinas`, verificar que la rutina generada:
- Tiene 4 días (distribución Torso/Pierna)
- Los ejercicios reflejan foco en piernas y tren inferior (por género femenino)
- Los rep ranges son acordes al objetivo "músculo" (mix de 6–8 y 10–12)

- [ ] **Step 6: Build final de producción**

```bash
npm run build
```

Esperado: build exitoso sin errores ni warnings nuevos.

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "feat: verificación end-to-end completa — mejora del cerebro de generación de rutinas"
```
