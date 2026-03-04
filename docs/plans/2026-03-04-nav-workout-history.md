# Nav Global + Historial de Entrenamientos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar un drawer de navegación lateral (☰) y una sección de historial de entrenamientos con vista de detalle por sesión.

**Architecture:** `AppLayout` envuelve las páginas autenticadas e incluye el hamburger + drawer. Dos nuevas rutas: `/entrenamiento` (lista) y `/entrenamiento/[sesionId]` (detalle read-only). Dos nuevas funciones en `sesion-service.ts`. Los headers de las páginas existentes se simplifican (se quita "Cerrar Sesión" y botones de navegación redundantes).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase

---

### Task 1: Tipos TypeScript + funciones de servicio

**Files:**
- Modify: `lib/types/database.ts`
- Modify: `lib/services/sesion-service.ts`

**Step 1: Agregar tipos al final de `lib/types/database.ts`**

```ts
// ============================================
// Tipos para Historial de Entrenamientos
// ============================================

export interface SesionResumen {
  id: string
  dia_nombre: string
  finalizada_at: string    // ISO string
  series_completadas: number
}

export interface SerieDetalle {
  numero_serie: number
  peso_kg: number | null
  repeticiones: number | null
  completada: boolean
}

export interface EjercicioDetalle {
  nombre: string
  series: SerieDetalle[]
}

export interface SesionDetalle {
  id: string
  dia_nombre: string
  finalizada_at: string
  ejercicios: EjercicioDetalle[]
}
```

**Step 2: Agregar las dos funciones al final de `lib/services/sesion-service.ts`**

Primero agregar los nuevos tipos al import del archivo:
```ts
import {
  ResultadoOperacion,
  SesionActiva,
  SesionSerieEditable,
  EjercicioConSeries,
  SesionResumen,
  SesionDetalle,
  EjercicioDetalle,
  SerieDetalle,
} from '@/lib/types/database'
```

Luego agregar al final del archivo:

```ts
/**
 * Obtener historial de sesiones finalizadas del usuario
 * Incluye el conteo de series completadas por sesión
 */
export async function obtenerHistorialSesiones(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<SesionResumen[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data: sesiones, error } = await supabase
      .from('sesiones')
      .select('id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('user_id', userId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo historial:', error)
      return { success: false, error: 'Error al cargar el historial' }
    }

    if (!sesiones || sesiones.length === 0) {
      return { success: true, data: [] }
    }

    // Obtener conteo de series completadas para todas las sesiones en una sola query
    const sesionIds = sesiones.map(s => s.id)
    const { data: seriesCompletadas } = await supabase
      .from('sesion_series')
      .select('sesion_id')
      .in('sesion_id', sesionIds)
      .eq('completada', true)

    // Contar por sesion_id en JS
    const conteoMap: Record<string, number> = {}
    for (const s of seriesCompletadas || []) {
      conteoMap[s.sesion_id] = (conteoMap[s.sesion_id] || 0) + 1
    }

    const resumen: SesionResumen[] = sesiones.map(s => ({
      id: s.id,
      dia_nombre: (s.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? '',
      finalizada_at: s.finalizada_at as string,
      series_completadas: conteoMap[s.id] || 0,
    }))

    return { success: true, data: resumen }
  } catch (err) {
    console.error('Error en obtenerHistorialSesiones:', err)
    return { success: false, error: 'Error al cargar el historial' }
  }
}

/**
 * Obtener el detalle completo de una sesión finalizada (read-only)
 */
export async function obtenerDetalleSesion(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<SesionDetalle>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

  try {
    // Sesión + nombre del día
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    const diaNombre = (sesion.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? ''

    // Ejercicios del día + series de la sesión en paralelo
    const [ejResult, seriesResult] = await Promise.all([
      supabase
        .from('rutina_ejercicios')
        .select('id, orden, ejercicios:ejercicio_id(nombre)')
        .eq('dia_id', sesion.dia_id)
        .order('orden', { ascending: true }),
      supabase
        .from('sesion_series')
        .select('rutina_ejercicio_id, numero_serie, peso_kg, repeticiones, completada')
        .eq('sesion_id', sesionId)
        .order('numero_serie', { ascending: true }),
    ])

    if (ejResult.error || !ejResult.data) {
      return { success: false, error: 'Error al cargar ejercicios' }
    }

    const series = seriesResult.data || []

    const ejercicios: EjercicioDetalle[] = ejResult.data.map(ej => {
      const nombre = (ej.ejercicios as unknown as { nombre: string } | null)?.nombre ?? ''
      const ejSeries: SerieDetalle[] = series
        .filter(s => s.rutina_ejercicio_id === ej.id)
        .map(s => ({
          numero_serie: s.numero_serie,
          peso_kg: s.peso_kg,
          repeticiones: s.repeticiones,
          completada: s.completada,
        }))
      return { nombre, series: ejSeries }
    })

    return {
      success: true,
      data: {
        id: sesionId,
        dia_nombre: diaNombre,
        finalizada_at: sesion.finalizada_at as string,
        ejercicios,
      },
    }
  } catch (err) {
    console.error('Error en obtenerDetalleSesion:', err)
    return { success: false, error: 'Error al cargar el detalle' }
  }
}
```

**Step 3: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: sin errores TypeScript.

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add lib/types/database.ts lib/services/sesion-service.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: tipos y servicios para historial de entrenamientos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Componente AppLayout

**Files:**
- Create: `app/components/AppLayout.tsx`

**Step 1: Crear el archivo**

```tsx
'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks'

interface AppLayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  { label: 'Mi Rutina', href: '/rutinas' },
  { label: 'Entrenamiento', href: '/entrenamiento' },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const cerrar = () => setDrawerOpen(false)

  const isActivo = (href: string) =>
    pathname === href || (pathname?.startsWith(href + '/') && href !== '/rutinas')

  return (
    <div className="relative">
      {/* Botón hamburger */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menú"
        className="fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={cerrar}
          aria-hidden="true"
        />
      )}

      {/* Drawer lateral */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-neutral-900 z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!drawerOpen}
      >
        {/* Logo */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-yellow-500 font-display text-2xl tracking-widest uppercase">
            GymLogic
          </span>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Links de navegación */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              type="button"
              onClick={() => { router.push(item.href); cerrar() }}
              className={`w-full text-left px-4 py-3 rounded-xl font-semibold transition-colors ${
                isActivo(item.href)
                  ? 'bg-yellow-500 text-black'
                  : 'text-white hover:bg-neutral-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer: email + cerrar sesión */}
        <div className="p-4 border-t border-neutral-800">
          {user?.email && (
            <p className="text-neutral-500 text-xs mb-3 truncate px-1">{user.email}</p>
          )}
          <button
            type="button"
            onClick={() => { cerrar(); logout() }}
            className="w-full text-left px-4 py-2 text-neutral-400 hover:text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Contenido de la página */}
      {children}
    </div>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/AppLayout.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: componente AppLayout con drawer de navegación

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Integrar AppLayout en páginas existentes

**Files:**
- Modify: `app/rutinas/page.tsx`
- Modify: `app/entrenar/page.tsx`
- Modify: `app/entrenar/[sesionId]/page.tsx`

**Contexto:** Cada página se envuelve en `<AppLayout>`. Los headers reciben `pl-14` para que el contenido no quede debajo del botón ☰ (que es `fixed left-4`, 40px de ancho + 16px de margen = 56px desde el borde). Se elimina el botón "Cerrar Sesión" de `/rutinas` y el botón "← Volver a Mi Rutina" de `/entrenar`.

**Step 1: Modificar `app/rutinas/page.tsx`**

Agregar import de AppLayout:
```tsx
import AppLayout from '@/app/components/AppLayout'
```

En el return principal, envolver el contenido:
```tsx
return (
  <AppLayout>
    <div className="min-h-screen app-page-bg p-4 md:p-6">
      ...
    </div>
  </AppLayout>
)
```

En el header de la página, agregar `pl-14` al div del título para hacer espacio al hamburger:
```tsx
<div>
  <h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
    Mi Rutina Activa
  </h1>
```

Eliminar el botón "Cerrar Sesión" del grupo de botones (ya está en el drawer). El grupo queda así:
```tsx
<div className="flex flex-col sm:flex-row gap-3">
  {rutinaData && (
    <button
      type="button"
      onClick={() => router.push('/entrenar')}
      className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all duration-200 shadow-lg shadow-neutral-900/10"
    >
      Entrenar
    </button>
  )}
  <button
    onClick={handleGenerateNew}
    className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
  >
    Nueva Rutina
  </button>
</div>
```

También eliminar la importación de `logout` del hook `useAuth` si ya no se usa en la página (verificar que no se use en otro lugar).

**Step 2: Modificar `app/entrenar/page.tsx`**

Agregar import:
```tsx
import AppLayout from '@/app/components/AppLayout'
```

Envolver el return en `<AppLayout>`. Agregar `pl-14 md:pl-0` al h1. Eliminar el botón "← Volver a Mi Rutina" del final (el drawer cumple esa función):

```tsx
return (
  <AppLayout>
    <div className="min-h-screen app-page-bg p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
            Entrenar
          </h1>
          <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
        </div>
        {/* ... resto del contenido sin el botón Volver ... */}
      </div>
    </div>
  </AppLayout>
)
```

**Step 3: Modificar `app/entrenar/[sesionId]/page.tsx`**

Agregar import:
```tsx
import AppLayout from '@/app/components/AppLayout'
```

Envolver todos los returns que muestran la UI en `<AppLayout>` (el spinner y el "not found" también):

```tsx
// Spinner:
return (
  <AppLayout>
    <div className="min-h-screen app-page-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  </AppLayout>
)

// Not found:
return (
  <AppLayout>
    <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
      ...
    </div>
  </AppLayout>
)

// Main:
return (
  <AppLayout>
    <div className="min-h-screen app-page-bg p-4 md:p-6 pb-28">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <button ... >  {/* botón "Cambiar día" se mantiene */}
          </button>
          <h1 className="text-4xl md:text-5xl font-display ... pl-14 md:pl-0">
            {sesion.dia_nombre}
          </h1>
```

Nota: el botón sticky "Finalizar sesión" tiene `z-index` implícito como `fixed` — verificar que no quede debajo del drawer (el drawer tiene `z-50`, el botón sticky también necesita `z-30` como mínimo para estar sobre el contenido pero debajo del drawer).

**Step 4: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: build limpio, todas las rutas presentes.

**Step 5: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx app/entrenar/page.tsx "app/entrenar/[sesionId]/page.tsx"
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: integrar AppLayout en páginas autenticadas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Página /entrenamiento — Historial

**Files:**
- Create: `app/entrenamiento/page.tsx`

**Step 1: Crear el archivo**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerHistorialSesiones } from '@/lib/services/sesion-service'
import { SesionResumen } from '@/lib/types/database'
import AppLayout from '@/app/components/AppLayout'

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function EntrenamientoPage() {
  const [sesiones, setSesiones] = useState<SesionResumen[]>([])
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated || !userId) {
      router.replace('/')
      return
    }

    obtenerHistorialSesiones(supabase, userId).then(result => {
      if (result.success && result.data) {
        setSesiones(result.data)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingAuth || loading) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen app-page-bg p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
              Entrenamiento
            </h1>
            <div className="h-0.5 w-12 bg-yellow-500 rounded-full" />
          </div>

          {/* Lista de sesiones */}
          {sesiones.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-500 mb-4">Todavía no registraste ningún entrenamiento.</p>
              <button
                type="button"
                onClick={() => router.push('/entrenar')}
                className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
              >
                Ir a Entrenar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sesiones.map(sesion => (
                <button
                  key={sesion.id}
                  type="button"
                  onClick={() => router.push(`/entrenamiento/${sesion.id}`)}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-yellow-400 hover:bg-yellow-50/30 transition-all duration-200 shadow-sm"
                >
                  <p className="font-bold text-slate-900">{sesion.dia_nombre}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {formatearFecha(sesion.finalizada_at)}
                    {sesion.series_completadas > 0 && (
                      <span className="ml-2 text-yellow-600 font-medium">
                        · {sesion.series_completadas} series ✓
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/entrenamiento/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: página /entrenamiento con historial de sesiones

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Página /entrenamiento/[sesionId] — Detalle

**Files:**
- Create: `app/entrenamiento/[sesionId]/page.tsx`

**Step 1: Crear el archivo**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import { obtenerDetalleSesion } from '@/lib/services/sesion-service'
import { SesionDetalle } from '@/lib/types/database'
import AppLayout from '@/app/components/AppLayout'

function formatearFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DetalleSesionPage() {
  const params = useParams()
  const sesionId = params.sesionId as string
  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated } = useAuth()

  const [sesion, setSesion] = useState<SesionDetalle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated) {
      router.replace('/')
      return
    }

    obtenerDetalleSesion(supabase, sesionId).then(result => {
      if (result.success && result.data) {
        setSesion(result.data)
      }
      setLoading(false)
    })
  }, [loadingAuth, authenticated, sesionId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingAuth || loading) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  if (!sesion) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-slate-600 mb-4">Sesión no encontrada.</p>
            <button
              type="button"
              onClick={() => router.push('/entrenamiento')}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all"
            >
              Volver al Historial
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen app-page-bg p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => router.push('/entrenamiento')}
              className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors pl-14 md:pl-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Historial
            </button>
            <h1 className="text-4xl md:text-5xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
              {sesion.dia_nombre}
            </h1>
            <p className="text-slate-500 text-sm capitalize pl-14 md:pl-0">
              {formatearFechaLarga(sesion.finalizada_at)}
            </p>
            <div className="h-0.5 w-12 bg-yellow-500 rounded-full mt-2" />
          </div>

          {/* Ejercicios */}
          <div className="space-y-5">
            {sesion.ejercicios.map((ej, ejIdx) => (
              <div
                key={ejIdx}
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
                  {ej.series.map(serie => (
                    <div
                      key={serie.numero_serie}
                      className={`flex items-center gap-2 py-2 px-3 rounded-xl ${
                        serie.completada ? 'bg-yellow-50' : 'bg-slate-50'
                      }`}
                    >
                      {/* Número de serie */}
                      <span className="text-sm font-semibold text-slate-400 w-5 text-center flex-shrink-0">
                        {serie.numero_serie}
                      </span>

                      {/* Peso */}
                      <span className="w-20 text-center text-sm font-medium text-slate-700">
                        {serie.peso_kg !== null ? `${serie.peso_kg} kg` : '—'}
                      </span>

                      {/* Reps */}
                      <span className="w-16 text-center text-sm font-medium text-slate-700">
                        {serie.repeticiones !== null ? serie.repeticiones : '—'}
                      </span>

                      {/* Ícono completada */}
                      <div
                        className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          serie.completada
                            ? 'bg-yellow-500 text-black'
                            : 'bg-white border-2 border-slate-200 text-slate-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: build limpio, rutas `/entrenamiento` y `/entrenamiento/[sesionId]` presentes.

**Step 3: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add "app/entrenamiento/[sesionId]/page.tsx"
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: página de detalle read-only de sesión de entrenamiento

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist final

- [ ] Task 1 ✅ Tipos `SesionResumen`, `SesionDetalle`, `EjercicioDetalle`, `SerieDetalle` en `database.ts`
- [ ] Task 1 ✅ `obtenerHistorialSesiones` y `obtenerDetalleSesion` en `sesion-service.ts`
- [ ] Task 2 ✅ `AppLayout` con hamburger, drawer negro/amarillo, backdrop, cierre con click afuera
- [ ] Task 3 ✅ `/rutinas`, `/entrenar`, `/entrenar/[sesionId]` envueltos en AppLayout
- [ ] Task 3 ✅ "Cerrar Sesión" y "← Volver" eliminados de los headers individuales
- [ ] Task 4 ✅ `/entrenamiento` con lista de sesiones y estado vacío
- [ ] Task 5 ✅ `/entrenamiento/[sesionId]` con detalle read-only por ejercicio
- [ ] Build pasa sin errores TypeScript
- [ ] Drawer: link activo resaltado en amarillo, "Cerrar Sesión" al fondo
- [ ] Hamburger no tapa el contenido (pl-14 en títulos mobile)
