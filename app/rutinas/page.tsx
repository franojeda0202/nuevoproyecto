'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { EjercicioEditable, DiaConEjerciciosEditables, ModalEjercicioState } from '@/lib/types/database'
import { useAuth } from '@/lib/hooks'
import { RutinaSkeleton } from '@/app/components/Skeleton'
import { EjercicioModal, EjercicioRow, EjercicioRowMobile } from '@/app/components/rutina'
import { 
  obtenerRutinaEditable, 
  actualizarEjercicio, 
  eliminarEjercicio, 
  agregarEjercicio,
  obtenerSiguienteOrden 
} from '@/lib/services/rutina-service'

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
  
  const router = useRouter()
  const supabase = createClient()
  const { loading: loadingAuth, authenticated, user, userId, logout } = useAuth()

  // Cargar rutina cuando el usuario está autenticado
  useEffect(() => {
    if (loadingAuth) return
    
    if (!authenticated || !userId) {
      router.push('/')
      return
    }

    loadRutina()
  }, [loadingAuth, authenticated, userId])

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

  // ==========================================
  // Handlers del Modal
  // ==========================================

  const handleOpenEditModal = (ejercicio: EjercicioEditable) => {
    const dia = rutinaData?.dias.find(d => d.id === ejercicio.dia_id)
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

    setDeleteConfirm(prev => ({ ...prev, deleting: true }))

    const resultado = await eliminarEjercicio(supabase, deleteConfirm.ejercicio.id)

    if (!resultado.success) {
      toast.error(resultado.error || 'Error al eliminar')
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
          ejercicios: dia.ejercicios.filter(ej => ej.id !== deleteConfirm.ejercicio!.id)
        }))
      }
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

      toast.success('Ejercicio agregado')
    }
  }

  const handleDeleteEjercicio = async () => {
    if (!modalState.ejercicio) return

    const resultado = await eliminarEjercicio(supabase, modalState.ejercicio.id)

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
          ejercicios: dia.ejercicios.filter(ej => ej.id !== modalState.ejercicio!.id)
        }))
      }
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
    return <RutinaSkeleton />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight mb-2">
              Mi Rutina Activa
            </h1>
            <p className="text-gray-600 font-medium">
              {user?.email}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGenerateNew}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Nueva Rutina
            </button>
            <button
              onClick={logout}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Rutina activa o estado vacío */}
        {!rutinaData ? (
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center border border-gray-200">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Aún no tienes rutinas</h2>
            <p className="text-gray-600 mb-6">
              Genera tu primera rutina personalizada para comenzar tu entrenamiento
            </p>
            <button
              onClick={handleGenerateNew}
              className="px-8 py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Generar mi primera rutina 🚀
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Información de la rutina */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    {rutinaData.rutina.nombre || 'Mi Rutina'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Haz clic en ✏️ para editar o 🗑️ para eliminar ejercicios
                  </p>
                </div>
              </div>
            </div>

            {/* Días y ejercicios */}
            <div className="p-6 space-y-8">
              {rutinaData.dias.map((dia) => (
                <div key={dia.id} className="space-y-4">
                  {/* Header del día */}
                  <div className="border-b-2 border-gray-200 pb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {dia.nombre_dia}
                    </h3>
                  </div>
                  
                  {dia.ejercicios.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <p className="text-gray-500">No hay ejercicios para este día</p>
                    </div>
                  ) : (
                    <>
                      {/* Tabla Desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Ejercicio</th>
                              <th className="text-center py-3 px-4 font-semibold text-gray-700 w-20">Series</th>
                              <th className="text-center py-3 px-4 font-semibold text-gray-700 w-24">Reps</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Notas</th>
                              <th className="text-right py-3 px-4 font-semibold text-gray-700 w-24">Acciones</th>
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

                      {/* Cards Mobile */}
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
                    </>
                  )}

                  {/* Botón agregar ejercicio */}
                  <button
                    onClick={() => handleOpenAddModal(dia.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border-2 border-dashed border-gray-300 hover:border-blue-300 rounded-xl transition-all"
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
          diaId={modalState.diaId || ''}
          diaNombre={getDiaNombre()}
          onSave={handleSaveEjercicio}
          onDelete={modalState.mode === 'edit' ? handleDeleteEjercicio : undefined}
          onClose={handleCloseModal}
        />

        {/* Modal de confirmación nueva rutina */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                ¿Generar nueva rutina?
              </h3>
              <p className="text-gray-600 mb-6">
                Al generar una nueva rutina, tu rutina actual será archivada. Esta acción no se puede deshacer.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                <strong>Versión Gratuita:</strong> Solo puedes tener 1 rutina activa a la vez.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelNewRoutine}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmNewRoutine}
                  className="flex-1 px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        {deleteConfirm.isOpen && deleteConfirm.ejercicio && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200">
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
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirm.deleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
    </div>
  )
}
