'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { EjercicioEditable, DiaConEjerciciosEditables, ModalEjercicioState } from '@/lib/types/database'
import { useAuth } from '@/lib/hooks'
import AppLayout from '@/app/components/AppLayout'
import { RutinaSkeleton } from '@/app/components/Skeleton'
import { EjercicioModal, EjercicioRow, EjercicioRowMobile } from '@/app/components/rutina'
import {
  obtenerRutinaEditable,
  actualizarEjercicio,
  eliminarEjercicio,
  agregarEjercicio,
  obtenerSiguienteOrden,
  reordenarEjercicios,
} from '@/lib/services/rutina-service'
import { trackEvent, trackError } from '@/lib/analytics'
import PremiumModal from '@/app/components/PremiumModal'
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

interface RutinaData {
  rutina: { id: string; nombre: string }
  dias: DiaConEjerciciosEditables[]
}

export default function RutinasPage() {
  const [rutinaData, setRutinaData] = useState<RutinaData | null>(null)
  const [loadingRutina, setLoadingRutina] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [modalState, setModalState] = useState<ModalEjercicioState>({
    isOpen: false,
    mode: 'edit',
    diaId: null,
    ejercicio: null
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    ejercicio: EjercicioEditable | null
    deleting: boolean
  }>({
    isOpen: false,
    ejercicio: null,
    deleting: false
  })
  const [premiumModalOpen, setPremiumModalOpen] = useState(false)
  // Dedup: trackear cada feature solo una vez por sesión para no spamear user_events
  const trackedPremiumFeatures = useRef(new Set<string>())

  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, user, userId } = useAuth()

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

    const dia = rutinaData.dias.find(d => d.id === diaId)
    if (!dia) return

    const oldIndex = dia.ejercicios.findIndex(e => e.id === active.id)
    const newIndex = dia.ejercicios.findIndex(e => e.id === over.id)
    const reordenados = arrayMove(dia.ejercicios, oldIndex, newIndex)
      .map((ej, idx) => ({ ...ej, orden: idx + 1 }))

    // Fire-and-forget: guardar en DB sin bloquear la UI
    reordenarEjercicios(supabase, reordenados.map(e => ({ id: e.id, orden: e.orden })))

    setRutinaData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        dias: prev.dias.map(d =>
          d.id === diaId ? { ...d, ejercicios: reordenados } : d
        ),
      }
    })
  }

  // Cargar rutina cuando el usuario está autenticado
  const loadRutina = useCallback(async () => {
    if (!userId) return

    setLoadingRutina(true)
    const resultado = await obtenerRutinaEditable(supabase, userId)

    if (resultado.success && resultado.data) {
      setRutinaData(resultado.data)
    } else {
      setRutinaData(null)
      if (resultado.error && resultado.error !== 'No se encontró ninguna rutina') {
        toast.error(resultado.error)
      }
    }

    setLoadingRutina(false)
  }, [userId, supabase])

  useEffect(() => {
    if (loadingAuth) return

    if (!authenticated || !userId) {
      router.push('/')
      return
    }

    loadRutina()
  }, [loadingAuth, authenticated, userId, loadRutina, router])

  // ==========================================
  // Handlers del Modal
  // ==========================================

  const handleOpenEditModal = (ejercicio: EjercicioEditable) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      diaId: ejercicio.dia_id,
      ejercicio
    })
  }

  const handleOpenAddModal = (diaId: string) => {
    setModalState({
      isOpen: true,
      mode: 'add',
      diaId,
      ejercicio: null
    })
  }

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      mode: 'edit',
      diaId: null,
      ejercicio: null
    })
  }

  // Handlers para confirmación de eliminación directa
  const handleOpenDeleteConfirm = (ejercicio: EjercicioEditable) => {
    setDeleteConfirm({
      isOpen: true,
      ejercicio,
      deleting: false
    })
  }

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirm({
      isOpen: false,
      ejercicio: null,
      deleting: false
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.ejercicio) return

    const ejercicioAEliminar = deleteConfirm.ejercicio
    setDeleteConfirm(prev => ({ ...prev, deleting: true }))

    const resultado = await eliminarEjercicio(supabase, ejercicioAEliminar.id)

    if (!resultado.success) {
      const errorMsg = resultado.error || 'Error al eliminar'
      trackError('eliminar_ejercicio', errorMsg)
      toast.error(errorMsg)
      setDeleteConfirm(prev => ({ ...prev, deleting: false }))
      return
    }

    // Actualizar estado local
    setRutinaData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        dias: prev.dias.map(dia => ({
          ...dia,
          ejercicios: dia.ejercicios.filter(ej => ej.id !== ejercicioAEliminar.id)
        }))
      }
    })

    // Track eliminación exitosa
    trackEvent('ejercicio_manual_edit', {
      accion: 'eliminar',
      ejercicio_id: ejercicioAEliminar.ejercicio_id,
      ejercicio_nombre: ejercicioAEliminar.ejercicio?.nombre
    })

    toast.success('Ejercicio eliminado')
    handleCloseDeleteConfirm()
  }

  // ==========================================
  // Operaciones CRUD
  // ==========================================

  const handleSaveEjercicio = async (datos: {
    ejercicio_id: string
    series: number
    repeticiones: string
    notas_coach: string | null
  }) => {
    if (modalState.mode === 'edit' && modalState.ejercicio) {
      // Actualizar ejercicio existente
      const resultado = await actualizarEjercicio(supabase, {
        id: modalState.ejercicio.id,
        ejercicio_id: datos.ejercicio_id,
        series: datos.series,
        repeticiones: datos.repeticiones,
        notas_coach: datos.notas_coach
      })

      if (!resultado.success) {
        throw new Error(resultado.error || 'Error al actualizar')
      }

      // Actualizar estado local
      if (resultado.data) {
        setRutinaData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            dias: prev.dias.map(dia => ({
              ...dia,
              ejercicios: dia.ejercicios.map(ej => 
                ej.id === resultado.data!.id ? resultado.data! : ej
              )
            }))
          }
        })
      }

      // Track edición manual
      const camposEditados: string[] = []
      if (modalState.ejercicio?.ejercicio_id !== datos.ejercicio_id) camposEditados.push('ejercicio')
      if (modalState.ejercicio?.series !== datos.series) camposEditados.push('series')
      if (modalState.ejercicio?.repeticiones !== datos.repeticiones) camposEditados.push('repeticiones')
      if (modalState.ejercicio?.notas_coach !== datos.notas_coach) camposEditados.push('notas')
      
      trackEvent('ejercicio_manual_edit', {
        accion: 'actualizar',
        campos_editados: camposEditados,
        ejercicio_id: datos.ejercicio_id
      })

      toast.success('Ejercicio actualizado')
    } else if (modalState.mode === 'add' && modalState.diaId) {
      // Agregar nuevo ejercicio
      const orden = await obtenerSiguienteOrden(supabase, modalState.diaId)
      
      const resultado = await agregarEjercicio(supabase, {
        dia_id: modalState.diaId,
        ejercicio_id: datos.ejercicio_id,
        series: datos.series,
        repeticiones: datos.repeticiones,
        orden,
        notas_coach: datos.notas_coach
      })

      if (!resultado.success) {
        throw new Error(resultado.error || 'Error al agregar')
      }

      // Actualizar estado local
      if (resultado.data) {
        setRutinaData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            dias: prev.dias.map(dia => {
              if (dia.id === modalState.diaId) {
                return {
                  ...dia,
                  ejercicios: [...dia.ejercicios, resultado.data!]
                }
              }
              return dia
            })
          }
        })
      }

      // Track agregar ejercicio
      trackEvent('ejercicio_manual_edit', {
        accion: 'agregar',
        ejercicio_id: datos.ejercicio_id,
        dia_id: modalState.diaId
      })

      toast.success('Ejercicio agregado')
    }
  }

  const handleDeleteEjercicio = async () => {
    if (!modalState.ejercicio) return

    const ejercicioEliminado = modalState.ejercicio
    const resultado = await eliminarEjercicio(supabase, ejercicioEliminado.id)

    if (!resultado.success) {
      throw new Error(resultado.error || 'Error al eliminar')
    }

    // Actualizar estado local
    setRutinaData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        dias: prev.dias.map(dia => ({
          ...dia,
          ejercicios: dia.ejercicios.filter(ej => ej.id !== ejercicioEliminado.id)
        }))
      }
    })

    // Track eliminación
    trackEvent('ejercicio_manual_edit', {
      accion: 'eliminar',
      ejercicio_id: ejercicioEliminado.ejercicio_id,
      ejercicio_nombre: ejercicioEliminado.ejercicio?.nombre
    })

    toast.success('Ejercicio eliminado')
  }

  // ==========================================
  // Handlers de navegación
  // ==========================================

  const handleGenerateNew = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmNewRoutine = () => {
    router.push('/?new=true')
  }

  const handleCancelNewRoutine = () => {
    setShowConfirmModal(false)
  }

  // Obtener nombre del día para el modal
  const getDiaNombre = () => {
    if (!modalState.diaId || !rutinaData) return ''
    const dia = rutinaData.dias.find(d => d.id === modalState.diaId)
    return dia?.nombre_dia || ''
  }

  // ==========================================
  // Render
  // ==========================================

  if (loadingAuth || loadingRutina) {
    return (
      <AppLayout>
        <RutinaSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
    <div className="min-h-screen app-page-bg p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="pl-14 md:pl-0 text-5xl md:text-6xl font-display text-slate-900 tracking-widest uppercase leading-none mb-1">
              Mi Rutina Activa
            </h1>
            <div className="h-0.5 w-12 bg-yellow-500 rounded-full mb-2" />
            <p className="text-slate-600 font-medium text-sm">
              {user?.email}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {rutinaData && (
              <button
                type="button"
                onClick={() => router.push('/entrenar')}
                className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all duration-200 shadow-lg shadow-neutral-900/10"
              >
                Entrenar
              </button>
            )}
            <button
              onClick={handleGenerateNew}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
            >
              Nueva Rutina
            </button>
          </div>
        </div>

        {!rutinaData ? (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-12 text-center border border-slate-200/80 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-yellow-500 to-amber-400" />
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-yellow-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Aún no tienes rutinas</h2>
            <p className="text-slate-600 mb-8 max-w-sm mx-auto">
              Genera tu primera rutina personalizada para comenzar tu entrenamiento
            </p>
            <button
              onClick={handleGenerateNew}
              className="px-8 py-4 bg-yellow-500 text-black rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generar mi primera rutina
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-yellow-500 to-amber-400" />
            <div className="p-6 border-b border-slate-200 bg-slate-50/30">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-display text-slate-900 tracking-wider uppercase leading-none mb-1">
                    {rutinaData.rutina.nombre || 'Mi Rutina'}
                  </h2>
                  <p className="text-sm text-slate-400 flex items-center gap-1.5 flex-wrap">
                    Clic en
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      editar
                    </span>
                    o
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      eliminar
                    </span>
                    ejercicios
                  </p>
                </div>

                {/* Botones de exportación (Premium) */}
                <div className="flex items-center gap-2 self-start md:self-center">
                  <button
                    onClick={() => {
                      if (!trackedPremiumFeatures.current.has('csv_export')) {
                        trackedPremiumFeatures.current.add('csv_export')
                        trackEvent('premium_feature_click', { feature: 'csv_export' })
                      }
                      setPremiumModalOpen(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:border-yellow-300 hover:text-yellow-600 hover:bg-yellow-50 transition-all duration-150"
                    title="Exportar como CSV (próximamente)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    CSV
                  </button>
                  <button
                    onClick={() => {
                      if (!trackedPremiumFeatures.current.has('pdf_export')) {
                        trackedPremiumFeatures.current.add('pdf_export')
                        trackEvent('premium_feature_click', { feature: 'pdf_export' })
                      }
                      setPremiumModalOpen(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:border-yellow-300 hover:text-yellow-600 hover:bg-yellow-50 transition-all duration-150"
                    title="Exportar como PDF (próximamente)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Días y ejercicios */}
            <div className="p-6 space-y-8">
              {rutinaData.dias.map((dia) => (
                <div key={dia.id} className="space-y-4">
                  <div className="pb-2 border-b border-slate-200 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-yellow-500 rounded-full" />
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      {dia.nombre_dia}
                    </h3>
                  </div>
                  
                  {dia.ejercicios.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50/50 rounded-xl">
                      <p className="text-gray-500">No hay ejercicios para este día</p>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block overflow-x-auto">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleDragEnd(event, dia.id)}
                        >
                          <SortableContext
                            items={dia.ejercicios.map(e => e.id)}
                            strategy={verticalListSortingStrategy}
                          >
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
                                {dia.ejercicios.map((ejercicio, index) => (
                                  <EjercicioRow
                                    key={ejercicio.id}
                                    ejercicio={ejercicio}
                                    index={index + 1}
                                    onEdit={handleOpenEditModal}
                                    onDelete={handleOpenDeleteConfirm}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </SortableContext>
                        </DndContext>
                      </div>

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
                    </>
                  )}

                  <button
                    onClick={() => handleOpenAddModal(dia.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-500 hover:text-yellow-600 hover:bg-yellow-50/80 border border-dashed border-slate-200 hover:border-yellow-300 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar nuevo ejercicio
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de edición/agregar ejercicio */}
        <EjercicioModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          ejercicio={modalState.ejercicio}
          diaNombre={getDiaNombre()}
          onSave={handleSaveEjercicio}
          onDelete={modalState.mode === 'edit' ? handleDeleteEjercicio : undefined}
          onClose={handleCloseModal}
        />

        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out_both]">
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-md w-full p-6 border border-slate-200 animate-[scaleIn_0.15s_ease-out_both]">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight">
                ¿Generar nueva rutina?
              </h3>
              <p className="text-slate-600 mb-6">
                Al generar una nueva rutina, tu rutina actual será archivada. Esta acción no se puede deshacer.
              </p>
              <p className="text-sm text-slate-500 mb-6">
                <strong>Versión Gratuita:</strong> Solo puedes tener 1 rutina activa a la vez.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelNewRoutine}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmNewRoutine}
                  className="flex-1 px-4 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-all duration-200 shadow-lg shadow-neutral-900/10"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        {deleteConfirm.isOpen && deleteConfirm.ejercicio && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out_both]">
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-sm w-full p-6 border border-slate-200 animate-[scaleIn_0.15s_ease-out_both]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Eliminar ejercicio
                </h3>
              </div>
              
              <p className="text-gray-600 mb-2">
                ¿Estás seguro que deseas eliminar este ejercicio?
              </p>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2 mb-6">
                {deleteConfirm.ejercicio.ejercicio.nombre}
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={handleCloseDeleteConfirm}
                  disabled={deleteConfirm.deleting}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all duration-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirm.deleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteConfirm.deleting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Eliminando...
                    </>
                  ) : (
                    'Eliminar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PremiumModal
        isOpen={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
      />
    </div>
    </AppLayout>
  )
}
