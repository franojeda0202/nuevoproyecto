# Métricas — Sub-proyecto 1: Estadísticas de Sesión

## Contexto y objetivo

GymLogic ya tiene historial de sesiones terminadas en `/entrenamiento`. El objetivo de este sub-proyecto es agregar una sección **Métricas** que muestre estadísticas de entrenamiento, calendario mensual, y récords personales (PRs) por ejercicio — todo visible de un toque en mobile.

El alcance está acotado a estadísticas de sesión (frecuencia, racha, duración, completitud y PRs). La progresión por ejercicio (gráficos de peso/volumen/reps) es sub-proyecto 2 y queda fuera de este spec.

---

## Navegación

**Decisión:** Métricas vive como un tab interno dentro de `/entrenamiento`, al lado del historial existente. No se modifica la navegación principal (drawer lateral).

La página `/entrenamiento` pasa a tener dos tabs:
- **Historial** — comportamiento actual (sin cambios)
- **Métricas** — contenido nuevo definido en este spec

El tab activo por defecto sigue siendo "Historial" para no romper el flujo existente. El estado del tab vive en `useState` local (no en URL), ya que no hay razón de linkearlo directamente.

---

## Layout de Métricas (tab Resumen)

El tab Métricas tiene a su vez dos sub-tabs internos:
- **Resumen** — activo por defecto, todo el contenido de este spec
- **Progreso** — placeholder "Próximamente" (sub-proyecto 2)

### Sección 1: Hero stat

Un bloque oscuro (`bg-neutral-900`) con:
- Label: "Entrenamientos este mes"
- Número grande en `text-yellow-500` (ej: `8`)
- Sub-label comparativo: "↑ 2 más que el mes pasado" / "↓ 1 menos que el mes pasado" / "Igual que el mes pasado"

La comparación se calcula contando sesiones del mes actual vs. el mes anterior (ambos calendarios completos, no últimos 30 días).

### Sección 2: Mini-stats row (3 tarjetas)

Grid de 3 columnas, cada tarjeta con un número y un label:

| Métrica | Cálculo |
|---|---|
| **Racha** | Semanas consecutivas con ≥1 sesión. Una "semana" = lunes a domingo. La racha se corta si la semana anterior no tuvo sesiones. La semana en curso (la que incluye "hoy") **siempre cuenta** — si el usuario no entrenó aún esta semana pero entrenó todas las semanas anteriores, la racha incluye esas semanas previas (la semana actual aún no está rota). |
| **Duración prom.** | Promedio en minutos de `(finalizada_at - iniciada_at)` para sesiones del mes actual con ambas fechas. |
| **Series completadas** | Porcentaje: `sesion_series completadas / sesion_series total` para el mes actual. |

### Sección 3: Calendario mensual

Calendario del mes en curso con:
- Días de la semana como header (L M M J V S D)
- Cada día del mes como celda pequeña
- Días con sesión finalizada: fondo `bg-yellow-500`, texto negro
- Días sin sesión (pasados): fondo `bg-slate-100`, texto gris
- Días futuros: mismo estilo que sin sesión (fondo `bg-slate-100`, texto gris)
- Hoy (si no entrenó): fondo `bg-slate-200`, texto `text-slate-900 font-bold` — distinguible visualmente pero sin el amarillo reservado para entrenamientos completados
- Hoy (si entrenó): fondo `bg-yellow-500`, texto negro (igual que cualquier día con sesión)

El mes mostrado es siempre el mes actual. No hay navegación entre meses en este sub-proyecto.

### Sección 4: Récords personales (PRs)

Tarjeta con título "🏆 Récords personales" y lista de ejercicios + su PR (mejor peso × reps registrado históricamente).

**Ejercicios mostrados por defecto:**
- Se obtienen los ejercicios de la rutina activa del usuario (la más reciente con `created_at DESC`)
- Se filtran solo los compuestos: `patron_movimiento IN ('push', 'pull', 'rodilla', 'cadera')`
- Se ordenan por frecuencia de aparición en la rutina (cuántos días distintos incluyen ese ejercicio)
- Se muestran los top 4

**Personalización:**
- Un botón "+" abre un selector inline (panel expandible debajo de la lista de PRs, sin modal)
- El selector muestra todos los ejercicios de la rutina activa que no están ya en la lista visible
- El usuario puede agregar hasta 4 ejercicios adicionales (máximo 8 visibles en total: 4 default + 4 pinned)
- Los ejercicios extra se persisten en `localStorage` bajo la clave `gymlogic_pr_pins` como array de `ejercicio_id`
- Cuando ya hay 4 pinned, el botón "+" no se muestra (el cap es silencioso — no hay mensaje de error)
- Cada ejercicio pinned tiene un botón "×" para quitarlo de la lista; al quitarlo se elimina de `localStorage`

**Cálculo del PR:**
- Para cada ejercicio, buscar en todas las `sesion_series` del usuario (sin filtro de rutina) donde `completada = true` y `peso_kg IS NOT NULL` y `repeticiones IS NOT NULL`
- El PR es la fila con mayor `peso_kg`; en empate, mayor `repeticiones`
- Si no hay ninguna serie registrada con ambos valores: mostrar `-` (guion)

**Formato de display:** `80 kg × 8` — si no hay PR: `-`

---

## Modelo de datos

No se requieren nuevas tablas. Todas las métricas se calculan con las tablas existentes:

- `sesiones` — para contar entrenamientos, calcular racha y duración
- `sesion_series` — para % completadas y PRs
- `rutina_ejercicios` + `ejercicios` — para obtener ejercicios de la rutina activa

### Nuevos tipos TypeScript (en `lib/types/database.ts`)

```ts
// Métricas de sesión para la pantalla de Métricas
export interface MetricasResumen {
  entrenamientosEsteMes: number
  entrenamientosMesPasado: number
  rachaActual: number           // semanas consecutivas
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
```

---

## Capa de servicio

Nuevo archivo: `lib/services/metricas-service.ts`

Recibe el cliente Supabase como parámetro (igual que `rutina-service.ts`) y retorna `ResultadoOperacion<T>`.

### `obtenerMetricasResumen(supabase, userId): ResultadoOperacion<MetricasResumen>`

Una sola función que calcula todas las métricas en paralelo (Promise.all):

1. **Sesiones del mes actual** — `sesiones WHERE user_id = userId AND finalizada_at >= inicio_mes AND finalizada_at < inicio_mes_siguiente`
2. **Sesiones del mes anterior** — mismo filtro con rango anterior
3. **Racha** — obtener todas las sesiones con `finalizada_at IS NOT NULL`, ordenadas por fecha DESC. Iterar semanas hacia atrás contando cuántas consecutivas tienen ≥1 sesión.
4. **Duración promedio** — de las sesiones del mes actual con `iniciada_at IS NOT NULL AND finalizada_at IS NOT NULL`, calcular `avg(finalizada_at - iniciada_at)` en JavaScript (no en SQL) para evitar aritmética de timestamps en Postgres.
5. **% series completadas** — de todas las `sesion_series` pertenecientes a sesiones del mes actual (join con `sesiones`).

> Todas las queries son routine-agnostic (sin filtro por `rutina_id`), para que funcione correctamente cuando el usuario tenga múltiples rutinas en el futuro.

### `obtenerPRsEjercicios(supabase, userId, ejercicioIds: string[]): ResultadoOperacion<PRejercicio[]>`

Dado un array de `ejercicio_id`, retorna el PR de cada uno. La función **no resuelve el nombre** — el caller ya tiene los nombres desde `obtenerEjerciciosRutinaActiva` y los combina en JS.

Firma de `PRejercicio` (simplificada — sin `nombre`):
```ts
export interface PRejercicio {
  ejercicioId: string
  pesoKg: number | null
  repeticiones: number | null
}
```

El `nombre` se mantiene en `MetricasTab` combinando `PRejercicio` con `EjercicioRutinaActiva` por `ejercicioId` antes de pasarlos a `PRsPanel`.

Query:
```sql
SELECT re.ejercicio_id, ss.peso_kg, ss.repeticiones
FROM sesion_series ss
LEFT JOIN rutina_ejercicios re ON ss.rutina_ejercicio_id = re.id
JOIN sesiones s ON ss.sesion_id = s.id
WHERE s.user_id = $userId
  AND re.ejercicio_id = ANY($ejercicioIds)
  AND ss.completada = true
  AND ss.peso_kg IS NOT NULL
  AND ss.repeticiones IS NOT NULL
ORDER BY ss.peso_kg DESC, ss.repeticiones DESC
```

`LEFT JOIN rutina_ejercicios` porque cuando el usuario regenera una rutina, el proceso de generación elimina los `rutina_ejercicios` anteriores ("orphan cleanup" descrito en CLAUDE.md). Las `sesion_series` históricas que apuntan a `rutina_ejercicio_id` ya eliminados retornan `NULL` en `re.ejercicio_id` y son filtradas por `WHERE re.ejercicio_id = ANY(...)`. No se necesita join a `ejercicios` — el nombre viene del caller.

Se agrupa en JS: un PR por `ejercicio_id` (primera fila después del ORDER BY).

**Merge en `MetricasTab`:**
```ts
const prsConNombre = ejerciciosAMostrar.map(ej => {
  const pr = prsData.find(p => p.ejercicioId === ej.ejercicioId)
  return { ...ej, pesoKg: pr?.pesoKg ?? null, repeticiones: pr?.repeticiones ?? null }
})
```

### `obtenerEjerciciosRutinaActiva(supabase, userId): ResultadoOperacion<EjercicioRutinaActiva[]>`

Tipo auxiliar (agregar en `lib/types/database.ts`):

```ts
export interface EjercicioRutinaActiva {
  ejercicioId: string
  nombre: string
  esCompuesto: boolean
  frecuencia: number  // cuántos días de la rutina incluyen este ejercicio
}
```

- Obtiene la rutina más reciente: `rutinas WHERE user_id ORDER BY created_at DESC LIMIT 1`
- Hace join con `rutina_dias → rutina_ejercicios → ejercicios`
- Retorna ejercicios únicos (deduplicados por `ejercicio_id`) con `frecuencia` = cuántos días de la rutina los incluyen
- `esCompuesto = patron_movimiento IN ('push', 'pull', 'rodilla', 'cadera')`
- Si el usuario no tiene ninguna rutina, retorna `{ success: true, data: [] }` — lista vacía sin error

---

## Componentes nuevos

### `app/components/metricas/MetricasTab.tsx`

Componente principal del tab. Recibe `userId: string` y `supabase: SupabaseClient`. Orquesta la carga de datos y renderiza los sub-tabs.

Estado interno:
- `subTab: 'resumen' | 'progreso'`
- `metricas: MetricasResumen | null`
- `prsEjercicios: PRejercicio[]`
- `ejerciciosDisponibles: EjercicioRutinaActiva[]` — para el selector "+"
- `loading: boolean`
- `error: boolean`
- `prsPinned: string[]` — cargado desde `localStorage` al montar

**Caso sin rutina activa:** Si `obtenerEjerciciosRutinaActiva` retorna lista vacía, la sección PRs muestra: "Generá tu primera rutina para ver tus récords personales" con un botón "Ir a rutinas" (`router.push('/rutinas')`). No se muestra el botón "+".

### `app/components/metricas/HeroStat.tsx`

Bloque oscuro con número grande. Props: `count: number`, `comparacion: number` (delta respecto al mes anterior).

### `app/components/metricas/MiniStats.tsx`

Grid de 3 tarjetas. Props: `racha`, `duracionPromedio`, `porcentajeCompletadas`.

### `app/components/metricas/CalendarioMes.tsx`

Calendario del mes actual. Props: `diasEntrenados: string[]` (ISO dates).

Cálculo interno: sabe el año/mes actual, genera la grilla de días con `new Date(year, month, 1).getDay()` para el offset del primer día (convirtiendo de domingo=0 a lunes=0).

### `app/components/metricas/PRsPanel.tsx`

Tarjeta de PRs. Props:
```ts
{
  prs: PRejercicioDisplay[]          // ya combinados con nombre en MetricasTab
  ejerciciosDisponibles: EjercicioRutinaActiva[]  // para el selector "+"
  pinnedIds: string[]
  sinRutina: boolean  // true si no hay rutina activa
  onPinChange: (ids: string[]) => void
}
```

- Si `sinRutina = true`: muestra mensaje y botón "Ir a rutinas" (sin lista ni "+")
- Si `sinRutina = false`: muestra lista de PRs. Cada ejercicio pinned tiene un "×" para quitarlo. El botón "+" solo aparece si `pinnedIds.length < 4` y hay ejercicios disponibles no mostrados.
- El "+" abre/cierra un panel expandible (inline, no modal) con la lista de ejercicios disponibles para agregar.
- Al seleccionar un ejercicio del panel: llama `onPinChange([...pinnedIds, ejercicioId])` y cierra el panel.

---

## Modificaciones en archivos existentes

### `app/entrenamiento/page.tsx`

Refactorizar para soportar tabs:
1. Agregar `useState<'historial' | 'metricas'>` para el tab activo (default `'historial'`)
2. Agregar header de tabs debajo del `<h1>` (dos botones: Historial / Métricas)
3. Renderizar condicionalmente: historial existente o `<MetricasTab />`
4. El botón "+ Entrenar" solo aparece en el tab Historial

El contenido del historial no se modifica en absoluto.

---

## Estrategia de localStorage para PRs pinned

Clave: `gymlogic_pr_pins`
Formato: array JSON de strings (exercise IDs), máximo 4 elementos extra

```ts
// Leer
const stored = localStorage.getItem('gymlogic_pr_pins')
const pinned: string[] = stored ? JSON.parse(stored) : []

// Escribir
localStorage.setItem('gymlogic_pr_pins', JSON.stringify(newPinned))
```

Los IDs defaults (top 4 compuestos por frecuencia) no se guardan en localStorage — se recalculan en cada carga. Los pinned de localStorage son adicionales. Si un pinned ya no existe en la rutina activa (el usuario la regeneró), se ignora silenciosamente.

---

## Estados de carga y error

- Loading: spinner centrado mientras se cargan métricas
- Error: mensaje con botón "Reintentar" (mismo patrón que el historial)
- Sin datos (usuario nuevo sin sesiones): mostrar el hero con `0`, calendario vacío, PRs con `-` por ejercicio
- Sin rutina activa: el bloque de PRs muestra mensaje con CTA a `/rutinas` (ver `PRsPanel.tsx`)

---

## Out of scope (sub-proyecto 2)

- Gráficos de progresión de peso/volumen/reps por ejercicio
- Filtro por rutina o por período
- Navegación entre meses en el calendario
- Exportar datos
