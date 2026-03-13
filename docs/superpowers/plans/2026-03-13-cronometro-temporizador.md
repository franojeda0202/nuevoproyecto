# Cronómetro de Sesión + Temporizador de Descanso — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un cronómetro de sesión (badge flotante con tiempo transcurrido) y un temporizador de descanso (panel deslizable con presets y beep al terminar) a la pantalla de sesión activa.

**Architecture:** La lógica de ambos timers vive en `SesionActivaPage` para que el countdown siga corriendo cuando el panel está cerrado. El `TemporizadorPanel` es un componente presentacional puro que recibe props. El sonido se genera con Web Audio API, desbloqueada en el gesto de Start del usuario.

**Tech Stack:** Next.js 16 App Router, React 18 ('use client'), TypeScript, Tailwind CSS v4, Web Audio API nativa del navegador.

---

## Chunk 1: Datos, audio utility y cronómetro de sesión

### Task 1: Agregar `iniciada_at` al tipo `SesionActiva`

**Files:**
- Modify: `lib/types/database.ts`

- [ ] **Step 1: Editar la interfaz `SesionActiva`**

Abrir `lib/types/database.ts`. Localizar la interfaz `SesionActiva` (alrededor de la línea 221). Agregar el campo `iniciada_at`:

```ts
export interface SesionActiva {
  id: string
  dia_nombre: string
  iniciada_at: string      // ← agregar esta línea
  finalizada_at: string | null
  ejercicios: EjercicioConSeries[]
}
```

- [ ] **Step 2: Verificar que TypeScript no reporta errores**

```bash
npx tsc --noEmit
```

Esperado: sin errores. Si hay errores de tipo, son por usos existentes que no rompen nada (el campo es nuevo, no reemplaza ninguno).

- [ ] **Step 3: Commit**

```bash
git add lib/types/database.ts
git commit -m "feat: agregar iniciada_at a SesionActiva para cronómetro de sesión"
```

---

### Task 2: Exponer `iniciada_at` en el servicio de sesiones

**Files:**
- Modify: `lib/services/sesion-service.ts`

- [ ] **Step 1: Actualizar el select en `obtenerSesionActiva`**

Abrir `lib/services/sesion-service.ts`. Localizar la función `obtenerSesionActiva` (~línea 156). Buscar la query de `sesiones`:

```ts
// ANTES:
.select('id, dia_id, user_id, finalizada_at, rutina_dias(nombre_dia)')
```

Cambiarla a:

```ts
// DESPUÉS:
.select('id, dia_id, user_id, finalizada_at, iniciada_at, rutina_dias(nombre_dia)')
```

- [ ] **Step 2: Incluir `iniciada_at` en el objeto `SesionActiva` que construye la función**

En la misma función, localizar el bloque `return` final (~línea 264). El código exacto actual es:

```ts
// ANTES (código exacto en el archivo):
return {
  success: true,
  data: {
    id: sesionId,
    dia_nombre: diaNombre,
    finalizada_at: sesion.finalizada_at,
    ejercicios: ejerciciosConSeries,
  },
}
```

Reemplazarlo por:

```ts
// DESPUÉS:
return {
  success: true,
  data: {
    id: sesionId,
    dia_nombre: diaNombre,
    iniciada_at: sesion.iniciada_at as string,   // ← agregar; cast necesario porque Supabase no infiere campos del select sin schema generado
    finalizada_at: sesion.finalizada_at,
    ejercicios: ejerciciosConSeries,
  },
}
```

Nota sobre tipos: el proyecto no usa tipos generados de Supabase (usa casts manuales como `as unknown as`). Por eso `sesion.iniciada_at` puede no estar tipado en el tipo inferido por el cliente. El cast `as string` es seguro porque acabamos de agregar `iniciada_at` al select y la columna es `NOT NULL` en la DB.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores. Si TypeScript reporta que `iniciada_at` no existe en el tipo inferido de `sesion`, el cast `as string` ya lo resuelve.

- [ ] **Step 4: Verificar manualmente que la sesión carga con `iniciada_at`**

```bash
npm run dev
```

Abrir `/entrenar` en el navegador, iniciar o continuar una sesión. Abrir las DevTools → Network → buscar la respuesta del fetch inicial de la sesión. Verificar que el objeto de sesión tiene `iniciada_at` con una fecha ISO válida.

- [ ] **Step 5: Commit**

```bash
git add lib/services/sesion-service.ts
git commit -m "feat: exponer iniciada_at en obtenerSesionActiva"
```

---

### Task 3: Crear la utilidad de audio

**Files:**
- Create: `lib/utils/audio.ts`

- [ ] **Step 1: Crear el directorio y el archivo**

```bash
mkdir -p lib/utils
```

Crear `lib/utils/audio.ts` con el siguiente contenido:

```ts
/**
 * Reproduce 3 beeps cortos usando Web Audio API.
 * El AudioContext debe haber sido creado y desbloqueado previamente
 * en un gesto del usuario (click/tap). Si audioCtx es null o está
 * en estado incorrecto, falla silenciosamente.
 */
export function reproducirBeep(audioCtx: AudioContext | null): void {
  if (!audioCtx) return

  // 3 beeps a 880Hz (La5), 150ms cada uno, separados 250ms
  const tiempos = [0, 0.25, 0.5]

  tiempos.forEach(delay => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.type = 'sine'
    osc.frequency.value = 880

    // Fade out para evitar click de audio al cortar
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.15)

    osc.start(audioCtx.currentTime + delay)
    osc.stop(audioCtx.currentTime + delay + 0.15)
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/utils/audio.ts
git commit -m "feat: agregar utilidad reproducirBeep con Web Audio API"
```

---

### Task 4: Cronómetro de sesión — badge flotante

**Files:**
- Modify: `app/entrenar/[sesionId]/page.tsx`

- [ ] **Step 1: Agregar la función `formatearTiempo` al archivo**

Abrir `app/entrenar/[sesionId]/page.tsx`. Después de los imports (antes del componente `SesionActivaPage`), agregar esta función pura:

```ts
function formatearTiempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 2: Agregar el estado `tiempoTranscurrido`**

Dentro de `SesionActivaPage`, junto a los otros `useState` existentes, agregar:

```ts
const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0) // segundos
```

- [ ] **Step 3: Agregar el `useEffect` del cronómetro**

Después del `useEffect` existente de carga de sesión, agregar:

```ts
useEffect(() => {
  if (!sesion?.iniciada_at) return
  const inicio = new Date(sesion.iniciada_at).getTime()
  const tick = () => setTiempoTranscurrido(Math.floor((Date.now() - inicio) / 1000))
  tick() // calcular inmediatamente sin esperar 1 segundo
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}, [sesion?.iniciada_at])
```

- [ ] **Step 4: Agregar el badge flotante al JSX**

En el archivo `app/entrenar/[sesionId]/page.tsx` hay múltiples bloques `return`. El badge va en el **último** `return` — el que renderiza la sesión activa (el que comienza con `<AppLayout>` y contiene el grid de ejercicios y la barra inferior).

Ese return tiene esta estructura exacta:

```tsx
return (
  <AppLayout>
  <div className="min-h-screen app-page-bg p-4 md:p-8 pb-28">
    ...
  </div>
  </AppLayout>
)
```

Agregar el badge **entre** `<AppLayout>` y `<div className="min-h-screen...">`:

```tsx
return (
  <AppLayout>

  {/* Badge cronómetro de sesión */}
  {sesion && (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5 bg-neutral-900 text-yellow-500 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums shadow-lg pointer-events-none">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
      {formatearTiempo(tiempoTranscurrido)}
    </div>
  )}

  <div className="min-h-screen app-page-bg p-4 md:p-8 pb-28">
    ...
  </div>
  </AppLayout>
)
```

`pointer-events-none` evita que el badge interfiera con clicks en elementos que queden debajo.

- [ ] **Step 5: Verificar en el navegador**

```bash
npm run dev
```

Abrir una sesión activa. Verificar:
- El badge aparece en la esquina superior derecha con el tiempo en formato `MM:SS`
- El tiempo avanza cada segundo
- El badge no interfiere con el botón "← Cambiar día"
- En desktop, el badge no solapa con la sidebar izquierda de AppLayout

- [ ] **Step 6: Commit**

```bash
git add app/entrenar/\[sesionId\]/page.tsx
git commit -m "feat: agregar cronómetro de sesión como badge flotante"
```

---

## Chunk 2: TemporizadorPanel e integración completa

### Task 5: Crear el componente `TemporizadorPanel`

**Files:**
- Create: `app/components/sesion/TemporizadorPanel.tsx`

- [ ] **Step 1: Crear el archivo con la estructura completa**

Crear `app/components/sesion/TemporizadorPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface TemporizadorPanelProps {
  isOpen: boolean
  onClose: () => void
  tiempoRestante: number   // segundos; 0 = timer inactivo
  tiempoTotal: number      // segundos; para calcular la barra de progreso (extensión intencional sobre el spec — necesario para el progress bar)
  corriendo: boolean
  onStart: (segundos: number) => void
  onCancelar: () => void
}

const PRESETS = [
  { label: '1:00', segundos: 60 },
  { label: '1:30', segundos: 90 },
  { label: '2:00', segundos: 120 },
  { label: '3:00', segundos: 180 },
]

function formatearCountdown(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TemporizadorPanel({
  isOpen,
  onClose,
  tiempoRestante,
  tiempoTotal,
  corriendo,
  onStart,
  onCancelar,
}: TemporizadorPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState(120) // 2:00 por defecto

  const progreso = tiempoTotal > 0 ? tiempoRestante / tiempoTotal : 0

  return (
    <>
      {/* Overlay — click fuera cierra el panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel deslizable */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Handle visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="px-6 pb-8 pt-2">
          {/* Título */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 text-center">
            Descanso
          </p>

          {corriendo ? (
            /* Estado: timer corriendo */
            <>
              {/* Tiempo restante grande */}
              <div className="text-center mb-4">
                <span className="text-5xl font-display text-yellow-500 tabular-nums tracking-widest">
                  {formatearCountdown(tiempoRestante)}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progreso * 100}%` }}
                />
              </div>

              {/* Botón cancelar */}
              <button
                type="button"
                onClick={onCancelar}
                className="w-full h-12 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-200"
              >
                ✕ Cancelar
              </button>
            </>
          ) : (
            /* Estado: seleccionar preset */
            <>
              {/* Presets */}
              <div className="flex gap-2 mb-5">
                {PRESETS.map(({ label, segundos }) => (
                  <button
                    key={segundos}
                    type="button"
                    onClick={() => setSelectedPreset(segundos)}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      selectedPreset === segundos
                        ? 'bg-yellow-500 text-black shadow-md'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Botón start */}
              <button
                type="button"
                onClick={() => onStart(selectedPreset)}
                className="w-full h-12 bg-neutral-900 text-white rounded-xl font-bold text-lg hover:bg-neutral-800 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/sesion/TemporizadorPanel.tsx
git commit -m "feat: crear TemporizadorPanel con presets y countdown UI"
```

---

### Task 6: Integrar el temporizador en `SesionActivaPage`

**Files:**
- Modify: `app/entrenar/[sesionId]/page.tsx`

- [ ] **Step 1: Actualizar los imports**

Al principio de `app/entrenar/[sesionId]/page.tsx`, actualizar la línea de imports de React para incluir `useRef`:

```ts
// ANTES:
import { useState, useEffect, useCallback, useMemo } from 'react'

// DESPUÉS:
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
```

Agregar los nuevos imports al final de los imports:

```ts
import TemporizadorPanel from '@/app/components/sesion/TemporizadorPanel'
import { reproducirBeep } from '@/lib/utils/audio'
```

- [ ] **Step 2: Agregar los estados y refs del temporizador**

Dentro de `SesionActivaPage`, junto a los estados existentes, agregar:

```ts
// Temporizador de descanso
const [panelOpen, setPanelOpen] = useState(false)
const [tiempoRestante, setTiempoRestante] = useState(0)
const [tiempoTotal, setTiempoTotal] = useState(0)
const [timerCorriendo, setTimerCorriendo] = useState(false)
const audioCtxRef = useRef<AudioContext | null>(null)
const beepFiredRef = useRef(false)
```

- [ ] **Step 3: Agregar los handlers del temporizador**

Después de `handleFinalizar`, agregar:

```ts
const handleTimerStart = (segundos: number) => {
  // Crear/desbloquear AudioContext en este gesto del usuario (requisito iOS/Android)
  try {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AudioCtx()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  } catch {
    // Sin sonido en este navegador — el timer funciona igual
  }
  beepFiredRef.current = false
  setTiempoRestante(segundos)
  setTiempoTotal(segundos)
  setTimerCorriendo(true)
  setPanelOpen(false)
}

const handleTimerCancelar = () => {
  setTiempoRestante(0)
  setTiempoTotal(0)
  setTimerCorriendo(false)
}
```

- [ ] **Step 4: Agregar el `useEffect` del countdown**

Después del `useEffect` del cronómetro de sesión, agregar:

```ts
useEffect(() => {
  if (!timerCorriendo || tiempoRestante <= 0) return

  const id = setInterval(() => {
    let terminado = false

    setTiempoRestante(prev => {
      if (prev <= 1) {
        terminado = true
        return 0
      }
      return prev - 1
    })

    // Side-effects FUERA del updater para evitar doble ejecución en Strict Mode
    if (terminado && !beepFiredRef.current) {
      beepFiredRef.current = true
      clearInterval(id)
      setTimerCorriendo(false)
      reproducirBeep(audioCtxRef.current)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }
  }, 1000)

  return () => clearInterval(id)
}, [timerCorriendo])
```

- [ ] **Step 5: Modificar la barra inferior para agregar el botón ⏱**

Localizar el bloque `{/* Botón finalizar sticky */}` al final del JSX. Reemplazarlo:

```tsx
{/* Barra inferior sticky */}
<div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
  <div className="max-w-lg mx-auto flex gap-3 items-center">

    {/* Botón temporizador */}
    <button
      type="button"
      onClick={() => setPanelOpen(prev => !prev)}
      className="w-12 h-12 flex-shrink-0 bg-neutral-900 text-white rounded-xl flex items-center justify-center hover:bg-neutral-800 transition-all duration-200"
      aria-label="Abrir temporizador de descanso"
    >
      {timerCorriendo ? (
        <span className="text-yellow-500 text-sm font-bold tabular-nums animate-pulse">
          {formatearCountdown(tiempoRestante)}
        </span>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
          <path d="M9 2h6" />
        </svg>
      )}
    </button>

    {/* Botón finalizar */}
    <button
      type="button"
      onClick={handleFinalizar}
      disabled={finalizando}
      className="flex-1 h-12 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 active:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/10 flex items-center justify-center"
    >
      {finalizando ? 'Finalizando...' : 'Finalizar sesión'}
    </button>

  </div>
</div>
```

Nota: `formatearCountdown` es una función local en `page.tsx` para mostrar el countdown en el botón ⏱. Es una copia intencional — `TemporizadorPanel.tsx` tiene su propia versión local del mismo nombre para el display del panel. No hay que importarla del panel; cada archivo tiene la suya. Agregar esta función junto a `formatearTiempo` al inicio del archivo:

```ts
function formatearCountdown(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 6: Agregar `TemporizadorPanel` al JSX**

Al final del JSX del componente, justo antes del `</AppLayout>` de cierre, agregar:

```tsx
<TemporizadorPanel
  isOpen={panelOpen}
  onClose={() => setPanelOpen(false)}
  tiempoRestante={tiempoRestante}
  tiempoTotal={tiempoTotal}
  corriendo={timerCorriendo}
  onStart={handleTimerStart}
  onCancelar={handleTimerCancelar}
/>
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 8: Verificar build de producción**

```bash
npm run build
```

Esperado: build exitoso sin errores.

- [ ] **Step 9: Verificar manualmente en el navegador**

```bash
npm run dev
```

Abrir una sesión activa y verificar:

**Cronómetro de sesión:**
- Badge `● MM:SS` visible en esquina superior derecha
- Avanza cada segundo
- Cambia a `H:MM:SS` al pasar una hora (no verificable en test rápido, pero el código lo soporta)
- No interfiere con clicks en otros elementos

**Temporizador — flujo básico:**
- Botón ⏱ visible en la barra inferior izquierda
- Al clickearlo aparece el panel deslizando desde abajo
- El overlay oscuro se ve detrás del panel
- Los 4 presets se muestran: `1:00 · 1:30 · 2:00 · 3:00`
- `2:00` viene seleccionado por defecto (amarillo)
- Clickear otro preset lo selecciona
- Clickear fuera del panel (overlay) lo cierra
- Clickear "▶ Start" inicia el countdown y cierra el panel
- El botón ⏱ en la barra pasa a mostrar el tiempo restante parpadeando
- Clickear el botón ⏱ mientras el timer corre abre el panel mostrando el countdown y la barra de progreso
- La barra de progreso decrece gradualmente
- El botón "✕ Cancelar" detiene el timer
- Al llegar a 0: suena el beep (3 pitidos), vibra el teléfono si es mobile, el panel vuelve a mostrar los presets

- [ ] **Step 10: Commit final**

```bash
git add app/entrenar/\[sesionId\]/page.tsx
git commit -m "feat: integrar temporizador de descanso con panel deslizable y beep"
```
