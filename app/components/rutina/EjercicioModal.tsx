'use client'

import { useState, useEffect, useMemo } from 'react'
import { EjercicioEditable, Ejercicio } from '@/lib/types/database'
import { useEjerciciosPool } from '@/lib/hooks'

interface EjercicioModalProps {
  isOpen: boolean
  mode: 'edit' | 'add'
  ejercicio: EjercicioEditable | null  // null cuando es modo 'add'
  diaId: string
  diaNombre: string
  onSave: (datos: {
    ejercicio_id: string
    series: number
    repeticiones: string
    notas_coach: string | null
  }) => Promise<void>
  onDelete?: () => Promise<void>  // Solo disponible en modo 'edit'
  onClose: () => void
}

export default function EjercicioModal({
  isOpen,
  mode,
  ejercicio,
  diaId,
  diaNombre,
  onSave,
  onDelete,
  onClose
}: EjercicioModalProps) {
  // Estado del formulario
  const [ejercicioId, setEjercicioId] = useState<string>('')
  const [series, setSeries] = useState<number>(3)
  const [repeticiones, setRepeticiones] = useState<string>('10-12')
  const [notasCoach, setNotasCoach] = useState<string>('')
  
  // Estado de UI
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarAlternativas, setMostrarAlternativas] = useState(mode === 'add')
  
  // Pool de ejercicios
  const { ejercicios, loading: loadingPool, filtrarPorContexto, obtenerEjercicio } = useEjerciciosPool()

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && ejercicio) {
        setEjercicioId(ejercicio.ejercicio_id)
        setSeries(ejercicio.series)
        setRepeticiones(ejercicio.repeticiones)
        setNotasCoach(ejercicio.notas_coach || '')
        setMostrarAlternativas(false)
      } else {
        // Modo agregar - valores por defecto
        setEjercicioId('')
        setSeries(3)
        setRepeticiones('10-12')
        setNotasCoach('')
        setMostrarAlternativas(true)
      }
      setBusqueda('')
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [isOpen, mode, ejercicio])

  // Ejercicio seleccionado actualmente
  const ejercicioSeleccionado = useMemo(() => {
    if (!ejercicioId) return null
    return obtenerEjercicio(ejercicioId)
  }, [ejercicioId, obtenerEjercicio])

  // Alternativas filtradas por contexto
  const alternativas = useMemo(() => {
    if (mode === 'edit' && ejercicio && !busqueda) {
      // En modo edición, filtrar por mismo segmento y patrón
      return filtrarPorContexto(
        ejercicio.ejercicio.segmento,
        ejercicio.ejercicio.patron_movimiento,
        ejercicio.ejercicio_id
      )
    }
    
    // Si hay búsqueda o es modo agregar, filtrar por nombre
    if (busqueda.trim()) {
      const busquedaLower = busqueda.toLowerCase()
      return ejercicios.filter(e => 
        e.nombre.toLowerCase().includes(busquedaLower)
      ).slice(0, 20) // Limitar resultados
    }
    
    // En modo agregar sin búsqueda, mostrar todos (limitado)
    if (mode === 'add') {
      return ejercicios.slice(0, 20)
    }
    
    return []
  }, [mode, ejercicio, busqueda, ejercicios, filtrarPorContexto])

  // Handlers
  const handleSave = async () => {
    // Validaciones
    if (!ejercicioId) {
      setError('Debes seleccionar un ejercicio')
      return
    }
    if (series < 1 || series > 20) {
      setError('Las series deben estar entre 1 y 20')
      return
    }
    if (!repeticiones.trim()) {
      setError('Debes indicar las repeticiones')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      await onSave({
        ejercicio_id: ejercicioId,
        series,
        repeticiones: repeticiones.trim(),
        notas_coach: notasCoach.trim() || null
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    
    setDeleting(true)
    setError(null)
    
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSelectEjercicio = (ej: Ejercicio) => {
    setEjercicioId(ej.id)
    setMostrarAlternativas(false)
    setBusqueda('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/20 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-blue-500" />
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {mode === 'edit' ? 'Editar Ejercicio' : 'Agregar Ejercicio'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {diaNombre}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
              disabled={saving || deleting}
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Ejercicio actual / selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ejercicio
            </label>
            
            {/* Ejercicio seleccionado */}
            {ejercicioSeleccionado && !mostrarAlternativas ? (
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{ejercicioSeleccionado.nombre}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {ejercicioSeleccionado.segmento}
                      </span>
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                        {ejercicioSeleccionado.patron_movimiento}
                      </span>
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                        {ejercicioSeleccionado.grupo_muscular}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMostrarAlternativas(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              /* Selector de ejercicios */
              <div className="space-y-3">
                {/* Búsqueda */}
                <div className="relative">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar ejercicio..."
                    className="w-full px-4 py-3 h-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Info de filtrado */}
                {mode === 'edit' && ejercicio && !busqueda && (
                  <p className="text-xs text-gray-500 px-1">
                    Mostrando alternativas del mismo tipo: <strong>{ejercicio.ejercicio.segmento}</strong> / <strong>{ejercicio.ejercicio.patron_movimiento}</strong>
                  </p>
                )}

                {/* Lista de alternativas */}
                {loadingPool ? (
                  <div className="py-8 text-center text-gray-500">
                    <div className="animate-spin h-6 w-6 border-2 border-slate-200 border-t-blue-500 rounded-full mx-auto mb-2" />
                    Cargando ejercicios...
                  </div>
                ) : alternativas.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {alternativas.map((ej) => (
                      <button
                        key={ej.id}
                        onClick={() => handleSelectEjercicio(ej)}
                        className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                          ej.id === ejercicioId ? 'bg-blue-50' : ''
                        }`}
                      >
                        <p className="font-medium text-gray-900">{ej.nombre}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-gray-500">{ej.grupo_muscular}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{ej.equipamiento}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : busqueda ? (
                  <p className="py-4 text-center text-gray-500 text-sm">
                    No se encontraron ejercicios para "{busqueda}"
                  </p>
                ) : (
                  <p className="py-4 text-center text-gray-500 text-sm">
                    Escribe para buscar ejercicios
                  </p>
                )}

                {/* Botón cancelar cambio */}
                {mode === 'edit' && ejercicioSeleccionado && (
                  <button
                    onClick={() => {
                      setMostrarAlternativas(false)
                      setBusqueda('')
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Cancelar cambio
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Series */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Series
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={series}
              onChange={(e) => setSeries(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 h-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          {/* Repeticiones */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Repeticiones
            </label>
            <input
              type="text"
              value={repeticiones}
              onChange={(e) => setRepeticiones(e.target.value)}
              placeholder="Ej: 10-12, 8, 15"
              className="w-full px-4 py-3 h-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Puedes usar rangos (8-12) o valores fijos (10)
            </p>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notas del coach <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={notasCoach}
              onChange={(e) => setNotasCoach(e.target.value)}
              placeholder="Indicaciones técnicas, tempo, etc."
              rows={2}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none min-h-[80px]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0">
          {/* Confirmación de eliminación */}
          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 text-center">
                ¿Seguro que quieres eliminar este ejercicio?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-transparent border border-slate-200 text-gray-700 rounded-xl font-semibold hover:bg-slate-100 transition-all duration-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Eliminando...
                    </>
                  ) : (
                    'Sí, eliminar'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Botón eliminar (solo en modo edit) */}
              {mode === 'edit' && onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-4 py-3 border border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-all duration-200 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              
              {/* Botón cancelar */}
              <button
                onClick={onClose}
                disabled={saving || deleting}
                className="flex-1 px-4 py-3 bg-transparent border border-slate-200 text-gray-700 rounded-xl font-semibold hover:bg-slate-100 transition-all duration-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              
              {/* Botón guardar */}
              <button
                onClick={handleSave}
                disabled={saving || !ejercicioId}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/25"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
