# Exercise Reorder — Design

**Date:** 2026-03-02

## Goal

Permitir al usuario reordenar los ejercicios dentro de cada día de su rutina mediante drag-and-drop (mouse y touch), con guardado automático en la DB.

## Constraints

- Reorder es **por día** — cada día tiene su lista independiente, no se pueden mover ejercicios entre días
- Guardado **automático** al soltar (sin botón de guardar, sin toast)
- Funciona en **mobile (touch) y desktop (mouse)**
- No se revierte el estado local si el guardado en DB falla — el usuario puede reordenar de nuevo

## Approach

**@dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) — librería moderna para React con soporte nativo de touch y mouse.

## Architecture

### Nuevos packages
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities` (para CSS transforms)

### Cambios en service layer
Nueva función en `lib/services/rutina-service.ts`:
```ts
reordenarEjercicios(supabase, ejercicios: { id: string, orden: number }[]): Promise<ResultadoOperacion<null>>
```
Hace upsert de los campos `orden` en `rutina_ejercicios`. Una sola llamada para todos los ejercicios del día.

### Cambios en componentes

**`EjercicioRow.tsx`**
- Agregar prop `isDragging?: boolean` para estilos durante el arrastre
- Agregar handle de arrastre (ícono ≡) como primera columna, con `useSortable` hook
- Mostrar número de orden a la izquierda del handle
- Handle visible solo en hover en desktop; siempre visible en mobile

**`EjercicioRowMobile.tsx`** (mismo archivo)
- Mismo handle de arrastre a la izquierda
- Número de orden visible siempre

**`app/rutinas/page.tsx`**
- Importar `DndContext`, `SortableContext`, `verticalListSortingStrategy` de @dnd-kit
- Cada día tiene su propio `DndContext` + `SortableContext` wrapeando su lista de ejercicios
- `onDragEnd`: reordenar estado local con `arrayMove`, luego llamar `reordenarEjercicios`

## UX Details

- Durante arrastre: fila con `box-shadow` elevado + `opacity: 0.9`
- Handle: ícono de 6 puntos (grip) en color slate-400, cambia a slate-600 en hover
- Número de orden: texto pequeño slate-400 a la izquierda del handle
- Cursor: `grab` en hover, `grabbing` durante arrastre

## Data Flow

```
Usuario arrastra ejercicio
  → onDragEnd fires
  → arrayMove() reordena estado local (inmediato, sin flash)
  → reordenarEjercicios(supabase, ejerciciosConNuevoOrden)
    → upsert orden en rutina_ejercicios
```
