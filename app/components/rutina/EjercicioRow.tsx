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
