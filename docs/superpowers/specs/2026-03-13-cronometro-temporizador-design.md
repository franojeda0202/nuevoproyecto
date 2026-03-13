# Cronómetro de Sesión + Temporizador de Descanso — Design Spec

**Date:** 2026-03-13
**App:** GymLogic (Next.js 16 App Router + Supabase Auth)
**Status:** Approved

---

## Objetivo

Agregar dos herramientas de tiempo a la pantalla de sesión activa (`/entrenar/[sesionId]`):

1. **Cronómetro de sesión:** muestra el tiempo transcurrido desde que empezó el entrenamiento, siempre visible como badge flotante.
2. **Temporizador de descanso:** countdown configurable con presets, con sonido al terminar. Accesible desde la barra inferior sin interrumpir el flujo.

---

## Feature 1 — Cronómetro de sesión

### Datos necesarios

`SesionActiva` no incluye `iniciada_at` actualmente. Se necesitan dos cambios:

- **`lib/types/database.ts`**: agregar `iniciada_at: string` a la interfaz `SesionActiva`
- **`lib/services/sesion-service.ts`**: en `obtenerSesionActiva`, agregar `iniciada_at` al select de la tabla `sesiones`:
  ```ts
  .select('id, dia_id, user_id, finalizada_at, iniciada_at, rutina_dias(nombre_dia)')
  ```

### Lógica del cronómetro

En `SesionActivaPage`:

```ts
const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0) // segundos

useEffect(() => {
  if (!sesion?.iniciada_at) return
  const inicio = new Date(sesion.iniciada_at).getTime()
  const tick = () => setTiempoTranscurrido(Math.floor((Date.now() - inicio) / 1000))
  tick() // calcular inmediatamente
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}, [sesion?.iniciada_at])
```

Función de formateo (pura, sin dependencias):
```ts
function formatearTiempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
```

Muestra `MM:SS` hasta 59:59, luego `H:MM:SS`.

### Visual del badge

Posición: `fixed top-4 right-4 z-40` (encima del contenido, no interfiere con el nav lateral de AppLayout en desktop).

```tsx
<div className="fixed top-4 right-4 z-40 flex items-center gap-1.5 bg-neutral-900 text-yellow-500 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums shadow-lg">
  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
  {formatearTiempo(tiempoTranscurrido)}
</div>
```

Solo se renderiza cuando `sesion` está cargado (no durante loading).

---

## Feature 2 — Temporizador de descanso

### Punto de entrada

La barra sticky inferior se modifica para tener dos elementos:

```
[ ⏱ btn ] [ Finalizar sesión (flex-1) ]
```

El botón ⏱ tiene `40×40px`, fondo `bg-neutral-900`, ícono de cronómetro en blanco.

**Cuando el timer está corriendo:** el botón reemplaza el ícono por el tiempo restante en `text-yellow-500` con `animate-pulse`, ej. `1:47`. Esto permite al usuario ver el countdown sin abrir el panel.

### Panel deslizable (`TemporizadorPanel`)

Componente: `app/components/sesion/TemporizadorPanel.tsx`

**Props:**
```ts
interface TemporizadorPanelProps {
  isOpen: boolean
  onClose: () => void
  tiempoRestante: number        // segundos, 0 = inactivo
  corriendo: boolean
  onStart: (segundos: number) => void
  onCancelar: () => void
}
```

**UI cuando no hay timer corriendo:**
- Handle drag visual (pill gris centrado arriba)
- Título "Descanso" en texto pequeño uppercase
- Fila de presets: `1:00 · 1:30 · 2:00 · 3:00` (botones seleccionables, el seleccionado en `bg-yellow-500`)
- `selectedPreset` es estado local del panel, inicializado en `120` (2:00). Persiste la última selección del usuario durante la sesión. Al reabrir el panel después de que un timer terminó, `selectedPreset` mantiene el valor anterior — el usuario puede hacer Start inmediatamente para repetir el mismo descanso.
- Botón "▶ Start" en `bg-neutral-900 text-white`
- Overlay oscuro semitransparente detrás del panel, click en overlay cierra el panel

**UI cuando hay timer corriendo:**
- Número grande del tiempo restante (`text-5xl font-display text-yellow-500 tabular-nums`)
- Barra de progreso visual (ancho decrece según tiempo restante vs tiempo total)
- Botón "✕ Cancelar" en `border border-slate-200 text-slate-600`

**Animación de apertura:** el panel usa `translate-y` con transición CSS. Cuando `isOpen = true` → `translate-y-0`. Cuando `false` → `translate-y-full`. Aplicar `transition-transform duration-300 ease-out`.

### Lógica del countdown

La lógica del countdown vive en `SesionActivaPage` (no dentro del panel) para que el timer siga corriendo aunque el panel esté cerrado:

```ts
const [tiempoRestante, setTiempoRestante] = useState(0)    // segundos
const [tiempoTotal, setTiempoTotal] = useState(0)          // para la barra de progreso
const [timerCorriendo, setTimerCorriendo] = useState(false)
const audioCtxRef = useRef<AudioContext | null>(null)
const beepFiredRef = useRef(false)  // guard contra doble beep en Strict Mode
const [panelOpen, setPanelOpen] = useState(false)

const handleStart = (segundos: number) => {
  // Desbloquear AudioContext en este gesto del usuario
  // Envuelto en try/catch: Safari <14.1 usa webkitAudioContext; cualquier fallo no debe impedir que el timer arranque
  try {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AudioCtx()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  } catch {
    // Sin sonido en este navegador — el timer funciona igual
  }
  beepFiredRef.current = false  // resetear guard al iniciar nuevo timer
  setTiempoRestante(segundos)
  setTiempoTotal(segundos)
  setTimerCorriendo(true)
  setPanelOpen(false)
}

const handleCancelar = () => {
  setTiempoRestante(0)
  setTiempoTotal(0)
  setTimerCorriendo(false)
}
```

`useEffect` del countdown:
```ts
useEffect(() => {
  if (!timerCorriendo || tiempoRestante <= 0) return
  const id = setInterval(() => {
    // Capturar si llegamos a cero FUERA del updater, siguiendo el patrón del proyecto
    // (nunca llamar side-effects async dentro de setState updaters — CLAUDE.md)
    let terminado = false

    setTiempoRestante(prev => {
      if (prev <= 1) {
        terminado = true
        return 0
      }
      return prev - 1
    })

    // Side-effects FUERA del updater — no se ejecutan doble en Strict Mode
    if (terminado && !beepFiredRef.current) {
      beepFiredRef.current = true  // evitar doble beep si dos intervals coinciden (Strict Mode dev)
      clearInterval(id)
      setTimerCorriendo(false)
      reproducirBeep(audioCtxRef.current)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }
  }, 1000)
  return () => clearInterval(id)
}, [timerCorriendo]) // solo depende de timerCorriendo, no de tiempoRestante
```

Nota: el `setInterval` se inicia cuando `timerCorriendo` pasa a `true` y se limpia cuando se desmonta o cuando `timerCorriendo` cambia. Los side-effects (`reproducirBeep`, `vibrate`) se ejecutan fuera del updater de `setState` para cumplir con el patrón del proyecto y evitar doble ejecución en Strict Mode.

### Sonido — Web Audio API

Archivo: `lib/utils/audio.ts`

```ts
export function reproducirBeep(audioCtx: AudioContext | null): void {
  if (!audioCtx) return
  const beeps = [0, 0.25, 0.5] // tiempos de inicio de cada beep (segundos)
  beeps.forEach(delay => {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = 880  // La5 — tono claro y audible
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.15)
    osc.start(audioCtx.currentTime + delay)
    osc.stop(audioCtx.currentTime + delay + 0.15)
  })
}
```

Produce 3 beeps de 150ms a 880Hz con 100ms de pausa entre ellos. El `AudioContext` se crea en el click de Start (gesto del usuario), lo que desbloquea el audio en iOS y Android.

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `lib/types/database.ts` | Modificar — agregar `iniciada_at: string` a `SesionActiva` |
| `lib/services/sesion-service.ts` | Modificar — agregar `iniciada_at` al select de sesiones |
| `lib/utils/audio.ts` | Crear — función `reproducirBeep` con Web Audio API |
| `app/components/sesion/TemporizadorPanel.tsx` | Crear — panel deslizable con presets y countdown UI |
| `app/entrenar/[sesionId]/page.tsx` | Modificar — badge flotante, lógica de ambos timers, botón ⏱, integración del panel |

---

## Manejo de errores y edge cases

| Situación | Comportamiento |
|-----------|----------------|
| `AudioContext` no soportado (Safari antiguo) | `try/catch` en creación; si falla, el timer sigue funcionando sin sonido |
| `navigator.vibrate` no disponible (desktop/iOS) | Chequeo `if (navigator.vibrate)` antes de llamar |
| Usuario recarga la página con timer corriendo | El timer se reinicia (estado en memoria, no persistido — aceptable) |
| Sesión sin `iniciada_at` (datos corruptos) | El badge no se renderiza (guard `if (!sesion?.iniciada_at)`) |
| El panel está abierto y el timer termina | El panel actualiza su UI mostrando `0:00` y el botón pasa a presets |

---

## Fuera de alcance

- Persistir el timer entre recargas
- Sonido personalizable por el usuario
- Timer que se pausa automáticamente
- Notificaciones push cuando la app está en background
