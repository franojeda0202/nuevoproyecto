# Métricas — Sub-proyecto 1: Estadísticas de Sesión — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección "Métricas" dentro de `/entrenamiento` que muestre estadísticas de sesión (frecuencia mensual, racha, duración, completitud), calendario mensual y récords personales por ejercicio.

**Architecture:** Tab "Métricas" agregado a `/entrenamiento/page.tsx` junto al tab "Historial" existente. Nuevo servicio `metricas-service.ts` con queries routine-agnostic a Supabase. Componentes en `app/components/metricas/` orquestados desde `MetricasTab.tsx`. PRs personalizados persisten en `localStorage`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS v2, Tailwind CSS v4, `'use client'`

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/types/database.ts` | Modificar (al final) | Agregar 4 tipos nuevos para métricas |
| `lib/services/metricas-service.ts` | Crear | 3 funciones de servicio: métricas resumen, PRs, ejercicios de rutina activa |
| `app/components/metricas/HeroStat.tsx` | Crear | Bloque oscuro con número grande de entrenamientos del mes |
| `app/components/metricas/MiniStats.tsx` | Crear | Grid 3 tarjetas: racha, duración promedio, % series completadas |
| `app/components/metricas/CalendarioMes.tsx` | Crear | Calendario del mes actual con días entrenados en amarillo |
| `app/components/metricas/PRsPanel.tsx` | Crear | Lista de PRs + selector inline para agregar ejercicios pinned |
| `app/components/metricas/MetricasTab.tsx` | Crear | Orquestador: carga datos, maneja estado, renderiza sub-tabs y componentes |
| `app/entrenamiento/page.tsx` | Modificar | Agregar tabs Historial / Métricas encima del contenido |

---

## Chunk 1: Tipos y Capa de Servicio

### Task 1: Tipos nuevos en `lib/types/database.ts`

**Files:**
- Modify: `lib/types/database.ts` (al final del archivo)

- [ ] **Step 1: Agregar los 4 tipos al final de `lib/types/database.ts`**

```ts
// ============================================
// Tipos para Métricas
// ============================================

export interface MetricasResumen {
  entrenamientosEsteMes: number
  entrenamientosMesPasado: number
  rachaActual: number           // semanas consecutivas con ≥1 sesión
  duracionPromedioMinutos: number | null
  porcentajeSeriesCompletadas: number | null  // 0-100
  diasEntrenadosEsteMes: string[]  // ISO date strings "YYYY-MM-DD"
}

// Retorno del servicio (sin nombre — el caller lo combina con EjercicioRutinaActiva)
export interface PRejercicio {
  ejercicioId: string
  pesoKg: number | null
  repeticiones: number | null
}

// Tipo combinado para la UI (merge de PRejercicio + EjercicioRutinaActiva)
export interface PRejercicioDisplay {
  ejercicioId: string
  nombre: string
  pesoKg: number | null
  repeticiones: number | null
  esPinned: boolean  // true si viene de localStorage (no del default por frecuencia)
}

export interface EjercicioRutinaActiva {
  ejercicioId: string
  nombre: string
  esCompuesto: boolean
  frecuencia: number  // cuántos días de la rutina incluyen este ejercicio
}
```

- [ ] **Step 2: Verificar que el build compila sin errores**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (o similar, sin errores de tipos)

- [ ] **Step 3: Commit**

```bash
git add lib/types/database.ts
git commit -m "feat: agregar tipos para métricas (MetricasResumen, PRejercicio, EjercicioRutinaActiva)"
```

---

### Task 2: `lib/services/metricas-service.ts`

**Files:**
- Create: `lib/services/metricas-service.ts`

Referencia: ver `lib/services/sesion-service.ts` para el patrón de importaciones, manejo de errores, e `isValidUUID`.

- [ ] **Step 1: Crear `lib/services/metricas-service.ts`**

```ts
import { SupabaseClient } from '@supabase/supabase-js'
import {
  ResultadoOperacion,
  MetricasResumen,
  PRejercicio,
  EjercicioRutinaActiva,
} from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Calcular el inicio de semana (lunes) para una fecha dada.
 * JS: getDay() retorna 0=domingo, 1=lunes, ..., 6=sábado
 */
function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day  // ajuste para que lunes=inicio
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Calcular racha de semanas consecutivas con ≥1 sesión.
 * La semana en curso (que incluye "hoy") siempre cuenta —
 * si el usuario no entrenó esta semana pero entrenó las anteriores,
 * la racha incluye esas semanas previas (la semana actual no está rota aún).
 */
function calcularRacha(fechasFinalizadas: string[]): number {
  if (fechasFinalizadas.length === 0) return 0

  // Convertir a timestamps de inicio de semana (lunes)
  const semanasEntrenadas = new Set(
    fechasFinalizadas.map(f => inicioSemana(new Date(f)).getTime())
  )

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let semanaActual = inicioSemana(hoy)
  let racha = 0

  // Empezamos desde la semana actual hacia atrás.
  // Si la semana actual no tiene sesión, la saltamos (no rompe la racha).
  // Si una semana anterior no tiene sesión, la racha se corta.
  let primeraIteracion = true

  while (true) {
    const tieneEntrenamiento = semanasEntrenadas.has(semanaActual.getTime())

    if (!tieneEntrenamiento) {
      // La semana actual sin entrenamiento no rompe la racha (es la primera iteración)
      if (primeraIteracion) {
        // Avanzar a la semana anterior sin sumar racha
        semanaActual = new Date(semanaActual.getTime() - 7 * 24 * 60 * 60 * 1000)
        primeraIteracion = false
        // Verificar si la semana anterior tampoco tiene datos → racha = 0
        if (!semanasEntrenadas.has(semanaActual.getTime())) return 0
        continue
      }
      // Una semana anterior sin entrenamiento → racha terminada
      break
    }

    racha++
    primeraIteracion = false
    semanaActual = new Date(semanaActual.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  return racha
}

/**
 * Obtener todas las métricas de resumen para la pantalla de Métricas.
 * Todas las queries son routine-agnostic (sin filtro por rutina_id).
 */
export async function obtenerMetricasResumen(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<MetricasResumen>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const ahora = new Date()
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const inicioMesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString()
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).toISOString()

    // Queries en paralelo (solo las que no dependen de resultados intermedios)
    const [sesionesActualResult, sesionesAnteriorResult, todasSesionesResult] =
      await Promise.all([
        // Sesiones mes actual
        supabase
          .from('sesiones')
          .select('id, iniciada_at, finalizada_at')
          .eq('user_id', userId)
          .gte('finalizada_at', inicioMesActual)
          .lt('finalizada_at', inicioMesSiguiente)
          .not('finalizada_at', 'is', null),

        // Sesiones mes anterior (solo count)
        supabase
          .from('sesiones')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('finalizada_at', inicioMesAnterior)
          .lt('finalizada_at', inicioMesActual)
          .not('finalizada_at', 'is', null),

        // Todas las sesiones finalizadas (para racha)
        supabase
          .from('sesiones')
          .select('finalizada_at')
          .eq('user_id', userId)
          .not('finalizada_at', 'is', null)
          .order('finalizada_at', { ascending: false }),
      ])

    if (sesionesActualResult.error) throw sesionesActualResult.error
    if (sesionesAnteriorResult.error) throw sesionesAnteriorResult.error
    if (todasSesionesResult.error) throw todasSesionesResult.error

    const sesionesActual = sesionesActualResult.data ?? []
    const sesionIds = sesionesActual.map(s => s.id)

    // Fetch series del mes actual (requiere sesionIds del paso anterior)
    let totalSeries = 0
    let completadas = 0
    if (sesionIds.length > 0) {
      const { data: series, error: seriesError } = await supabase
        .from('sesion_series')
        .select('completada')
        .in('sesion_id', sesionIds)

      if (seriesError) throw seriesError
      totalSeries = series?.length ?? 0
      completadas = series?.filter(s => s.completada).length ?? 0
    }

    // Duración promedio (en minutos)
    const sesionesConDuracion = sesionesActual.filter(
      s => s.iniciada_at && s.finalizada_at
    )
    let duracionPromedioMinutos: number | null = null
    if (sesionesConDuracion.length > 0) {
      const totalMs = sesionesConDuracion.reduce((acc, s) => {
        return acc + (new Date(s.finalizada_at!).getTime() - new Date(s.iniciada_at!).getTime())
      }, 0)
      duracionPromedioMinutos = Math.round(totalMs / sesionesConDuracion.length / 60000)
    }

    // Racha
    const todasFechas = (todasSesionesResult.data ?? []).map(s => s.finalizada_at as string)
    const rachaActual = calcularRacha(todasFechas)

    // Días entrenados este mes (ISO "YYYY-MM-DD" en hora LOCAL del usuario).
    // No usar toISOString() — retorna UTC y en timezones negativas (ej: Argentina UTC-3)
    // un entreno a las 23:30 locales aparecería en el día siguiente en UTC.
    const diasEntrenadosEsteMes = sesionesActual
      .filter(s => s.finalizada_at)
      .map(s => {
        const d = new Date(s.finalizada_at!)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })

    return {
      success: true,
      data: {
        entrenamientosEsteMes: sesionesActual.length,
        entrenamientosMesPasado: sesionesAnteriorResult.count ?? 0,
        rachaActual,
        duracionPromedioMinutos,
        porcentajeSeriesCompletadas: totalSeries > 0
          ? Math.round((completadas / totalSeries) * 100)
          : null,
        diasEntrenadosEsteMes,
      },
    }
  } catch (err) {
    console.error('Error en obtenerMetricasResumen:', err)
    return { success: false, error: 'Error al cargar métricas' }
  }
}

/**
 * Obtener el PR (mejor peso × reps) histórico para un array de ejercicio_ids.
 * No resuelve nombres — el caller ya los tiene desde obtenerEjerciciosRutinaActiva.
 * Usa LEFT JOIN en rutina_ejercicios para sobrevivir al orphan cleanup de rutinas.
 */
export async function obtenerPRsEjercicios(
  supabase: SupabaseClient,
  userId: string,
  ejercicioIds: string[]
): Promise<ResultadoOperacion<PRejercicio[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }
  if (ejercicioIds.length === 0) return { success: true, data: [] }

  try {
    // Supabase JS no soporta LEFT JOIN nativo en .from().select()
    // Usamos rpc o query directa con .rpc(), pero la forma más simple es
    // hacer el query en dos partes: primero obtener sesion_series del usuario,
    // luego cruzar con rutina_ejercicios para obtener el ejercicio_id.
    //
    // Alternativa: usar .from('sesion_series') con join embebido que Supabase sí permite
    // cuando hay FK en ambos lados. La tabla sesion_series tiene FK a rutina_ejercicios.
    // Supabase auto-resuelve el join con !inner por defecto, usamos el nombre de la FK.

    const { data, error } = await supabase
      .from('sesion_series')
      .select(`
        completada,
        peso_kg,
        repeticiones,
        rutina_ejercicios!left (
          ejercicio_id
        ),
        sesiones!inner (
          user_id
        )
      `)
      .eq('sesiones.user_id', userId)
      .eq('completada', true)
      .not('peso_kg', 'is', null)
      .not('repeticiones', 'is', null)
      .in('rutina_ejercicios.ejercicio_id', ejercicioIds)
      .order('peso_kg', { ascending: false })
      .order('repeticiones', { ascending: false })

    if (error) throw error

    // Agrupar: un PR por ejercicio_id (la primera fila ya es la mejor por el ORDER BY)
    const prMap = new Map<string, PRejercicio>()
    for (const row of data ?? []) {
      const ejId = (row.rutina_ejercicios as unknown as { ejercicio_id: string } | null)?.ejercicio_id
      if (!ejId || !ejercicioIds.includes(ejId)) continue
      if (prMap.has(ejId)) continue  // ya tenemos el PR para este ejercicio
      prMap.set(ejId, {
        ejercicioId: ejId,
        pesoKg: row.peso_kg as number,
        repeticiones: row.repeticiones as number,
      })
    }

    return { success: true, data: Array.from(prMap.values()) }
  } catch (err) {
    console.error('Error en obtenerPRsEjercicios:', err)
    return { success: false, error: 'Error al cargar PRs' }
  }
}

/**
 * Obtener ejercicios únicos de la rutina más reciente del usuario.
 * Retorna lista vacía (sin error) si el usuario no tiene rutinas.
 */
export async function obtenerEjerciciosRutinaActiva(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<EjercicioRutinaActiva[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    // Rutina más reciente
    const { data: rutina, error: rutinaError } = await supabase
      .from('rutinas')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rutinaError) throw rutinaError
    if (!rutina) return { success: true, data: [] }

    // Ejercicios de todos los días de la rutina
    const { data: rows, error: rowsError } = await supabase
      .from('rutina_ejercicios')
      .select(`
        ejercicio_id,
        rutina_dias!inner (
          rutina_id
        ),
        ejercicios:ejercicio_id (
          nombre,
          patron_movimiento
        )
      `)
      .eq('rutina_dias.rutina_id', rutina.id)

    if (rowsError) throw rowsError

    // Deduplicar por ejercicio_id, contar frecuencia (días distintos que lo incluyen)
    const frecMap = new Map<string, { nombre: string; esCompuesto: boolean; count: number }>()
    for (const row of rows ?? []) {
      const ejId = row.ejercicio_id as string
      const ej = row.ejercicios as unknown as { nombre: string; patron_movimiento: string } | null
      if (!ej || !ejId) continue
      const esCompuesto = ['push', 'pull', 'rodilla', 'cadera'].includes(ej.patron_movimiento)
      const existing = frecMap.get(ejId)
      if (existing) {
        existing.count++
      } else {
        frecMap.set(ejId, { nombre: ej.nombre, esCompuesto, count: 1 })
      }
    }

    const resultado: EjercicioRutinaActiva[] = Array.from(frecMap.entries()).map(([id, val]) => ({
      ejercicioId: id,
      nombre: val.nombre,
      esCompuesto: val.esCompuesto,
      frecuencia: val.count,
    }))

    return { success: true, data: resultado }
  } catch (err) {
    console.error('Error en obtenerEjerciciosRutinaActiva:', err)
    return { success: false, error: 'Error al cargar ejercicios de rutina' }
  }
}
```

- [ ] **Step 2: Verificar que el build compila sin errores**

```bash
npm run build 2>&1 | tail -20
```

Expected: sin errores de TypeScript

- [ ] **Step 3: Commit**

```bash
git add lib/services/metricas-service.ts
git commit -m "feat: agregar metricas-service con obtenerMetricasResumen, PRs y ejercicios rutina activa"
```

---

## Chunk 2: Componentes de UI

### Task 3: `HeroStat.tsx`

**Files:**
- Create: `app/components/metricas/HeroStat.tsx`

- [ ] **Step 1: Crear `app/components/metricas/HeroStat.tsx`**

```tsx
interface HeroStatProps {
  count: number
  comparacion: number  // delta vs mes anterior (puede ser negativo)
}

export default function HeroStat({ count, comparacion }: HeroStatProps) {
  let comparacionLabel: string
  if (comparacion > 0) {
    comparacionLabel = `↑ ${comparacion} más que el mes pasado`
  } else if (comparacion < 0) {
    comparacionLabel = `↓ ${Math.abs(comparacion)} menos que el mes pasado`
  } else {
    comparacionLabel = 'Igual que el mes pasado'
  }

  return (
    <div className="bg-neutral-900 rounded-2xl p-5 text-center">
      <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">
        Entrenamientos este mes
      </p>
      <p className="text-5xl font-display text-yellow-500 leading-none mb-2">{count}</p>
      <p className="text-xs text-neutral-500">{comparacionLabel}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/metricas/HeroStat.tsx
git commit -m "feat: agregar componente HeroStat para métricas"
```

---

### Task 4: `MiniStats.tsx`

**Files:**
- Create: `app/components/metricas/MiniStats.tsx`

- [ ] **Step 1: Crear `app/components/metricas/MiniStats.tsx`**

```tsx
interface MiniStatsProps {
  racha: number
  duracionPromedio: number | null
  porcentajeCompletadas: number | null
}

export default function MiniStats({ racha, duracionPromedio, porcentajeCompletadas }: MiniStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{racha}</p>
        <p className="text-xs text-slate-400">sem. racha</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">
          {duracionPromedio !== null ? `${duracionPromedio}'` : '-'}
        </p>
        <p className="text-xs text-slate-400">duración prom.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">
          {porcentajeCompletadas !== null ? `${porcentajeCompletadas}%` : '-'}
        </p>
        <p className="text-xs text-slate-400">series complet.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/metricas/MiniStats.tsx
git commit -m "feat: agregar componente MiniStats para métricas"
```

---

### Task 5: `CalendarioMes.tsx`

**Files:**
- Create: `app/components/metricas/CalendarioMes.tsx`

- [ ] **Step 1: Crear `app/components/metricas/CalendarioMes.tsx`**

```tsx
interface CalendarioMesProps {
  diasEntrenados: string[]  // ISO "YYYY-MM-DD"
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function CalendarioMes({ diasEntrenados }: CalendarioMesProps) {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = hoy.getMonth()

  const diasEnSet = new Set(diasEntrenados)
  // Usar fecha local (no UTC) para que coincida con los strings generados en metricas-service.ts
  const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  // Primer día del mes: getDay() retorna 0=dom, 1=lun, ..., 6=sab
  // Queremos que el calendario empiece en lunes (índice 0)
  const primerDia = new Date(year, month, 1)
  const offsetDomingo = primerDia.getDay()  // 0=dom, 1=lun, ..., 6=sab
  const offsetLunes = offsetDomingo === 0 ? 6 : offsetDomingo - 1

  const diasEnMes = new Date(year, month + 1, 0).getDate()

  const nombreMes = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 capitalize">
        {nombreMes}
      </p>

      {/* Headers días */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-xs text-slate-400">{d}</div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-1">
        {/* Celdas vacías para el offset */}
        {Array.from({ length: offsetLunes }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}

        {/* Días del mes */}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
          const diaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const entrenado = diasEnSet.has(diaStr)
          const esHoy = diaStr === todayStr

          let bgClass = 'bg-slate-100 text-slate-400'
          if (entrenado) {
            bgClass = 'bg-yellow-500 text-black font-bold'
          } else if (esHoy) {
            bgClass = 'bg-slate-200 text-slate-900 font-bold'
          }

          return (
            <div
              key={dia}
              className={`h-8 rounded-md flex items-center justify-center text-xs ${bgClass}`}
            >
              {dia}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/metricas/CalendarioMes.tsx
git commit -m "feat: agregar componente CalendarioMes para métricas"
```

---

### Task 6: `PRsPanel.tsx`

**Files:**
- Create: `app/components/metricas/PRsPanel.tsx`

- [ ] **Step 1: Crear `app/components/metricas/PRsPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PRejercicioDisplay, EjercicioRutinaActiva } from '@/lib/types/database'

interface PRsPanelProps {
  prs: PRejercicioDisplay[]
  ejerciciosDisponibles: EjercicioRutinaActiva[]  // para el selector "+"
  pinnedIds: string[]
  sinRutina: boolean
  onPinChange: (ids: string[]) => void
}

function formatearPR(pesoKg: number | null, repeticiones: number | null): string {
  if (pesoKg === null || repeticiones === null) return '-'
  return `${pesoKg} kg × ${repeticiones}`
}

export default function PRsPanel({
  prs,
  ejerciciosDisponibles,
  pinnedIds,
  sinRutina,
  onPinChange,
}: PRsPanelProps) {
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const router = useRouter()

  // Ejercicios disponibles para agregar (los que ya están en la lista no aparecen)
  const idsYaMostrados = new Set(prs.map(p => p.ejercicioId))
  const disponiblesParaAgregar = ejerciciosDisponibles.filter(
    e => !idsYaMostrados.has(e.ejercicioId)
  )

  const mostrarBotonMas = !sinRutina && pinnedIds.length < 4 && disponiblesParaAgregar.length > 0

  const handleAgregar = (ejercicioId: string) => {
    onPinChange([...pinnedIds, ejercicioId])
    setSelectorAbierto(false)
  }

  const handleQuitar = (ejercicioId: string) => {
    onPinChange(pinnedIds.filter(id => id !== ejercicioId))
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
          🏆 Récords personales
        </h3>
        {mostrarBotonMas && (
          <button
            type="button"
            onClick={() => setSelectorAbierto(prev => !prev)}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-lg font-bold leading-none"
            aria-label="Agregar ejercicio"
          >
            +
          </button>
        )}
      </div>

      {sinRutina ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-3">
            Generá tu primera rutina para ver tus récords personales
          </p>
          <button
            type="button"
            onClick={() => router.push('/rutinas')}
            className="px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
          >
            Ir a rutinas
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {prs.map((pr, idx) => (
              <div
                key={pr.ejercicioId}
                className={`flex items-center justify-between py-2 ${
                  idx < prs.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-700 truncate">{pr.nombre}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-yellow-600">
                    {formatearPR(pr.pesoKg, pr.repeticiones)}
                  </span>
                  {pr.esPinned && (
                    <button
                      type="button"
                      onClick={() => handleQuitar(pr.ejercicioId)}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors text-xs"
                      aria-label={`Quitar ${pr.nombre}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Selector inline */}
          {selectorAbierto && disponiblesParaAgregar.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2">Agregar ejercicio</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {disponiblesParaAgregar.map(ej => (
                  <button
                    key={ej.ejercicioId}
                    type="button"
                    onClick={() => handleAgregar(ej.ejercicioId)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-yellow-50 hover:text-slate-900 rounded-lg transition-colors"
                  >
                    {ej.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/metricas/PRsPanel.tsx
git commit -m "feat: agregar componente PRsPanel con selector inline"
```

---

### Task 7: `MetricasTab.tsx`

**Files:**
- Create: `app/components/metricas/MetricasTab.tsx`

Este es el componente orquestador. Carga todos los datos, maneja localStorage para PRs pinned, combina tipos, y renderiza los sub-tabs.

- [ ] **Step 1: Crear `app/components/metricas/MetricasTab.tsx`**

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  MetricasResumen,
  PRejercicio,
  PRejercicioDisplay,
  EjercicioRutinaActiva,
} from '@/lib/types/database'
import {
  obtenerMetricasResumen,
  obtenerPRsEjercicios,
  obtenerEjerciciosRutinaActiva,
} from '@/lib/services/metricas-service'
import HeroStat from './HeroStat'
import MiniStats from './MiniStats'
import CalendarioMes from './CalendarioMes'
import PRsPanel from './PRsPanel'

const LS_KEY = 'gymlogic_pr_pins'
const MAX_PINNED = 4
const TOP_DEFAULTS = 4

interface MetricasTabProps {
  userId: string
  supabase: SupabaseClient
}

export default function MetricasTab({ userId, supabase }: MetricasTabProps) {
  const [subTab, setSubTab] = useState<'resumen' | 'progreso'>('resumen')
  const [metricas, setMetricas] = useState<MetricasResumen | null>(null)
  const [prsData, setPrsData] = useState<PRejercicio[]>([])
  const [ejerciciosDisponibles, setEjerciciosDisponibles] = useState<EjercicioRutinaActiva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [prsPinned, setPrsPinned] = useState<string[]>([])

  // Cargar pinned desde localStorage al montar (solo client-side)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        // Limitar al máximo por si acaso
        setPrsPinned(parsed.slice(0, MAX_PINNED))
      }
    } catch {
      // localStorage no disponible o JSON inválido — ignorar
    }
  }, [])

  // Cargar datos
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    Promise.all([
      obtenerMetricasResumen(supabase, userId),
      obtenerEjerciciosRutinaActiva(supabase, userId),
    ]).then(async ([metricasResult, ejerciciosResult]) => {
      if (cancelled) return

      if (!metricasResult.success || !ejerciciosResult.success) {
        setError(true)
        setLoading(false)
        return
      }

      setMetricas(metricasResult.data!)
      setEjerciciosDisponibles(ejerciciosResult.data!)

      // Calcular ejercicios a mostrar en PRs
      const ejercicios = ejerciciosResult.data!
      const compuestosPorFrecuencia = ejercicios
        .filter(e => e.esCompuesto)
        .sort((a, b) => b.frecuencia - a.frecuencia)
        .slice(0, TOP_DEFAULTS)
        .map(e => e.ejercicioId)

      // Leer pinned actuales (podría haber cambiado, usar state actualizado)
      let pinnedActuales: string[] = []
      try {
        const stored = localStorage.getItem(LS_KEY)
        pinnedActuales = stored ? (JSON.parse(stored) as string[]).slice(0, MAX_PINNED) : []
      } catch { /* ignore */ }

      // Filtrar pinned que ya no existen en la rutina activa
      const ejercicioIdsValidos = new Set(ejercicios.map(e => e.ejercicioId))
      const pinnedValidos = pinnedActuales.filter(id => ejercicioIdsValidos.has(id))

      // IDs a consultar para PRs (defaults + pinned, sin duplicados)
      const idsParaPRs = Array.from(new Set([...compuestosPorFrecuencia, ...pinnedValidos]))

      if (idsParaPRs.length > 0) {
        const prsResult = await obtenerPRsEjercicios(supabase, userId, idsParaPRs)
        if (!cancelled) {
          if (!prsResult.success) {
            setError(true)
            setLoading(false)
            return
          }
          setPrsData(prsResult.data!)
        }
      }

      if (!cancelled) {
        setPrsPinned(pinnedValidos)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [userId, supabase, retryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinChange = (nuevosIds: string[]) => {
    const limitados = nuevosIds.slice(0, MAX_PINNED)
    setPrsPinned(limitados)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(limitados))
    } catch { /* ignore */ }

    // Re-fetch PRs con los nuevos IDs
    const ejerciciosCompuestos = ejerciciosDisponibles
      .filter(e => e.esCompuesto)
      .sort((a, b) => b.frecuencia - a.frecuencia)
      .slice(0, TOP_DEFAULTS)
      .map(e => e.ejercicioId)
    const idsParaPRs = Array.from(new Set([...ejerciciosCompuestos, ...limitados]))

    if (idsParaPRs.length > 0) {
      obtenerPRsEjercicios(supabase, userId, idsParaPRs).then(result => {
        if (result.success) setPrsData(result.data!)
      })
    }
  }

  // Construir lista de PRs para mostrar (defaults + pinned, con nombres)
  const prsDisplay = useMemo((): PRejercicioDisplay[] => {
    const defaultIds = ejerciciosDisponibles
      .filter(e => e.esCompuesto)
      .sort((a, b) => b.frecuencia - a.frecuencia)
      .slice(0, TOP_DEFAULTS)
      .map(e => e.ejercicioId)

    const idsAMostrar = Array.from(new Set([...defaultIds, ...prsPinned]))

    return idsAMostrar.map(ejId => {
      const ejercicio = ejerciciosDisponibles.find(e => e.ejercicioId === ejId)
      const pr = prsData.find(p => p.ejercicioId === ejId)
      return {
        ejercicioId: ejId,
        nombre: ejercicio?.nombre ?? ejId,
        pesoKg: pr?.pesoKg ?? null,
        repeticiones: pr?.repeticiones ?? null,
        esPinned: prsPinned.includes(ejId),
      }
    })
  }, [ejerciciosDisponibles, prsPinned, prsData])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-slate-500 mb-4">No se pudieron cargar las métricas. Intentá de nuevo.</p>
        <button
          type="button"
          onClick={() => { setError(false); setLoading(true); setRetryKey(k => k + 1) }}
          className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Sub-tabs: Resumen / Progreso */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSubTab('resumen')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            subTab === 'resumen'
              ? 'bg-yellow-500 text-black'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Resumen
        </button>
        <button
          type="button"
          onClick={() => setSubTab('progreso')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            subTab === 'progreso'
              ? 'bg-yellow-500 text-black'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Progreso
        </button>
      </div>

      {subTab === 'progreso' ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">Próximamente</p>
          <p className="text-slate-400 text-xs mt-1">Gráficos de progresión por ejercicio</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metricas && (
            <>
              <HeroStat
                count={metricas.entrenamientosEsteMes}
                comparacion={metricas.entrenamientosEsteMes - metricas.entrenamientosMesPasado}
              />
              <MiniStats
                racha={metricas.rachaActual}
                duracionPromedio={metricas.duracionPromedioMinutos}
                porcentajeCompletadas={metricas.porcentajeSeriesCompletadas}
              />
              <CalendarioMes diasEntrenados={metricas.diasEntrenadosEsteMes} />
            </>
          )}
          <PRsPanel
            prs={prsDisplay}
            ejerciciosDisponibles={ejerciciosDisponibles}
            pinnedIds={prsPinned}
            sinRutina={ejerciciosDisponibles.length === 0}
            onPinChange={handlePinChange}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: sin errores de TypeScript

- [ ] **Step 3: Commit**

```bash
git add app/components/metricas/MetricasTab.tsx
git commit -m "feat: agregar MetricasTab — orquestador con sub-tabs Resumen / Progreso"
```

---

### Task 8: Modificar `app/entrenamiento/page.tsx`

**Files:**
- Modify: `app/entrenamiento/page.tsx`

Agregar tab Historial / Métricas. El historial existente no cambia nada internamente. Solo se agrega el switcher de tabs y se renderiza `MetricasTab` condicionalmente.

- [ ] **Step 1: Agregar el import de MetricasTab y el estado del tab**

En `app/entrenamiento/page.tsx`, agregar al bloque de imports:

```tsx
import MetricasTab from '@/app/components/metricas/MetricasTab'
```

Dentro de `EntrenamientoPage`, agregar el estado del tab (justo después de las declaraciones de estado existentes):

```tsx
const [tabActivo, setTabActivo] = useState<'historial' | 'metricas'>('historial')
```

- [ ] **Step 2: Agregar el tab switcher en el JSX**

En el bloque `return (...)`, el header actual es:

```tsx
<div className="mb-8 flex items-end justify-between">
  <div>
    <h1 className="text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
      Entrenamientos
    </h1>
    <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
  </div>
  {sesiones.length > 0 && (
    <button ...>
      + Entrenar
    </button>
  )}
</div>
```

Reemplazar ese bloque por:

```tsx
<div className="mb-6">
  <div className="flex items-end justify-between mb-4">
    <div>
      <h1 className="text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
        Entrenamientos
      </h1>
      <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
    </div>
    {tabActivo === 'historial' && sesiones.length > 0 && (
      <button
        type="button"
        onClick={() => router.push('/entrenar')}
        className="flex-shrink-0 px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold text-base hover:bg-yellow-400 transition-all"
      >
        + Entrenar
      </button>
    )}
  </div>

  {/* Tabs */}
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => setTabActivo('historial')}
      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        tabActivo === 'historial'
          ? 'bg-yellow-500 text-black'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      Historial
    </button>
    <button
      type="button"
      onClick={() => setTabActivo('metricas')}
      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        tabActivo === 'metricas'
          ? 'bg-yellow-500 text-black'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      Métricas
    </button>
  </div>
</div>
```

- [ ] **Step 3: Renderizar MetricasTab condicionalmente**

Reemplazar el bloque de lista de sesiones (que comienza con `{sesiones.length === 0 ? ...}`) por un condicional de tab:

```tsx
{tabActivo === 'metricas' ? (
  <MetricasTab userId={userId!} supabase={supabase} />
) : (
  /* Lista de sesiones — sin cambios */
  sesiones.length === 0 ? (
    <div className="text-center py-16">
      {/* ... el contenido vacío existente sin cambios ... */}
    </div>
  ) : (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ... las cards de sesiones existentes sin cambios ... */}
    </div>
  )
)}
```

**Nota:** No mover ni tocar el contenido del historial. Solo envolver el bloque existente dentro del branch `tabActivo === 'historial'`.

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` sin errores

- [ ] **Step 5: Verificar lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: sin errores (warnings de `no-unused-vars` sobre imports OK si no hay errores)

- [ ] **Step 6: Commit**

```bash
git add app/entrenamiento/page.tsx
git commit -m "feat: agregar tabs Historial / Métricas en página de entrenamientos"
```

---

## Verificación manual final

Antes de considerar la feature completa:

- [ ] Correr `npm run dev` y navegar a `/entrenamiento`
- [ ] Verificar que el tab "Historial" muestra el comportamiento exactamente igual al anterior
- [ ] Verificar que el tab "Métricas" carga sin error
- [ ] Verificar que el hero stat muestra el número de entrenamientos del mes
- [ ] Verificar que el calendario resalta en amarillo los días con sesión
- [ ] Verificar que los PRs muestran los ejercicios compuestos de la rutina activa
- [ ] Verificar que el "+" abre el selector inline y que al seleccionar un ejercicio se agrega a la lista
- [ ] Verificar que al recargar la página, los PRs pinned se mantienen (localStorage)
- [ ] Verificar que el sub-tab "Progreso" muestra el placeholder "Próximamente"
