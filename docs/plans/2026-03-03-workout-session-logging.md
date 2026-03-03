# Workout Session Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir al usuario registrar sesiones de entrenamiento: selecciona el día, carga peso y reps por serie con auto-save, y los datos persisten aunque cierre la app.

**Architecture:** 6 tareas. Task 1 es manual (SQL en Supabase + tipos TypeScript). Tasks 2-5 son código puro. Task 6 agrega el botón de entrada en la página existente. El service layer sigue el patrón de `rutina-service.ts`: recibe supabase client como parámetro, retorna `ResultadoOperacion<T>`.

**Tech Stack:** Next.js 16 App Router, Supabase, Tailwind CSS v4, TypeScript

---

### Task 1: DB schema en Supabase + tipos TypeScript

**Files:**
- Manual: SQL en Supabase Dashboard → SQL Editor
- Modify: `lib/types/database.ts`

**Step 1: Crear tablas en Supabase Dashboard**

Ir a **Supabase Dashboard → SQL Editor** y ejecutar:

```sql
-- Tabla de sesiones de entrenamiento
CREATE TABLE sesiones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  rutina_id     uuid references rutinas(id) on delete cascade not null,
  dia_id        uuid references rutina_dias(id) on delete cascade not null,
  iniciada_at   timestamptz default now() not null,
  finalizada_at timestamptz,
  created_at    timestamptz default now() not null
);

-- Tabla de series registradas en cada sesión
CREATE TABLE sesion_series (
  id                   uuid primary key default gen_random_uuid(),
  sesion_id            uuid references sesiones(id) on delete cascade not null,
  rutina_ejercicio_id  uuid references rutina_ejercicios(id) on delete cascade not null,
  numero_serie         int not null,
  peso_kg              decimal(6,2),
  repeticiones         int,
  completada           boolean default false not null,
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);
```

**Step 2: Habilitar RLS y crear políticas**

```sql
-- RLS para sesiones
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias sesiones"
  ON sesiones FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS para sesion_series (acceso via sesiones)
ALTER TABLE sesion_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias series"
  ON sesion_series FOR ALL
  USING (
    sesion_id IN (
      SELECT id FROM sesiones WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    sesion_id IN (
      SELECT id FROM sesiones WHERE user_id = auth.uid()
    )
  );
```

**Step 3: Verificar en Supabase Dashboard → Table Editor**

Confirmar que existen las tablas `sesiones` y `sesion_series` con RLS habilitado y las políticas creadas.

**Step 4: Agregar tipos TypeScript a `lib/types/database.ts`**

Al final del archivo, agregar:

```ts
// ============================================
// Tipos para Sesiones de Entrenamiento
// ============================================

export interface Sesion {
  id: string
  user_id: string
  rutina_id: string
  dia_id: string
  iniciada_at: string
  finalizada_at: string | null
  created_at: string
}

export interface SesionSerie {
  id: string
  sesion_id: string
  rutina_ejercicio_id: string
  numero_serie: number
  peso_kg: number | null
  repeticiones: number | null
  completada: boolean
  created_at: string
  updated_at: string
}

// Estado editable de una serie (inputs como string para los inputs HTML)
export interface SesionSerieEditable {
  id: string
  sesion_id: string
  rutina_ejercicio_id: string
  numero_serie: number
  peso_kg: string       // string para el input (vacío = no ingresado)
  repeticiones: string  // string para el input
  completada: boolean
}

// Ejercicio con sus series para la pantalla de sesión activa
export interface EjercicioConSeries {
  rutina_ejercicio_id: string
  nombre: string
  series_rutina: number  // cuántas series tiene programadas en la rutina
  series: SesionSerieEditable[]
  ultima_serie: { peso_kg: number | null; repeticiones: number | null } | null  // pre-fill
}

// Datos completos para la pantalla de sesión activa
export interface SesionActiva {
  id: string
  dia_nombre: string
  finalizada_at: string | null
  ejercicios: EjercicioConSeries[]
}
```

**Step 5: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso sin errores TypeScript.

**Step 6: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/types/database.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: tipos TypeScript para sesiones de entrenamiento

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Crear sesion-service.ts

**Files:**
- Create: `lib/services/sesion-service.ts`

**Context:** El service layer sigue exactamente el patrón de `lib/services/rutina-service.ts`. Recibe `supabase: SupabaseClient` como primer parámetro, retorna `ResultadoOperacion<T>`. Importa `isValidUUID` desde `rutina-service`. Los comentarios en español.

**Step 1: Crear el archivo**

```ts
import { SupabaseClient } from '@supabase/supabase-js'
import {
  ResultadoOperacion,
  SesionActiva,
  SesionSerieEditable,
  EjercicioConSeries,
} from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Crear una nueva sesión de entrenamiento para un día
 * También crea todas las filas de sesion_series (una por ejercicio × serie)
 */
export async function crearSesion(
  supabase: SupabaseClient,
  params: { userId: string; rutinaId: string; diaId: string }
): Promise<ResultadoOperacion<{ sesionId: string }>> {
  if (!isValidUUID(params.userId) || !isValidUUID(params.rutinaId) || !isValidUUID(params.diaId)) {
    return { success: false, error: 'IDs inválidos' }
  }

  try {
    // Crear la sesión
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .insert({
        user_id: params.userId,
        rutina_id: params.rutinaId,
        dia_id: params.diaId,
      })
      .select('id')
      .single()

    if (sesionError || !sesion) {
      console.error('Error creando sesión:', sesionError)
      return { success: false, error: 'Error al crear la sesión' }
    }

    // Cargar ejercicios del día para crear las series
    const { data: ejercicios, error: ejError } = await supabase
      .from('rutina_ejercicios')
      .select('id, series, orden')
      .eq('dia_id', params.diaId)
      .order('orden', { ascending: true })

    if (ejError || !ejercicios) {
      // Limpiar la sesión creada
      await supabase.from('sesiones').delete().eq('id', sesion.id)
      return { success: false, error: 'Error al cargar ejercicios del día' }
    }

    // Crear filas de sesion_series: una por ejercicio × número de series
    const seriesRows = ejercicios.flatMap(ej =>
      Array.from({ length: ej.series }, (_, i) => ({
        sesion_id: sesion.id,
        rutina_ejercicio_id: ej.id,
        numero_serie: i + 1,
        peso_kg: null,
        repeticiones: null,
        completada: false,
      }))
    )

    if (seriesRows.length > 0) {
      const { error: insertError } = await supabase
        .from('sesion_series')
        .insert(seriesRows)

      if (insertError) {
        console.error('Error creando series:', insertError)
        await supabase.from('sesiones').delete().eq('id', sesion.id)
        return { success: false, error: 'Error al inicializar la sesión' }
      }
    }

    return { success: true, data: { sesionId: sesion.id } }
  } catch (err) {
    console.error('Error en crearSesion:', err)
    return { success: false, error: 'Error al crear la sesión' }
  }
}

/**
 * Buscar sesión en progreso (sin finalizada_at) del usuario
 */
export async function obtenerSesionEnProgreso(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<{ sesionId: string; diaNombre: string } | null>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('sesiones')
      .select('id, rutina_dias(nombre_dia)')
      .eq('user_id', userId)
      .is('finalizada_at', null)
      .order('iniciada_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error buscando sesión en progreso:', error)
      return { success: false, error: 'Error al buscar sesión en progreso' }
    }

    if (!data) return { success: true, data: null }

    return {
      success: true,
      data: {
        sesionId: data.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        diaNombre: (data.rutina_dias as any)?.nombre_dia || '',
      },
    }
  } catch (err) {
    console.error('Error en obtenerSesionEnProgreso:', err)
    return { success: false, error: 'Error al buscar sesión en progreso' }
  }
}

/**
 * Cargar todos los datos para la pantalla de sesión activa:
 * - Info de la sesión + nombre del día
 * - Ejercicios del día con sus series (estado actual)
 * - Pre-fill: último peso/reps registrados para cada ejercicio en sesiones anteriores
 */
export async function obtenerSesionActiva(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<SesionActiva>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

  try {
    // Cargar sesión con nombre del día
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, user_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diaNombre = (sesion.rutina_dias as any)?.nombre_dia || ''

    // Cargar ejercicios del día
    const { data: ejercicios, error: ejError } = await supabase
      .from('rutina_ejercicios')
      .select('id, series, orden, ejercicios:ejercicio_id(nombre)')
      .eq('dia_id', sesion.dia_id)
      .order('orden', { ascending: true })

    if (ejError || !ejercicios) {
      return { success: false, error: 'Error al cargar ejercicios' }
    }

    // Cargar series actuales de esta sesión
    const { data: seriesData, error: seriesError } = await supabase
      .from('sesion_series')
      .select('id, rutina_ejercicio_id, numero_serie, peso_kg, repeticiones, completada')
      .eq('sesion_id', sesionId)
      .order('numero_serie', { ascending: true })

    if (seriesError) {
      return { success: false, error: 'Error al cargar series de la sesión' }
    }

    const series = seriesData || []

    // Pre-fill: buscar la sesión más reciente finalizada para el mismo día
    const prefillMap: Record<string, { peso_kg: number | null; repeticiones: number | null }> = {}

    const { data: lastSession } = await supabase
      .from('sesiones')
      .select('id')
      .eq('user_id', sesion.user_id)
      .eq('dia_id', sesion.dia_id)
      .neq('id', sesionId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSession) {
      const { data: lastSeries } = await supabase
        .from('sesion_series')
        .select('rutina_ejercicio_id, peso_kg, repeticiones')
        .eq('sesion_id', lastSession.id)
        .eq('completada', true)

      if (lastSeries) {
        // Tomar el primer valor completado por ejercicio (número de serie más bajo)
        for (const s of lastSeries) {
          if (!prefillMap[s.rutina_ejercicio_id]) {
            prefillMap[s.rutina_ejercicio_id] = {
              peso_kg: s.peso_kg,
              repeticiones: s.repeticiones,
            }
          }
        }
      }
    }

    // Armar estructura EjercicioConSeries[]
    const ejerciciosConSeries: EjercicioConSeries[] = ejercicios.map(ej => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nombre = (ej.ejercicios as any)?.nombre || ''

      const ejSeries: SesionSerieEditable[] = series
        .filter(s => s.rutina_ejercicio_id === ej.id)
        .map(s => ({
          id: s.id,
          sesion_id: sesionId,
          rutina_ejercicio_id: ej.id,
          numero_serie: s.numero_serie,
          peso_kg: s.peso_kg !== null ? String(s.peso_kg) : '',
          repeticiones: s.repeticiones !== null ? String(s.repeticiones) : '',
          completada: s.completada,
        }))

      return {
        rutina_ejercicio_id: ej.id,
        nombre,
        series_rutina: ej.series,
        series: ejSeries,
        ultima_serie: prefillMap[ej.id] || null,
      }
    })

    return {
      success: true,
      data: {
        id: sesionId,
        dia_nombre: diaNombre,
        finalizada_at: sesion.finalizada_at,
        ejercicios: ejerciciosConSeries,
      },
    }
  } catch (err) {
    console.error('Error en obtenerSesionActiva:', err)
    return { success: false, error: 'Error al cargar la sesión' }
  }
}

/**
 * Auto-save de una serie (fire-and-forget desde la UI)
 */
export async function upsertSerie(
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

    if (error) {
      console.error('Error guardando serie:', error)
      return { success: false, error: 'Error al guardar serie' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en upsertSerie:', err)
    return { success: false, error: 'Error al guardar serie' }
  }
}

/**
 * Marcar una sesión como finalizada
 */
export async function finalizarSesion(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

  try {
    const { error } = await supabase
      .from('sesiones')
      .update({ finalizada_at: new Date().toISOString() })
      .eq('id', sesionId)

    if (error) {
      console.error('Error finalizando sesión:', error)
      return { success: false, error: 'Error al finalizar la sesión' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en finalizarSesion:', err)
    return { success: false, error: 'Error al finalizar la sesión' }
  }
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso sin errores TypeScript.

**Step 3: Self-review**

- ¿Todas las funciones validan UUIDs con `isValidUUID`?
- ¿`crearSesion` crea las filas de `sesion_series` y hace cleanup si falla?
- ¿`obtenerSesionActiva` carga pre-fill de la última sesión finalizada del mismo día?
- ¿`upsertSerie` actualiza `updated_at`?
- ¿Todos los errores tienen `console.error` en español?

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/services/sesion-service.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: sesion-service con crearSesion, obtenerSesionActiva, upsertSerie

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Crear componente SerieRow

**Files:**
- Create: `app/components/sesion/SerieRow.tsx`

**Context:** Componente para una fila de serie en la pantalla de sesión activa. Muestra el número de serie, inputs de peso y reps, y un botón de completada (círculo que se vuelve amarillo al marcar). Los inputs tienen placeholder con el valor de la última sesión. El componente es puramente presentacional — no hace llamadas a la DB, recibe callbacks del padre.

**Step 1: Crear el archivo**

```tsx
'use client'

interface SerieRowProps {
  numSerie: number
  serieId: string
  pesoPrevio: number | null    // para mostrar como placeholder
  repsPrevias: number | null   // para mostrar como placeholder
  pesoActual: string
  repsActual: string
  completada: boolean
  onPesoChange: (serieId: string, value: string) => void
  onRepsChange: (serieId: string, value: string) => void
  onBlur: (serieId: string) => void
  onToggleCompletada: (serieId: string) => void
}

export default function SerieRow({
  numSerie,
  serieId,
  pesoPrevio,
  repsPrevias,
  pesoActual,
  repsActual,
  completada,
  onPesoChange,
  onRepsChange,
  onBlur,
  onToggleCompletada,
}: SerieRowProps) {
  return (
    <div
      className={`flex items-center gap-2 py-2 px-3 rounded-xl transition-colors ${
        completada ? 'bg-yellow-50' : 'bg-slate-50'
      }`}
    >
      {/* Número de serie */}
      <span className="text-sm font-semibold text-slate-400 w-5 text-center flex-shrink-0">
        {numSerie}
      </span>

      {/* Input peso */}
      <input
        type="number"
        inputMode="decimal"
        value={pesoActual}
        onChange={(e) => onPesoChange(serieId, e.target.value)}
        onBlur={() => onBlur(serieId)}
        placeholder={pesoPrevio !== null ? String(pesoPrevio) : '—'}
        className="w-20 px-2 py-2 text-center text-sm font-medium border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
      />
      <span className="text-xs text-slate-400 flex-shrink-0">kg</span>

      {/* Input reps */}
      <input
        type="number"
        inputMode="numeric"
        value={repsActual}
        onChange={(e) => onRepsChange(serieId, e.target.value)}
        onBlur={() => onBlur(serieId)}
        placeholder={repsPrevias !== null ? String(repsPrevias) : '—'}
        className="w-16 px-2 py-2 text-center text-sm font-medium border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
      />
      <span className="text-xs text-slate-400 flex-shrink-0">reps</span>

      {/* Toggle completada */}
      <button
        onClick={() => onToggleCompletada(serieId)}
        className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          completada
            ? 'bg-yellow-500 text-black'
            : 'bg-white border-2 border-slate-200 text-slate-200'
        }`}
        title={completada ? 'Marcar como incompleta' : 'Marcar como completada'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso.

**Step 3: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/sesion/SerieRow.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: componente SerieRow para registro de series en sesión

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Crear página /entrenar (selección de día)

**Files:**
- Create: `app/entrenar/page.tsx`

**Context:** Pantalla de entrada al flujo de entrenamiento. Muestra los días de la rutina del usuario como botones grandes. Si hay una sesión en progreso (sin `finalizada_at`), muestra un banner para continuarla. Al seleccionar un día, crea una nueva sesión y navega a `/entrenar/[sesionId]`. Usa `useAuth` para auth guard (igual que `rutinas/page.tsx`).

**Step 1: Crear el archivo**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerRutinaEditable } from '@/lib/services/rutina-service'
import { crearSesion, obtenerSesionEnProgreso } from '@/lib/services/sesion-service'
import { DiaConEjerciciosEditables } from '@/lib/types/database'

export default function EntrenarPage() {
  const [dias, setDias] = useState<DiaConEjerciciosEditables[]>([])
  const [rutinaId, setRutinaId] = useState<string | null>(null)
  const [sesionEnProgreso, setSesionEnProgreso] = useState<{
    sesionId: string
    diaNombre: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated || !userId) {
      router.replace('/')
      return
    }

    const cargarDatos = async () => {
      const [rutinaResult, sesionResult] = await Promise.all([
        obtenerRutinaEditable(supabase, userId),
        obtenerSesionEnProgreso(supabase, userId),
      ])

      if (rutinaResult.success && rutinaResult.data) {
        setRutinaId(rutinaResult.data.rutina.id)
        setDias(rutinaResult.data.dias)
      }

      if (sesionResult.success && sesionResult.data) {
        setSesionEnProgreso(sesionResult.data)
      }

      setLoading(false)
    }

    cargarDatos()
  }, [loadingAuth, authenticated, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeleccionarDia = async (diaId: string) => {
    if (!userId || !rutinaId) return
    setCreando(diaId)

    const resultado = await crearSesion(supabase, { userId, rutinaId, diaId })
    if (resultado.success && resultado.data) {
      router.push(`/entrenar/${resultado.data.sesionId}`)
    }

    setCreando(null)
  }

  if (loadingAuth || loading) {
    return (
      <div className="min-h-screen app-page-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen app-page-bg p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
            Entrenar
          </h1>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
        </div>

        {/* Banner sesión en progreso */}
        {sesionEnProgreso && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900 text-sm">Sesión en progreso</p>
              <p className="text-slate-600 text-sm">{sesionEnProgreso.diaNombre}</p>
            </div>
            <button
              onClick={() => router.push(`/entrenar/${sesionEnProgreso.sesionId}`)}
              className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-semibold text-sm hover:bg-yellow-400 transition-all flex-shrink-0"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Selección de día */}
        {dias.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">No tenés una rutina activa.</p>
            <button
              onClick={() => router.push('/rutinas')}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Ir a Mi Rutina
            </button>
          </div>
        ) : (
          <>
            <p className="text-slate-600 font-medium mb-4">¿Qué día entrenás hoy?</p>
            <div className="space-y-3">
              {dias.map((dia) => (
                <button
                  key={dia.id}
                  onClick={() => handleSeleccionarDia(dia.id)}
                  disabled={!!creando}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-yellow-400 hover:bg-yellow-50/50 transition-all duration-200 disabled:opacity-50 shadow-sm"
                >
                  <p className="font-semibold text-slate-900">{dia.nombre_dia}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {dia.ejercicios.length} ejercicio{dia.ejercicios.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => router.push('/rutinas')}
          className="mt-8 w-full py-3 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
        >
          ← Volver a Mi Rutina
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso.

**Step 3: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/entrenar/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: página /entrenar con selección de día y detección de sesión en progreso

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Crear página /entrenar/[sesionId] (sesión activa)

**Files:**
- Create: `app/entrenar/[sesionId]/page.tsx`

**Context:** Pantalla principal de entrenamiento. Carga la sesión con todos los ejercicios y series. Muestra un `SerieRow` por cada serie de cada ejercicio. Auto-save on blur (fire-and-forget). Toggle de completada también hace auto-save. Botón "Finalizar sesión" sticky al fondo. El estado de cada serie (peso, reps, completada) vive en `sesion` state como `SesionActiva`.

**Step 1: Crear el directorio y archivo**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import {
  obtenerSesionActiva,
  upsertSerie,
  finalizarSesion,
} from '@/lib/services/sesion-service'
import { SesionActiva } from '@/lib/types/database'
import SerieRow from '@/app/components/sesion/SerieRow'

export default function SesionActivaPage() {
  const params = useParams()
  const sesionId = params.sesionId as string
  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated } = useAuth()

  const [sesion, setSesion] = useState<SesionActiva | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated) {
      router.replace('/')
      return
    }

    obtenerSesionActiva(supabase, sesionId).then(result => {
      if (result.success && result.data) {
        setSesion(result.data)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, sesionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePesoChange = (serieId: string, ejId: string, value: string) => {
    setSesion(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ejercicios: prev.ejercicios.map(ej =>
          ej.rutina_ejercicio_id !== ejId ? ej : {
            ...ej,
            series: ej.series.map(s => s.id === serieId ? { ...s, peso_kg: value } : s),
          }
        ),
      }
    })
  }

  const handleRepsChange = (serieId: string, ejId: string, value: string) => {
    setSesion(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ejercicios: prev.ejercicios.map(ej =>
          ej.rutina_ejercicio_id !== ejId ? ej : {
            ...ej,
            series: ej.series.map(s => s.id === serieId ? { ...s, repeticiones: value } : s),
          }
        ),
      }
    })
  }

  const handleBlur = useCallback((serieId: string, ejId: string) => {
    setSesion(prev => {
      if (!prev) return prev
      const ej = prev.ejercicios.find(e => e.rutina_ejercicio_id === ejId)
      const serie = ej?.series.find(s => s.id === serieId)
      if (!serie) return prev

      // Fire-and-forget auto-save
      upsertSerie(supabase, {
        id: serieId,
        peso_kg: serie.peso_kg ? parseFloat(serie.peso_kg) : null,
        repeticiones: serie.repeticiones ? parseInt(serie.repeticiones) : null,
        completada: serie.completada,
      })

      return prev
    })
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleCompletada = (serieId: string, ejId: string) => {
    let serieActualizada: { peso_kg: string; repeticiones: string; completada: boolean } | null = null

    setSesion(prev => {
      if (!prev) return prev
      const newSesion = {
        ...prev,
        ejercicios: prev.ejercicios.map(ej =>
          ej.rutina_ejercicio_id !== ejId ? ej : {
            ...ej,
            series: ej.series.map(s => {
              if (s.id !== serieId) return s
              const updated = { ...s, completada: !s.completada }
              serieActualizada = updated
              return updated
            }),
          }
        ),
      }
      return newSesion
    })

    // Auto-save del toggle (después del setState)
    setTimeout(() => {
      if (serieActualizada) {
        upsertSerie(supabase, {
          id: serieId,
          peso_kg: serieActualizada.peso_kg ? parseFloat(serieActualizada.peso_kg) : null,
          repeticiones: serieActualizada.repeticiones ? parseInt(serieActualizada.repeticiones) : null,
          completada: serieActualizada.completada,
        })
      }
    }, 0)
  }

  const handleFinalizar = async () => {
    setFinalizando(true)
    await finalizarSesion(supabase, sesionId)
    router.push('/rutinas')
  }

  if (loadingAuth || loading) {
    return (
      <div className="min-h-screen app-page-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!sesion) {
    return (
      <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Sesión no encontrada.</p>
          <button
            onClick={() => router.push('/entrenar')}
            className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
          >
            Volver a Entrenar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen app-page-bg p-4 md:p-6 pb-28">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/entrenar')}
            className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Cambiar día
          </button>
          <h1 className="text-4xl md:text-5xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
            {sesion.dia_nombre}
          </h1>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
        </div>

        {/* Ejercicios */}
        <div className="space-y-5">
          {sesion.ejercicios.map((ej) => (
            <div
              key={ej.rutina_ejercicio_id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
            >
              <h3 className="font-bold text-slate-900 mb-3">{ej.nombre}</h3>

              {/* Headers de columnas */}
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className="text-xs font-semibold text-slate-400 w-5 text-center">#</span>
                <span className="text-xs font-semibold text-slate-400 w-20 text-center">Peso</span>
                <span className="text-xs font-semibold text-slate-400 w-16 text-center">Reps</span>
              </div>

              {/* Series */}
              <div className="space-y-2">
                {ej.series.map((serie) => (
                  <SerieRow
                    key={serie.id}
                    numSerie={serie.numero_serie}
                    serieId={serie.id}
                    pesoPrevio={ej.ultima_serie?.peso_kg ?? null}
                    repsPrevias={ej.ultima_serie?.repeticiones ?? null}
                    pesoActual={serie.peso_kg}
                    repsActual={serie.repeticiones}
                    completada={serie.completada}
                    onPesoChange={(id, val) => handlePesoChange(id, ej.rutina_ejercicio_id, val)}
                    onRepsChange={(id, val) => handleRepsChange(id, ej.rutina_ejercicio_id, val)}
                    onBlur={(id) => handleBlur(id, ej.rutina_ejercicio_id)}
                    onToggleCompletada={(id) => handleToggleCompletada(id, ej.rutina_ejercicio_id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botón finalizar sticky */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleFinalizar}
            disabled={finalizando}
            className="w-full h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10 flex items-center justify-center"
          >
            {finalizando ? 'Finalizando...' : 'Finalizar sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso.

**Step 3: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/entrenar/
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: página de sesión activa con auto-save y botón finalizar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Agregar botón "Entrenar" en /rutinas

**Files:**
- Modify: `app/rutinas/page.tsx`

**Context:** Agregar un botón "Entrenar" en el header de la página de rutinas, antes de "Nueva Rutina". El botón navega a `/entrenar`. Es el punto de entrada al flujo. Usar `useRouter` que ya está importado en el archivo.

**Step 1: Leer el header actual**

Leer `app/rutinas/page.tsx` alrededor de la línea 399-412 para confirmar la estructura actual del header.

**Step 2: Agregar el botón Entrenar**

Buscar el bloque:

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <button
    onClick={handleGenerateNew}
    className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
  >
    Nueva Rutina
  </button>
  <button
    onClick={logout}
    className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
  >
    Cerrar Sesión
  </button>
</div>
```

Reemplazar con (agrega el botón Entrenar antes de Nueva Rutina):

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <button
    onClick={() => router.push('/entrenar')}
    className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all duration-200 shadow-lg shadow-neutral-900/10"
  >
    Entrenar
  </button>
  <button
    onClick={handleGenerateNew}
    className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
  >
    Nueva Rutina
  </button>
  <button
    onClick={logout}
    className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
  >
    Cerrar Sesión
  </button>
</div>
```

Nota sobre el color: "Entrenar" usa `bg-neutral-900` (negro) para distinguirse de "Nueva Rutina" (amarillo). En el design system, `bg-neutral-900` es el color del chat FAB y acciones secundarias importantes.

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso.

**Step 4: Self-review**

- ¿El botón "Entrenar" navega a `/entrenar`?
- ¿El orden es: Entrenar → Nueva Rutina → Cerrar Sesión?
- ¿Los tres botones son distintos visualmente (negro / amarillo / blanco)?
- ¿Build pasa?

**Step 5: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: agregar botón Entrenar en header de rutinas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist final

- [ ] Task 1 ✅ Tablas `sesiones` y `sesion_series` creadas en Supabase con RLS
- [ ] Task 1 ✅ Tipos TypeScript agregados a `database.ts`
- [ ] Task 2 ✅ `sesion-service.ts` con 5 funciones: crearSesion, obtenerSesionEnProgreso, obtenerSesionActiva, upsertSerie, finalizarSesion
- [ ] Task 3 ✅ `SerieRow.tsx` con inputs de peso/reps, placeholder pre-fill, toggle completada
- [ ] Task 4 ✅ `/entrenar` con selección de día y banner de sesión en progreso
- [ ] Task 5 ✅ `/entrenar/[sesionId]` con auto-save on blur, toggle completada, botón finalizar sticky
- [ ] Task 6 ✅ Botón "Entrenar" en header de `/rutinas`
- [ ] Build pasa sin errores TypeScript
- [ ] Auto-save funciona (datos persisten si se cierra la app)
- [ ] Pre-fill muestra peso/reps de última sesión como placeholder
