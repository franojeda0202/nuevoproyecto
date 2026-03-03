# Workout Session Logging — Design

**Date:** 2026-03-03

## Goal

Permitir al usuario registrar sesiones de entrenamiento en tiempo real: selecciona el día de su rutina, completa series con peso y reps, y los datos se guardan automáticamente. Base para futura sección de métricas y progreso.

## Scope

**In:** registro de sesión, auto-save por serie, pre-fill desde última sesión, recuperación de sesión en progreso.

**Out:** métricas, progreso, gráficos, historial de sesiones (futuro).

## Base de Datos

### Tabla `sesiones`
```sql
id            uuid primary key default gen_random_uuid()
user_id       uuid references auth.users not null
rutina_id     uuid references rutinas not null
dia_id        uuid references rutina_dias not null
iniciada_at   timestamptz default now()
finalizada_at timestamptz -- null = en progreso
created_at    timestamptz default now()
```

### Tabla `sesion_series`
```sql
id                   uuid primary key default gen_random_uuid()
sesion_id            uuid references sesiones not null
rutina_ejercicio_id  uuid references rutina_ejercicios not null
numero_serie         int not null  -- 1, 2, 3...
peso_kg              decimal(6,2)  -- nullable: usuario puede no poner peso
repeticiones         int           -- nullable
completada           boolean default false
created_at           timestamptz default now()
updated_at           timestamptz default now()
```

### RLS
- `sesiones`: SELECT/INSERT/UPDATE/DELETE scoped a `auth.uid() = user_id`
- `sesion_series`: ALL scoped via `sesion_id IN (SELECT id FROM sesiones WHERE user_id = auth.uid())`

## Flujo

1. Usuario toca "Entrenar" (botón en /rutinas) → navega a `/entrenar`
2. Selecciona el día de su rutina (botones grandes con nombre del día)
3. App crea fila en `sesiones` (finalizada_at = null)
4. App carga ejercicios del día + pre-fill de última sesión por ejercicio
5. Usuario completa series: llena peso/reps, marca ✓
6. Auto-save on blur: upsert en `sesion_series` al salir de cada input
7. "Finalizar" setea `finalizada_at = now()` y vuelve a `/rutinas`
8. Si hay sesión en progreso al abrir `/entrenar`, se retoma automáticamente

## Pre-fill

Para cada `rutina_ejercicio_id` del día, buscar el `peso_kg` y `repeticiones` más recientes de `sesion_series` donde `completada = true`. Mostrar como **placeholder** (texto gris en el input) — no como valor pre-cargado. El usuario escribe encima si cambia el peso.

## UI

**Acceso:** botón "Entrenar" en el header de `/rutinas`.

**`/entrenar` — selección de día:**
- Lista de días de la rutina como botones grandes
- Si hay sesión en progreso: banner "Tenés una sesión en progreso — ¿Continuarla?"

**`/entrenar/[sesionId]` — sesión activa:**
```
DÍA 1 · PECHO Y TRÍCEPS

Press Banca
  Serie 1  [ peso kg ]  [ reps ]  ✓
  Serie 2  [ peso kg ]  [ reps ]  ✓
  Serie 3  [ peso kg ]  [ reps ]  ✓

Fondos
  Serie 1  [ peso kg ]  [ reps ]  ✓
  ...

         [ Finalizar sesión ]
```

- Inputs numéricos optimizados para mobile (type="number", inputMode="decimal")
- Placeholder con datos de última sesión en gris: "80" / "8"
- ✓ marca la serie como completada (toggle, cambia a color amarillo)
- Auto-save on blur: fire-and-forget, sin spinner
- "Finalizar sesión" sticky al fondo de la pantalla

## Arquitectura

- Nueva ruta: `app/entrenar/page.tsx` (selección de día)
- Nueva ruta: `app/entrenar/[sesionId]/page.tsx` (sesión activa)
- Nuevo service: `lib/services/sesion-service.ts`
  - `crearSesion(supabase, { userId, rutinaId, diaId })`
  - `obtenerSesionEnProgreso(supabase, userId)`
  - `obtenerUltimasSeries(supabase, rutinaDiaEjercicioIds[])` — para pre-fill
  - `upsertSerie(supabase, serie)` — auto-save
  - `finalizarSesion(supabase, sesionId)`
- Componente: `app/components/sesion/SerieRow.tsx` — fila de una serie con inputs

## Decisiones de diseño

- **Auto-save on blur** (no on keystroke) — menos writes a la DB, suficiente para no perder datos
- **Placeholder no value** para pre-fill — el usuario siempre parte de inputs vacíos, el dato anterior es referencia visual
- **Recuperación automática** de sesión en progreso — crítico para no perder datos si se cierra la app
- **Sin métricas** en este scope — se construyen después sobre `sesion_series`
