# Responsive Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar el scroll horizontal en mobile en todas las páginas de la app.

**Architecture:** Tres capas de fix: (1) safety net en AppLayout, (2) títulos h1 que desbordan en pantallas < 390px por Bebas Neue + tracking-widest + pl-14, (3) SerieRow con widths fijos que no caben en 360px. También un bug residual de supabase sin useMemo en entrenar/page.tsx.

**Tech Stack:** Next.js, Tailwind CSS v4, Bebas Neue (font-display)

---

## Contexto importante

- **Hamburger button**: `fixed top-4 left-4 w-10` = 40px ancho, en x=16px. Total offset = 56px. Por eso los h1 tienen `pl-14 md:pl-0` (pl-14 = 56px) para no quedar detrás del botón.
- **Bebas Neue es condensada pero con `tracking-widest`** (0.1em extra por carácter a 3rem) = ~4.8px extra por char. "Entrenamientos" (14 chars) a text-5xl: ~14×24px + 14×4.8px = 336 + 67 = 403px. Con pl-14 (56px): 459px en pantalla de 375px → overflow.
- **SerieRow**: w-5 + w-20 + "kg"(~14px) + w-16 + "reps"(~25px) + w-8 + gaps + padding = ~299px. En 360px screen: 360−32(page)−32(card) = 296px → overflow por 3px.
- **No hay tests automatizados** — verificar con `npm run build`.

---

## Task 1: AppLayout — safety net de overflow

**Archivo:** `app/components/AppLayout.tsx`

**Por qué es un bug:** El div raíz `min-h-screen flex` no tiene `overflow-x-hidden`. Cualquier overflow de hijos se propaga al nivel del browser y genera scroll horizontal. El div de contenido `flex-1 md:ml-64` no tiene `min-w-0`, lo que permite que un hijo flex desborde su contenedor.

**Cambio 1** — outer div (línea 70):
```tsx
// ANTES:
<div className="min-h-screen flex">

// DESPUÉS:
<div className="min-h-screen flex overflow-x-hidden">
```

**Cambio 2** — content div (línea 132):
```tsx
// ANTES:
<div className="flex-1 md:ml-64">

// DESPUÉS:
<div className="flex-1 md:ml-64 min-w-0">
```

**Verificar:** `npm run build` sin errores.

**Commit:**
```bash
git add app/components/AppLayout.tsx
git commit -m "fix: agregar overflow-x-hidden y min-w-0 en AppLayout para prevenir scroll horizontal"
```

---

## Task 2: Títulos h1 — reducir tamaño mobile

**Archivos:**
- `app/rutinas/page.tsx` (línea 414)
- `app/entrenamiento/page.tsx` (línea 106)
- `app/entrenar/page.tsx` (línea 85)

**Por qué es un bug:** `text-5xl` (3rem) con `tracking-widest` y `pl-14` en mobile hace que palabras largas como "Entrenamientos" desborden en pantallas ≤ 375px. Las páginas que NO tienen este problema (`entrenar/[sesionId]`, `entrenamiento/[sesionId]`) ya usan `text-4xl` en mobile. Hay que llevar `text-5xl` → `text-3xl` en mobile (2xl es 1.875rem; con Bebas Neue condensada más tracking-widest, "Entrenamientos" + pl-14 entra en 375px).

### rutinas/page.tsx

**Cambio 1** — h1 "Mi Rutina Activa" (línea 414):
```tsx
// ANTES:
<h1 className="pl-14 md:pl-0 text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">

// DESPUÉS:
<h1 className="pl-14 md:pl-0 text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
```

**Cambio 2** — inner card padding (línea 530):
```tsx
// ANTES:
<div className="p-6 space-y-8">

// DESPUÉS:
<div className="p-4 md:p-6 space-y-8">
```
> Esto da 8px más de espacio horizontal en mobile para los EjercicioRowMobile.

### entrenamiento/page.tsx

**Cambio** — h1 "Entrenamientos" (línea 106):
```tsx
// ANTES:
<h1 className="text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">

// DESPUÉS:
<h1 className="text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1 pl-14 md:pl-0">
```

### entrenar/page.tsx

**Cambio** — h1 "Entrenar" (línea 85):
```tsx
// ANTES:
<h1 className="pl-14 md:pl-0 text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">

// DESPUÉS:
<h1 className="pl-14 md:pl-0 text-3xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
```

**Verificar:** `npm run build` sin errores.

**Commit:**
```bash
git add app/rutinas/page.tsx app/entrenamiento/page.tsx app/entrenar/page.tsx
git commit -m "fix: reducir tamaño de títulos h1 en mobile para evitar overflow con pl-14"
```

---

## Task 3: SerieRow — eliminar labels redundantes + fix supabase

### 3a. SerieRow: eliminar "kg" y "reps" inline

**Archivo:** `app/components/sesion/SerieRow.tsx`

**Por qué es un bug:** El row tiene: `w-5(20) + gap(8) + w-20(80) + "kg"(14px) + gap(8) + w-16(64) + "reps"(25px) + gap(8) + w-8(32) + px-3(24) = 299px`. En pantallas de 360px el espacio disponible es 296px → overflow por 3px. Las labels "kg" y "reps" son redundantes porque los headers de columna ya dicen "Peso" y "Reps".

**Eliminar línea del label "kg"** (entre el input peso y el input reps):
```tsx
// ELIMINAR esta línea completa:
<span className="text-xs text-slate-400 flex-shrink-0">kg</span>
```

**Eliminar línea del label "reps"** (después del input reps):
```tsx
// ELIMINAR esta línea completa:
<span className="text-xs text-slate-400 flex-shrink-0">reps</span>
```

Resultado: `w-5 + w-20 + w-16 + w-8 + gaps(3×8) + px-3(24) = 196px`. Cómodo en cualquier pantalla.

### 3b. entrenar/page.tsx: memoizar supabase

**Archivo:** `app/entrenar/page.tsx`

**Por qué es un bug:** `const supabase = createClient()` sin `useMemo` en línea 24 crea un nuevo cliente en cada render. Igual al bug corregido en las otras 4 páginas (ver commits ba0b371 y 3d5b84f).

**Cambio 1** — import (línea 1):
```tsx
// ANTES:
import { useState, useEffect } from 'react'

// DESPUÉS:
import { useState, useEffect, useMemo } from 'react'
```

**Cambio 2** — línea 24:
```tsx
// ANTES:
const supabase = createClient()

// DESPUÉS:
const supabase = useMemo(() => createClient(), [])
```

**Verificar:** `npm run build` sin errores.

**Commit:**
```bash
git add app/components/sesion/SerieRow.tsx app/entrenar/page.tsx
git commit -m "fix: eliminar labels redundantes en SerieRow y memoizar supabase en entrenar/page"
```

---

## Verificación manual (3 pantallas)

Después de los 3 commits, abrir en DevTools con:
- **360px** (Galaxy S8/S9 — pantalla más estrecha común)
- **375px** (iPhone SE/12 mini)
- **390px** (iPhone 14)

Páginas a revisar:
1. `/rutinas` — título "Mi Rutina Activa" no desborda; cards de ejercicios sin scroll horizontal
2. `/entrenamiento` — título "Entrenamientos" no desborda
3. `/entrenar` — título "Entrenar" no desborda
4. `/entrenar/[sesionId]` — SerieRow entra sin scroll en tarjetas de ejercicio
