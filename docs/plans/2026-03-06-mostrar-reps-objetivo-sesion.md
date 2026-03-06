# Mostrar Reps Objetivo en Sesión Activa — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrar en cada card de ejercicio durante la sesión activa la cantidad de series y repeticiones objetivo definidas en la rutina (ej: "4 series · 8-12 reps").

**Architecture:** Dos capas: (1) plumbing — agregar `repeticiones` al SELECT de `rutina_ejercicios` en `obtenerSesionActiva` y propagarlo al tipo `EjercicioConSeries`; (2) UI — renderizar el dato como subtítulo debajo del nombre del ejercicio en el card. El campo `repeticiones` en `rutina_ejercicios` es un string (ej: "8-12", "10", "Al fallo") — se muestra tal cual, sin parsear.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase

---

## Contexto importante

- **`rutina_ejercicios.repeticiones`** es un campo `text` — puede ser "10", "8-12", "12-15", "Al fallo". Se pasa como string directo, nunca se parsea.
- **`obtenerSesionActiva`** (línea 182 de `lib/services/sesion-service.ts`) hace un SELECT de `rutina_ejercicios` que actualmente trae `id, series, orden` pero NO `repeticiones`. Esa es la brecha.
- **`EjercicioConSeries`** (línea 211 de `lib/types/database.ts`) ya tiene `series_rutina: number` pero le falta `repeticiones_rutina: string`.
- El mapeo del resultado ocurre en `sesion-service.ts` líneas 238-260: construye el objeto `EjercicioConSeries` que llega al componente.
- El card de ejercicio está en `app/entrenar/[sesionId]/page.tsx` líneas 202-236.

---

## Task 1: Service + Tipos — propagar `repeticiones` de la rutina

**Archivos:**
- Modificar: `lib/services/sesion-service.ts` (líneas 182 y 253-259)
- Modificar: `lib/types/database.ts` (línea 211-217)

### Paso 1: Agregar `repeticiones` al SELECT en `sesion-service.ts`

Línea 182 — cambiar el SELECT de `rutina_ejercicios`:
```ts
// ANTES:
.select('id, series, orden, ejercicios:ejercicio_id(nombre)')

// DESPUÉS:
.select('id, series, repeticiones, orden, ejercicios:ejercicio_id(nombre)')
```

### Paso 2: Incluir `repeticiones_rutina` en el objeto mapeado

Líneas 253-259 — en el `return` dentro del `.map(ej => {...})`:
```ts
// ANTES:
return {
  rutina_ejercicio_id: ej.id,
  nombre,
  series_rutina: ej.series,
  series: ejSeries,
  ultima_serie: prefillMap[ej.id] || null,
}

// DESPUÉS:
return {
  rutina_ejercicio_id: ej.id,
  nombre,
  series_rutina: ej.series,
  repeticiones_rutina: (ej.repeticiones as string | null) ?? '',
  series: ejSeries,
  ultima_serie: prefillMap[ej.id] || null,
}
```

### Paso 3: Agregar `repeticiones_rutina` al tipo `EjercicioConSeries` en `database.ts`

Líneas 211-217 — agregar el campo:
```ts
// ANTES:
export interface EjercicioConSeries {
  rutina_ejercicio_id: string
  nombre: string
  series_rutina: number  // cuántas series tiene programadas en la rutina
  series: SesionSerieEditable[]
  ultima_serie: { peso_kg: number | null; repeticiones: number | null } | null
}

// DESPUÉS:
export interface EjercicioConSeries {
  rutina_ejercicio_id: string
  nombre: string
  series_rutina: number      // cuántas series tiene programadas en la rutina
  repeticiones_rutina: string // reps objetivo de la rutina (ej: "8-12", "10", "Al fallo")
  series: SesionSerieEditable[]
  ultima_serie: { peso_kg: number | null; repeticiones: number | null } | null
}
```

### Paso 4: Verificar build

```bash
npm run build
```
Debe compilar sin errores TypeScript. Si hay error de tipo en el mapeo, es porque `ej.repeticiones` necesita el cast explícito a `string | null`.

### Paso 5: Commit

```bash
git add lib/services/sesion-service.ts lib/types/database.ts
git commit -m "feat: agregar repeticiones_rutina a EjercicioConSeries y al query de sesión activa"
```

---

## Task 2: UI — mostrar "X series · Y reps" en el card de ejercicio

**Archivo:**
- Modificar: `app/entrenar/[sesionId]/page.tsx` (líneas 206-208)

### Contexto del card actual

Actualmente el card empieza con:
```tsx
<div
  key={ej.rutina_ejercicio_id}
  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
>
  <h3 className="font-bold text-slate-900 mb-3">{ej.nombre}</h3>

  {/* Headers de columnas */}
  <div className="flex items-center gap-2 px-3 mb-2">
```

### Paso 1: Modificar el header del card

Reemplazar el `<h3>` y agregar el subtítulo de objetivo:

```tsx
// ANTES:
<h3 className="font-bold text-slate-900 mb-3">{ej.nombre}</h3>

// DESPUÉS:
<div className="flex items-center justify-between mb-3">
  <h3 className="font-bold text-slate-900">{ej.nombre}</h3>
  <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg flex-shrink-0">
    {ej.series_rutina} × {ej.repeticiones_rutina}
  </span>
</div>
```

**Resultado visual:**
```
┌─────────────────────────────────────────┐
│  Press de Banca          [4 × 8-12]     │
│  ─────────────────────────────────────  │
│  #    Peso      Reps                    │
│  1   [______]  [____]  ○                │
│  2   [______]  [____]  ○                │
│  3   [______]  [____]  ○                │
│  4   [______]  [____]  ○                │
└─────────────────────────────────────────┘
```

El badge está alineado a la derecha del nombre, es compacto y no interfiere con las columnas.

**Notas de diseño:**
- `flex-shrink-0` en el badge evita que se comprima cuando el nombre del ejercicio es largo.
- No se agrega `truncate` al h3 para no perder el nombre completo — si el nombre es muy largo se wrappea, lo cual está bien en mobile.
- Si `repeticiones_rutina` es `''` (vacío, caso defensivo), el badge muestra "4 × " lo cual es raro pero no rompe la UI. En la práctica siempre tiene valor porque el form de onboarding lo requiere.

### Paso 2: Verificar build

```bash
npm run build
```
Sin errores TypeScript.

### Paso 3: Commit

```bash
git add app/entrenar/[sesionId]/page.tsx
git commit -m "feat: mostrar series y reps objetivo de la rutina en cada card de ejercicio"
```

---

## Verificación manual

1. Abrir `/entrenar` → seleccionar un día → iniciar sesión
2. En cada card de ejercicio verificar que aparece el badge `[X × Y]` en la esquina superior derecha del nombre
3. El badge muestra el valor tal cual está en la rutina (ej: "4 × 8-12", "3 × 10", "3 × Al fallo")
4. El nombre del ejercicio no queda truncado en mobile con el badge al lado
5. El resto del comportamiento (inputs, auto-save, checkbox, finalizar) no cambió
