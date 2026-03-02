# Exercise Reorder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir al usuario reordenar ejercicios dentro de cada día de su rutina mediante drag-and-drop (mouse + touch), con guardado automático en la DB.

**Architecture:** Tres tareas independientes. Task 1 instala @dnd-kit y agrega `reordenarEjercicios` al service layer. Task 2 modifica `EjercicioRow.tsx` para que ambas versiones (desktop y mobile) sean sortable items con handle de arrastre y número de orden. Task 3 agrega el `DndContext` por día en `rutinas/page.tsx` y conecta el `onDragEnd`. El campo `orden` ya existe en la DB y en el service layer.

**Tech Stack:** Next.js 16 App Router, @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities, Tailwind CSS v4, Supabase

---

### Task 1: Instalar @dnd-kit y agregar reordenarEjercicios al service

**Files:**
- Modify: `lib/services/rutina-service.ts` (agregar función al final)

**Step 1: Instalar los packages**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: se agregan 3 packages a `package.json` y `package-lock.json`.

**Step 2: Verificar que TypeScript los reconoce**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores relacionados a @dnd-kit.

**Step 3: Agregar `reordenarEjercicios` al final de `lib/services/rutina-service.ts`**

Agregar justo antes del final del archivo (después de `obtenerSiguienteOrden`):

```ts
/**
 * Reordenar ejercicios de un día
 * Actualiza el campo orden de cada ejercicio en paralelo
 */
export async function reordenarEjercicios(
  supabase: SupabaseClient,
  ejercicios: { id: string; orden: number }[]
): Promise<ResultadoOperacion<null>> {
  try {
    await Promise.all(
      ejercicios.map(({ id, orden }) =>
        supabase
          .from('rutina_ejercicios')
          .update({ orden })
          .eq('id', id)
      )
    )
    return { success: true, data: null }
  } catch (err) {
    console.error('Error reordenando ejercicios:', err)
    return { success: false, error: 'Error al guardar el orden' }
  }
}
```

**Step 4: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -10
```

Expected: build exitoso.

**Step 5: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add package.json package-lock.json lib/services/rutina-service.ts
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: instalar dnd-kit y agregar reordenarEjercicios al service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Modificar EjercicioRow para ser sortable items

**Files:**
- Modify: `app/components/rutina/EjercicioRow.tsx`

**Context:** El archivo tiene dos componentes exportados: `EjercicioRow` (default, para tabla desktop con `<tr>`) y `EjercicioRowMobile` (named export, para cards mobile con `<div>`). Ambos deben ser convertidos a sortable items con `useSortable` de @dnd-kit.

La interfaz actual es:
```tsx
interface EjercicioRowProps {
  ejercicio: EjercicioEditable
  onEdit: (ejercicio: EjercicioEditable) => void
  onDelete: (ejercicio: EjercicioEditable) => void
  isDeleting?: boolean
}
```

**Step 1: Reemplazar el contenido completo del archivo**

Reemplazar TODO el archivo con:

```tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EjercicioEditable } from '@/lib/types/database'

interface EjercicioRowProps {
  ejercicio: EjercicioEditable
  index: number
  onEdit: (ejercicio: EjercicioEditable) => void
  onDelete: (ejercicio: EjercicioEditable) => void
  isDeleting?: boolean
}

// Ícono de grip (6 puntos) para el handle de arrastre
function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  )
}

export default function EjercicioRow({
  ejercicio,
  index,
  onEdit,
  onDelete,
  isDeleting = false
}: EjercicioRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ejercicio.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors ${
        isDeleting ? 'opacity-50 pointer-events-none' : ''
      } ${isDragging ? 'opacity-60 shadow-lg bg-white relative z-10' : ''}`}
    >
      {/* Handle de arrastre + número */}
      <td className="pl-4 pr-2 py-3 w-10">
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
            title="Arrastrar para reordenar"
            tabIndex={-1}
          >
            <GripIcon className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 w-3 text-right select-none">{index}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{ejercicio.ejercicio.nombre}</p>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="font-semibold text-gray-900">{ejercicio.series}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-gray-700">{ejercicio.repeticiones}</span>
      </td>
      <td className="px-4 py-3">
        {ejercicio.notas_coach ? (
          <p className="text-sm text-gray-600 truncate max-w-[200px]" title={ejercicio.notas_coach}>
            {ejercicio.notas_coach}
          </p>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(ejercicio)}
            className="p-2 text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all duration-200"
            title="Editar ejercicio"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(ejercicio)}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
            title="Eliminar ejercicio"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// Versión compacta para móviles
export function EjercicioRowMobile({
  ejercicio,
  index,
  onEdit,
  onDelete,
  isDeleting = false
}: EjercicioRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ejercicio.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border border-slate-200 p-4 ${
        isDeleting ? 'opacity-50 pointer-events-none' : ''
      } ${isDragging ? 'opacity-60 shadow-xl border-slate-300 z-10' : ''}`}
    >
      <div className="flex justify-between items-start gap-3">
        {/* Handle + número + nombre */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            title="Arrastrar para reordenar"
            tabIndex={-1}
          >
            <GripIcon className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 select-none flex-shrink-0">{index}.</span>
          <p className="font-semibold text-gray-900 truncate">{ejercicio.ejercicio.nombre}</p>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(ejercicio)}
            className="p-2 text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(ejercicio)}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm pl-7">
        <div>
          <span className="text-gray-500">Series:</span>
          <span className="ml-1 font-semibold text-gray-900">{ejercicio.series}</span>
        </div>
        <div>
          <span className="text-gray-500">Reps:</span>
          <span className="ml-1 font-semibold text-gray-900">{ejercicio.repeticiones}</span>
        </div>
      </div>

      {ejercicio.notas_coach && (
        <p className="mt-2 text-sm text-gray-600 bg-slate-50 rounded-lg px-3 py-2 flex items-start gap-1.5 ml-7">
          <svg className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {ejercicio.notas_coach}
        </p>
      )}
    </div>
  )
}
```

**Step 2: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: build exitoso. Si hay error TypeScript sobre `index` prop faltante en `rutinas/page.tsx`, es esperado — se resuelve en Task 3.

**Step 3: Self-review**

- `useSortable({ id: ejercicio.id })` — usa el UUID del ejercicio como ID de sortable
- `touch-none` en el handle — necesario para que @dnd-kit capture el touch sin que el browser lo intercepte
- `GripIcon` — SVG inline de 6 puntos, compartido entre ambos componentes
- `index` prop (1-based) — se muestra como número de orden visible
- `isDragging` — agrega opacidad y sombra a la fila durante el arrastre

**Step 4: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/components/rutina/EjercicioRow.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: EjercicioRow con drag handle, número de orden y useSortable

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Agregar DndContext por día en rutinas/page.tsx

**Files:**
- Modify: `app/rutinas/page.tsx`

**Context:** El archivo ya importa desde `@/lib/services/rutina-service`. Hay que agregar los imports de @dnd-kit, importar `reordenarEjercicios`, crear `sensors`, crear `handleDragEnd`, y envolver cada lista de ejercicios en `DndContext` + `SortableContext`. También hay que agregar el prop `index` a `EjercicioRow` y `EjercicioRowMobile`, y agregar un `<th>` vacío en la tabla desktop para la columna del handle.

**Step 1: Agregar imports de @dnd-kit al inicio del archivo**

Buscar la línea de imports existentes (alrededor de línea 1-20) y agregar después del último import:

```tsx
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
```

**Step 2: Agregar import de `reordenarEjercicios`**

Buscar la línea que importa desde `@/lib/services/rutina-service`:

```tsx
import {
  obtenerRutinaEditable,
  actualizarEjercicio,
  eliminarEjercicio,
  agregarEjercicio,
  obtenerSiguienteOrden
} from '@/lib/services/rutina-service'
```

Reemplazar con:

```tsx
import {
  obtenerRutinaEditable,
  actualizarEjercicio,
  eliminarEjercicio,
  agregarEjercicio,
  obtenerSiguienteOrden,
  reordenarEjercicios,
} from '@/lib/services/rutina-service'
```

**Step 3: Agregar `sensors` y `handleDragEnd` dentro del componente**

Buscar la línea `const supabase = createClient()` (alrededor de línea 50) y agregar después:

```tsx
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent, diaId: string) => {
    const { active, over } = event
    if (!over || active.id === over.id || !rutinaData) return

    setRutinaData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        dias: prev.dias.map(dia => {
          if (dia.id !== diaId) return dia
          const oldIndex = dia.ejercicios.findIndex(e => e.id === active.id)
          const newIndex = dia.ejercicios.findIndex(e => e.id === over.id)
          const reordenados = arrayMove(dia.ejercicios, oldIndex, newIndex)
            .map((ej, idx) => ({ ...ej, orden: idx + 1 }))
          // Fire-and-forget: guardar en DB sin bloquear la UI
          reordenarEjercicios(supabase, reordenados.map(e => ({ id: e.id, orden: e.orden })))
          return { ...dia, ejercicios: reordenados }
        }),
      }
    })
  }
```

**Step 4: Envolver la lista desktop en DndContext + SortableContext**

Buscar el bloque de la tabla desktop (alrededor de línea 469-491):

```tsx
<div className="hidden md:block overflow-x-auto">
  <table className="w-full border-collapse">
    <thead>
      <tr className="bg-slate-100/80">
        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider [font-variant:small-caps]">Ejercicio</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-20 [font-variant:small-caps]">Series</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24 [font-variant:small-caps]">Reps</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider [font-variant:small-caps]">Notas</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24 [font-variant:small-caps]">Acciones</th>
      </tr>
    </thead>
    <tbody>
      {dia.ejercicios.map((ejercicio) => (
        <EjercicioRow
          key={ejercicio.id}
          ejercicio={ejercicio}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteConfirm}
        />
      ))}
    </tbody>
  </table>
</div>
```

Reemplazar con:

```tsx
<div className="hidden md:block overflow-x-auto">
  <table className="w-full border-collapse">
    <thead>
      <tr className="bg-slate-100/80">
        <th className="py-3 pl-4 pr-2 w-10" />
        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider [font-variant:small-caps]">Ejercicio</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-20 [font-variant:small-caps]">Series</th>
        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24 [font-variant:small-caps]">Reps</th>
        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider [font-variant:small-caps]">Notas</th>
        <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-24 [font-variant:small-caps]">Acciones</th>
      </tr>
    </thead>
    <tbody>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => handleDragEnd(event, dia.id)}
      >
        <SortableContext
          items={dia.ejercicios.map(e => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {dia.ejercicios.map((ejercicio, index) => (
            <EjercicioRow
              key={ejercicio.id}
              ejercicio={ejercicio}
              index={index + 1}
              onEdit={handleOpenEditModal}
              onDelete={handleOpenDeleteConfirm}
            />
          ))}
        </SortableContext>
      </DndContext>
    </tbody>
  </table>
</div>
```

**Step 5: Envolver la lista mobile en DndContext + SortableContext**

Buscar el bloque mobile (alrededor de línea 493-502):

```tsx
<div className="md:hidden space-y-3">
  {dia.ejercicios.map((ejercicio) => (
    <EjercicioRowMobile
      key={ejercicio.id}
      ejercicio={ejercicio}
      onEdit={handleOpenEditModal}
      onDelete={handleOpenDeleteConfirm}
    />
  ))}
</div>
```

Reemplazar con:

```tsx
<div className="md:hidden space-y-3">
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={(event) => handleDragEnd(event, dia.id)}
  >
    <SortableContext
      items={dia.ejercicios.map(e => e.id)}
      strategy={verticalListSortingStrategy}
    >
      {dia.ejercicios.map((ejercicio, index) => (
        <EjercicioRowMobile
          key={ejercicio.id}
          ejercicio={ejercicio}
          index={index + 1}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteConfirm}
        />
      ))}
    </SortableContext>
  </DndContext>
</div>
```

**Step 6: Verificar build**

```bash
cd /Users/franciscoojeda/Documents/proyects/nuevoproyecto && npm run build 2>&1 | tail -15
```

Expected: build exitoso sin errores TypeScript.

**Step 7: Self-review**

- `PointerSensor` con `activationConstraint: { distance: 8 }` — previene drags accidentales durante scroll en mobile
- `KeyboardSensor` — accesibilidad via teclado (opcional pero no cuesta nada)
- `handleDragEnd` recibe `diaId` — cada `DndContext` está scoped a un día, imposible cross-day
- `arrayMove` + `.map((ej, idx) => ({ ...ej, orden: idx + 1 }))` — reordena local y asigna nuevos `orden` 1-based
- `reordenarEjercicios` es fire-and-forget — no bloquea la UI, el estado local ya está actualizado
- `DndContext` está dentro de `<tbody>` — válido en HTML5, los browsers lo manejan bien
- Prop `index` es 1-based — se muestra como número de posición visible

**Step 8: Commit**

```bash
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto add app/rutinas/page.tsx
git -C /Users/franciscoojeda/Documents/proyects/nuevoproyecto commit -m "$(cat <<'EOF'
feat: reorder de ejercicios con drag-and-drop por día

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist final

- [ ] Task 1 ✅ @dnd-kit instalado, `reordenarEjercicios` en service layer
- [ ] Task 2 ✅ `EjercicioRow` y `EjercicioRowMobile` con `useSortable`, handle de grip, número de orden
- [ ] Task 3 ✅ `DndContext` + `SortableContext` por día en `rutinas/page.tsx`
- [ ] Drag funciona en desktop (mouse) y mobile (touch)
- [ ] El orden se guarda automáticamente en la DB al soltar
- [ ] Los números 1, 2, 3... se actualizan visualmente al reordenar
- [ ] Build pasa sin errores
