# Mejora del Cerebro de Generación de Rutinas — Design Spec

## Objetivo

Expandir el formulario de onboarding y la lógica de generación de rutinas para producir programas más personalizados. Agregar perfil persistente del usuario en Supabase. Reemplazar los campos actuales (location, gender como dropdown inglés) con una experiencia unificada de pill buttons y 5 campos nuevos que el modelo de IA utiliza para adaptar objetivo, volumen, intensidad y selección de ejercicios.

## Arquitectura

### Componentes afectados

| Archivo | Cambio |
|---|---|
| `lib/types/database.ts` | Reemplazar `OnboardingConfig` + `GenerarRutinaRequest`. Nuevo tipo `PerfilUsuario`. |
| `lib/services/perfil-service.ts` | Nuevo servicio (obtener + guardar perfil) |
| `app/components/OnboardingForm.tsx` | Rediseño completo — pill buttons, campos nuevos, pre-carga perfil |
| `app/rutinas/page.tsx` | Actualizar llamada a `onSubmit` (renombra campos de inglés a español) |
| `app/api/generar-rutina/route.ts` | Nuevo body shape, nuevos `VALORES_VALIDOS`, nuevo `buildUserPrompt` |
| `lib/prompts/system-prompt-rutina.txt` | Instrucciones por objetivo/nivel/equipamiento/duración/género |
| Supabase (migración manual) | Nueva tabla `perfiles` |

### Flujo de datos

```
Usuario abre formulario
  → obtenerPerfil() → pre-rellena campos (o defaults si es primera vez)
  → loading state mientras fetch → campos deshabilitados + spinner pequeño en el header
  → Usuario ajusta valores y hace submit
  → guardarPerfil() — si falla, mostrar error y NO continuar
  → POST /api/generar-rutina con body plano (sin wrapper config)
  → API valida, construye prompt con bloque PERFIL, llama a OpenAI
  → Redirect a /rutinas
```

---

## Base de datos

### Tabla `perfiles`

```sql
CREATE TABLE perfiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo         TEXT NOT NULL,         -- 'musculo' | 'fitness' | 'fuerza'
  nivel            TEXT NOT NULL,         -- 'principiante' | 'intermedio' | 'avanzado'
  equipamiento     TEXT NOT NULL,         -- 'bodyweight' | 'mancuernas' | 'barras' | 'gym_completo'
  duracion_minutos INTEGER NOT NULL,      -- 30 | 45 | 60 | 90
  genero           TEXT,                  -- 'masculino' | 'femenino' | NULL
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

**Nota sobre `updated_at`:** No definir trigger. El servicio `guardarPerfil` pasará `updated_at: new Date().toISOString()` explícitamente en cada upsert.

### RLS (configurar manualmente en Supabase Dashboard)

```sql
-- Habilitar RLS
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "usuario ve su perfil" ON perfiles
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT (también cubre el path de upsert para filas nuevas)
CREATE POLICY "usuario crea su perfil" ON perfiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE (cubre el path de upsert para filas existentes)
CREATE POLICY "usuario actualiza su perfil" ON perfiles
  FOR UPDATE USING (auth.uid() = user_id);
```

**Nota RLS upsert:** Supabase `upsert` con `onConflict` ejecuta INSERT para filas nuevas y UPDATE para existentes. Las políticas INSERT + UPDATE cubren ambos paths correctamente.

---

## Tipos (`lib/types/database.ts`)

### Reemplazar `OnboardingConfig` y `GenerarRutinaRequest`

Los tipos actuales `OnboardingConfig` y `GenerarRutinaRequest` se **eliminan** y se reemplazan por:

```ts
// Perfil del usuario (espeja la tabla `perfiles`)
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
  diasSemana: number               // 2–6
  objetivo: PerfilUsuario['objetivo']
  nivel: PerfilUsuario['nivel']
  equipamiento: PerfilUsuario['equipamiento']
  duracionMinutos: PerfilUsuario['duracionMinutos']
  focoMuscular: string             // siempre presente; '' cuando no hay preferencia
  genero: PerfilUsuario['genero']  // null si no especificado
}
// Nota: focoMuscular es siempre string (nunca undefined). El form siempre envía '' como mínimo.
```

---

## Capa de servicios (`lib/services/perfil-service.ts`)

```ts
import { SupabaseClient } from '@supabase/supabase-js'
import { ResultadoOperacion, PerfilUsuario } from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

// Obtener perfil del usuario. Retorna null si no existe aún (primera vez).
export async function obtenerPerfil(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<PerfilUsuario | null>>

// Guardar o actualizar perfil (upsert).
// Incluye updated_at explícito en el payload.
export async function guardarPerfil(
  supabase: SupabaseClient,
  userId: string,
  datos: PerfilUsuario
): Promise<ResultadoOperacion<PerfilUsuario>>
```

### Mapeo camelCase ↔ snake_case

`PerfilUsuario` usa camelCase; la tabla usa snake_case. El servicio mapea explícitamente:

**Al escribir (guardarPerfil):**
```ts
{
  user_id: userId,
  objetivo: datos.objetivo,
  nivel: datos.nivel,
  equipamiento: datos.equipamiento,
  duracion_minutos: datos.duracionMinutos,   // camelCase → snake_case
  genero: datos.genero,
  updated_at: new Date().toISOString(),
}
```

**Al leer (obtenerPerfil):**
```ts
{
  objetivo: row.objetivo,
  nivel: row.nivel,
  equipamiento: row.equipamiento,
  duracionMinutos: row.duracion_minutos,     // snake_case → camelCase
  genero: row.genero ?? null,
}
```

---

## Formulario de onboarding (`app/components/OnboardingForm.tsx`)

### Tipo interno

```ts
interface OnboardingData {
  diasSemana: number
  objetivo: 'musculo' | 'fitness' | 'fuerza'
  nivel: 'principiante' | 'intermedio' | 'avanzado'
  equipamiento: 'bodyweight' | 'mancuernas' | 'barras' | 'gym_completo'
  duracionMinutos: 30 | 45 | 60 | 90
  focoMuscular: string
  genero: 'masculino' | 'femenino' | null
}
```

El tipo exportado `OnboardingData` reemplaza el anterior. La prop `onSubmit` recibe `OnboardingData`.

### Campos y opciones — todos pill buttons

| Campo | Opciones (valor interno) | Requerido | Default |
|---|---|---|---|
| Días por semana | `2` `3` `4` `5` `6` | ✅ | `3` |
| Objetivo | `musculo` `fitness` `fuerza` | ✅ | `musculo` |
| Nivel | `principiante` `intermedio` `avanzado` | ✅ | `principiante` |
| Equipamiento | `bodyweight` `mancuernas` `barras` `gym_completo` | ✅ | `gym_completo` |
| Duración | `30` `45` `60` `90` (minutos) | ✅ | `60` |
| Foco muscular | `''` `pecho` `espalda` `hombros` `brazos` `piernas` `gluteos` `core` `full_body` | ❌ | `''` |
| Género | `masculino` `femenino` `null` | ❌ | `null` |

**Eliminado:** el campo `location` (gym/home) se elimina por completo. Reemplazado por `equipamiento`.

### Campo género — tratamiento especial

- Tres pills: "Masculino" (`'masculino'`), "Femenino" (`'femenino'`), "Prefiero no decir" (`null`)
- "Prefiero no decir" se muestra como pill activo cuando `genero === null`
- Al cargar el formulario sin perfil guardado, `genero` es `null` → "Prefiero no decir" aparece seleccionado por default
- Debajo de los tres pills, texto informativo **siempre visible**:

```
¿Por qué te preguntamos esto?
• La ciencia indica que las diferencias programáticas son menores de lo que se cree
• Las mujeres toleran más volumen (más series por sesión) y se recuperan más rápido entre series
• Las mujeres responden bien a rep ranges más altos (12–20 reps)
• Ambos sexos ganan músculo con los mismos movimientos — la diferencia es de preferencia y punto de partida
• En la práctica, el enfoque femenino suele ser más en tren inferior/glúteos; el masculino en tren superior
```

### Estado de carga del perfil

- Al montar, `obtenerPerfil()` se llama y el form entra en estado `cargando = true`
- Mientras `cargando`: todos los pill buttons aparecen deshabilitados (opacity-50, pointer-events-none) y un spinner pequeño aparece en el header del formulario
- Si `obtenerPerfil` falla (error de red u otro): ignorar silenciosamente, usar defaults del campo. El usuario puede editar normalmente.
- Una vez resuelto (éxito o fallo): `cargando = false`, formulario habilitado

### Submit — orden de operaciones

1. Validar formulario (campos requeridos)
2. Llamar `guardarPerfil(supabase, userId, { objetivo, nivel, equipamiento, duracionMinutos, genero })`
3. Si `guardarPerfil` falla: mostrar error al usuario (`"No se pudo guardar tu perfil. Intenta de nuevo."`) y **NO continuar**
4. Si éxito: llamar `onSubmit(formData)` → el parent llama a la API

### Resumen de configuración (badges)

Todos los campos activos se muestran como badges. Colores:
- Campos requeridos activos: `bg-yellow-100 text-yellow-700`
- Campos opcionales con valor: `bg-slate-100 text-slate-700`
- Sin colores green, blue ni otros fuera del design system

### Cambios en el componente padre (`app/rutinas/page.tsx`)

El tipo `OnboardingData` es exportado desde `OnboardingForm.tsx`. El padre (`app/rutinas/page.tsx`) lo importa:
```ts
import OnboardingForm, { type OnboardingData } from '@/app/components/OnboardingForm'
```
Al actualizar `OnboardingForm.tsx`, el tipo `OnboardingData` exportado cambia — el padre hereda el cambio automáticamente via TypeScript. Actualizar la función `handleSubmit` del padre para leer `diasSemana` (antes `daysPerWeek`), `focoMuscular` (antes `muscleFocus`), y los campos nuevos. El body del POST a `/api/generar-rutina` pasa todos los campos planos sin wrapper `config`.

---

## API `/api/generar-rutina`

### Importaciones a actualizar

- Reemplazar `import { GenerarRutinaRequest } from '@/lib/types/database'` con el nuevo tipo actualizado

### `VALORES_VALIDOS` (reemplazo completo)

```ts
const VALORES_VALIDOS = {
  objetivo: ['musculo', 'fitness', 'fuerza'] as const,
  nivel: ['principiante', 'intermedio', 'avanzado'] as const,
  equipamiento: ['bodyweight', 'mancuernas', 'barras', 'gym_completo'] as const,
  duracionMinutos: [30, 45, 60, 90] as const,
  genero: ['masculino', 'femenino'] as const,          // null también válido (no especificado)
  focoMuscular: ['', 'pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'gluteos', 'core', 'full_body'] as const,
  diasSemana: { min: 2, max: 6 },
}
```

### `validarConfig` (reemplazo)

```ts
function validarRequest(body: GenerarRutinaRequest): boolean {
  if (
    typeof body.diasSemana !== 'number' ||
    body.diasSemana < VALORES_VALIDOS.diasSemana.min ||
    body.diasSemana > VALORES_VALIDOS.diasSemana.max
  ) return false
  if (!VALORES_VALIDOS.objetivo.includes(body.objetivo)) return false
  if (!VALORES_VALIDOS.nivel.includes(body.nivel)) return false
  if (!VALORES_VALIDOS.equipamiento.includes(body.equipamiento)) return false
  if (!VALORES_VALIDOS.duracionMinutos.includes(body.duracionMinutos)) return false
  if (body.genero !== null && body.genero !== undefined &&
      !VALORES_VALIDOS.genero.includes(body.genero)) return false
  if (body.focoMuscular !== undefined &&
      !VALORES_VALIDOS.focoMuscular.includes(body.focoMuscular as typeof VALORES_VALIDOS.focoMuscular[number])) return false
  return true
}
```

### Body parsing (reemplazo del wrapper `config`)

```ts
// Antes: const config = body?.config
// Ahora: leer campos planos directamente del body
const { diasSemana, objetivo, nivel, equipamiento, duracionMinutos, focoMuscular, genero } = body
```

### `buildUserPrompt` (reemplazo)

Reemplazar el bloque `CONFIGURACIÓN: ${JSON.stringify(config)}` con el bloque PERFIL estructurado:

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

### INSERT en `rutinas` — campo `frecuencia`

El INSERT a la tabla `rutinas` usa `config.frecuencia`; reemplazar por `req.diasSemana`.

---

## Prompt del sistema (`lib/prompts/system-prompt-rutina.txt`)

### Secciones existentes a modificar

El archivo actual tiene estas secciones. Indicamos qué hacer con cada una:

| Sección actual | Acción |
|---|---|
| `## BASE CIENTÍFICA` | **Mantener sin cambios** |
| `## DISTRIBUCIÓN SEMANAL` | **Mantener sin cambios** |
| `## VOLUMEN Y SERIES` | **Eliminar completa** — reemplazada por las reglas de nivel y duración del nuevo `## PERFIL DEL USUARIO` |
| `## FOCO MUSCULAR` | **Mantener sin cambios** |
| `## EQUIPAMIENTO` | **Eliminar completa** — reemplazada por las reglas de equipamiento del nuevo `## PERFIL DEL USUARIO` |
| `## NOTAS DEL COACH` | **Mantener sin cambios** |
| `## REGLAS DE IDs` | **Mantener sin cambios** |
| `## FORMATO DE SALIDA` | **Mantener sin cambios** |

Agregar la nueva sección **`## PERFIL DEL USUARIO`** después de `## DISTRIBUCIÓN SEMANAL` y antes de `## FOCO MUSCULAR`, con las reglas detalladas a continuación.

### Reglas por objetivo

**objetivo = musculo (hipertrofia)**
- Ejercicios compuestos principales (press, remo, sentadilla, peso muerto): 3–4 series de 6–8 reps, carga alta, RIR 2–3
- Ejercicios accesorios e aislamiento: 3 series de 10–12 reps, RIR 1–2
- Combinar ambos rangos en cada sesión

**objetivo = fitness (fitness general)**
- Rep range: 12–15 reps en todos los ejercicios
- Priorizar variedad de patrones de movimiento (push, pull, hinge, squat, core)
- Incluir al menos un ejercicio de core por sesión

**objetivo = fuerza**
- Priorizar squat con barra, bench press, peso muerto, press militar
- 3–5 reps por serie, RIR 2–3 en compuestos
- Descansos largos (2–5 min entre series pesadas)
- Limitar accesorios a 2–3 ejercicios de soporte

### Reglas por nivel — cantidad de ejercicios y series

**Prioridad:** cuando `nivel` y `duracion` dan rangos distintos, el rango de `nivel` define el máximo de ejercicios; el rango de `duracion` define el total de series. Usar siempre el mínimo de ambos como techo.

| Nivel | Ejercicios/día | Series totales/sesión |
|---|---|---|
| principiante | 3–4 | 12–16 |
| intermedio | 4–5 | 16–20 |
| avanzado | 5–6 | 20–25 |

Reglas adicionales por nivel:

**principiante**
- Solo movimientos compuestos básicos con baja demanda técnica
- Sin ejercicios olímpicos ni variaciones complejas (snatch, clean, etc.)

**avanzado**
- Puede incluir variaciones técnicas avanzadas
- Puede incluir intensification techniques (cluster sets, myo-reps) en la nota del coach

### Reglas por duración — series por ejercicio

| Duración | Series por ejercicio |
|---|---|
| 30 min | 2–3 series |
| 45 min | 3 series |
| 60 min | 3–4 series |
| 90 min | 4–5 series |

La cantidad de ejercicios por día viene del nivel (tabla arriba). Las series por ejercicio vienen de la duración.

### Reglas por equipamiento

**bodyweight**
- Solo ejercicios sin equipamiento: push-ups y variantes, sentadillas, estocadas, dominadas (si hay barra), dips, plank, core
- Progresión por variante de dificultad

**mancuernas**
- Sin barras olímpicas, sin máquinas de cable, sin máquinas de palanca
- Ejercicios con mancuernas y peso corporal únicamente

**barras**
- Barras olímpicas, rack, mancuernas disponibles
- Sin máquinas de cable ni máquinas de palanca
- Incluir squat con barra, bench press, peso muerto, press militar como compuestos principales

**gym_completo**
- Todos los ejercicios disponibles en la lista
- Para nivel principiante: priorizar máquinas (mayor seguridad y control)

### Reglas por género

**masculino**
- Distribución equilibrada con ligero sesgo hacia tren superior (pecho, espalda, hombros)

**femenino**
- Aumentar volumen en tren inferior: glúteos, isquiotibiales, cuádriceps
- Priorizar: hip thrust, peso muerto rumano, sentadilla búlgara, abducción de cadera
- Rep ranges en el extremo alto del rango del objetivo

**no especificado**
- Distribución balanceada sin sesgo

---

## Checklist de implementación

- [ ] Migración manual en Supabase: crear tabla `perfiles` + RLS (4 políticas)
- [ ] `lib/types/database.ts`: eliminar `OnboardingConfig`, reemplazar `GenerarRutinaRequest`, agregar `PerfilUsuario`
- [ ] `lib/services/perfil-service.ts`: crear servicio con `obtenerPerfil` + `guardarPerfil`
- [ ] `app/components/OnboardingForm.tsx`: rediseño completo
- [ ] `app/rutinas/page.tsx`: actualizar handler del submit (nuevos nombres de campos)
- [ ] `app/api/generar-rutina/route.ts`: nuevo `VALORES_VALIDOS`, nuevo `validarRequest`, nuevo `buildUserPrompt`, leer body plano
- [ ] `lib/prompts/system-prompt-rutina.txt`: reemplazar sección EQUIPAMIENTO, agregar sección PERFIL DEL USUARIO
- [ ] Verificar manualmente: generar rutinas con distintas combinaciones de perfil

## Notas finales

- No hay tests automatizados en este proyecto. Validar manualmente.
- `perfil-service.ts` sigue el patrón del servicio existente: supabase client como primer parámetro, retorna `ResultadoOperacion<T>`.
- El `user_id` del perfil en la API se toma de la sesión autenticada (mismo patrón que el resto del route), no del body.
