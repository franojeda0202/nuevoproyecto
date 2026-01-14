import { SupabaseClient } from '@supabase/supabase-js'
import { 
  ResultadoOperacion, 
  NuevoEjercicioRutina, 
  ActualizarEjercicioRutina,
  EjercicioEditable,
  DiaConEjerciciosEditables
} from '@/lib/types/database'

/**
 * Servicio para operaciones CRUD de rutinas
 * Recibe el cliente de Supabase como parámetro para flexibilidad
 */

// ============================================
// OBTENER DATOS
// ============================================

/**
 * Obtener rutina completa con ejercicios editables
 * Incluye toda la info necesaria para edición
 */
export async function obtenerRutinaEditable(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<{ rutina: { id: string; nombre: string }; dias: DiaConEjerciciosEditables[] }>> {
  try {
    const { data, error } = await supabase
      .from('rutinas')
      .select(`
        id,
        nombre,
        rutina_dias (
          id,
          nombre_dia,
          orden,
          rutina_ejercicios (
            id,
            dia_id,
            ejercicio_id,
            series,
            repeticiones,
            orden,
            notas_coach,
            ejercicios:ejercicio_id (
              nombre,
              segmento,
              patron_movimiento,
              grupo_muscular,
              equipamiento
            )
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return { success: false, error: 'No se encontró ninguna rutina' }
    }

    // Transformar a estructura editable (usando any para evitar problemas con tipos de Supabase)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rutinaDias = data.rutina_dias as any[] || []
    
    const dias: DiaConEjerciciosEditables[] = rutinaDias
      .sort((a, b) => a.orden - b.orden)
      .map((dia) => ({
        id: dia.id,
        nombre_dia: dia.nombre_dia,
        orden: dia.orden,
        ejercicios: (dia.rutina_ejercicios || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.orden - b.orden)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((ej: any): EjercicioEditable => ({
            id: ej.id,
            dia_id: ej.dia_id,
            ejercicio_id: ej.ejercicio_id,
            series: ej.series,
            repeticiones: ej.repeticiones,
            orden: ej.orden,
            notas_coach: ej.notas_coach,
            ejercicio: {
              nombre: ej.ejercicios?.nombre || 'Sin nombre',
              segmento: ej.ejercicios?.segmento || '',
              patron_movimiento: ej.ejercicios?.patron_movimiento || '',
              grupo_muscular: ej.ejercicios?.grupo_muscular || '',
              equipamiento: ej.ejercicios?.equipamiento || ''
            }
          }))
      }))

    return {
      success: true,
      data: {
        rutina: { id: data.id, nombre: data.nombre },
        dias
      }
    }
  } catch (err) {
    console.error('❌ Error obteniendo rutina editable:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al obtener rutina'
    }
  }
}

// ============================================
// ACTUALIZAR EJERCICIO
// ============================================

/**
 * Actualizar un ejercicio existente en la rutina
 * Puede cambiar: ejercicio_id, series, repeticiones, notas_coach
 */
export async function actualizarEjercicio(
  supabase: SupabaseClient,
  datos: ActualizarEjercicioRutina
): Promise<ResultadoOperacion<EjercicioEditable>> {
  try {
    // Validar UUID
    if (!datos.id || !isValidUUID(datos.id)) {
      return { success: false, error: 'ID de ejercicio inválido' }
    }

    // Construir objeto de actualización (solo campos presentes)
    const updateData: Record<string, unknown> = {}
    
    if (datos.ejercicio_id !== undefined) {
      if (!isValidUUID(datos.ejercicio_id)) {
        return { success: false, error: 'ID de ejercicio nuevo inválido' }
      }
      updateData.ejercicio_id = datos.ejercicio_id
    }
    
    if (datos.series !== undefined) {
      if (datos.series < 1 || datos.series > 20) {
        return { success: false, error: 'Las series deben estar entre 1 y 20' }
      }
      updateData.series = datos.series
    }
    
    if (datos.repeticiones !== undefined) {
      if (!datos.repeticiones.trim()) {
        return { success: false, error: 'Las repeticiones no pueden estar vacías' }
      }
      updateData.repeticiones = datos.repeticiones.trim()
    }
    
    if (datos.notas_coach !== undefined) {
      updateData.notas_coach = datos.notas_coach?.trim() || null
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No hay datos para actualizar' }
    }

    // Ejecutar actualización
    const { error: updateError } = await supabase
      .from('rutina_ejercicios')
      .update(updateData)
      .eq('id', datos.id)

    if (updateError) {
      throw updateError
    }

    // Obtener el ejercicio actualizado con info completa
    const { data: ejercicioActualizado, error: fetchError } = await supabase
      .from('rutina_ejercicios')
      .select(`
        id,
        dia_id,
        ejercicio_id,
        series,
        repeticiones,
        orden,
        notas_coach,
        ejercicios:ejercicio_id (
          nombre,
          segmento,
          patron_movimiento,
          grupo_muscular,
          equipamiento
        )
      `)
      .eq('id', datos.id)
      .single()

    if (fetchError || !ejercicioActualizado) {
      throw fetchError || new Error('No se pudo obtener el ejercicio actualizado')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ej = ejercicioActualizado as any
    const resultado: EjercicioEditable = {
      id: ej.id,
      dia_id: ej.dia_id,
      ejercicio_id: ej.ejercicio_id,
      series: ej.series,
      repeticiones: ej.repeticiones,
      orden: ej.orden,
      notas_coach: ej.notas_coach,
      ejercicio: {
        nombre: ej.ejercicios?.nombre || 'Sin nombre',
        segmento: ej.ejercicios?.segmento || '',
        patron_movimiento: ej.ejercicios?.patron_movimiento || '',
        grupo_muscular: ej.ejercicios?.grupo_muscular || '',
        equipamiento: ej.ejercicios?.equipamiento || ''
      }
    }

    console.log('✅ Ejercicio actualizado:', resultado.ejercicio.nombre)
    return { success: true, data: resultado }
  } catch (err) {
    console.error('❌ Error actualizando ejercicio:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al actualizar ejercicio'
    }
  }
}

// ============================================
// ELIMINAR EJERCICIO
// ============================================

/**
 * Eliminar un ejercicio de la rutina
 */
export async function eliminarEjercicio(
  supabase: SupabaseClient,
  ejercicioId: string
): Promise<ResultadoOperacion> {
  try {
    if (!isValidUUID(ejercicioId)) {
      return { success: false, error: 'ID de ejercicio inválido' }
    }

    const { error } = await supabase
      .from('rutina_ejercicios')
      .delete()
      .eq('id', ejercicioId)

    if (error) {
      throw error
    }

    console.log('✅ Ejercicio eliminado:', ejercicioId)
    return { success: true }
  } catch (err) {
    console.error('❌ Error eliminando ejercicio:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al eliminar ejercicio'
    }
  }
}

// ============================================
// AGREGAR EJERCICIO
// ============================================

/**
 * Agregar un nuevo ejercicio a un día de la rutina
 */
export async function agregarEjercicio(
  supabase: SupabaseClient,
  datos: NuevoEjercicioRutina
): Promise<ResultadoOperacion<EjercicioEditable>> {
  try {
    // Validaciones
    if (!isValidUUID(datos.dia_id)) {
      return { success: false, error: 'ID de día inválido' }
    }
    
    if (!isValidUUID(datos.ejercicio_id)) {
      return { success: false, error: 'ID de ejercicio inválido' }
    }
    
    if (datos.series < 1 || datos.series > 20) {
      return { success: false, error: 'Las series deben estar entre 1 y 20' }
    }
    
    if (!datos.repeticiones?.trim()) {
      return { success: false, error: 'Las repeticiones no pueden estar vacías' }
    }

    // Insertar nuevo ejercicio
    const { data: nuevoEjercicio, error: insertError } = await supabase
      .from('rutina_ejercicios')
      .insert({
        dia_id: datos.dia_id,
        ejercicio_id: datos.ejercicio_id,
        series: datos.series,
        repeticiones: datos.repeticiones.trim(),
        orden: datos.orden,
        notas_coach: datos.notas_coach?.trim() || null
      })
      .select(`
        id,
        dia_id,
        ejercicio_id,
        series,
        repeticiones,
        orden,
        notas_coach,
        ejercicios:ejercicio_id (
          nombre,
          segmento,
          patron_movimiento,
          grupo_muscular,
          equipamiento
        )
      `)
      .single()

    if (insertError || !nuevoEjercicio) {
      throw insertError || new Error('No se pudo crear el ejercicio')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ej = nuevoEjercicio as any
    const resultado: EjercicioEditable = {
      id: ej.id,
      dia_id: ej.dia_id,
      ejercicio_id: ej.ejercicio_id,
      series: ej.series,
      repeticiones: ej.repeticiones,
      orden: ej.orden,
      notas_coach: ej.notas_coach,
      ejercicio: {
        nombre: ej.ejercicios?.nombre || 'Sin nombre',
        segmento: ej.ejercicios?.segmento || '',
        patron_movimiento: ej.ejercicios?.patron_movimiento || '',
        grupo_muscular: ej.ejercicios?.grupo_muscular || '',
        equipamiento: ej.ejercicios?.equipamiento || ''
      }
    }

    console.log('✅ Ejercicio agregado:', resultado.ejercicio.nombre)
    return { success: true, data: resultado }
  } catch (err) {
    console.error('❌ Error agregando ejercicio:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al agregar ejercicio'
    }
  }
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Validar formato UUID
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Obtener el siguiente orden para un día
 */
export async function obtenerSiguienteOrden(
  supabase: SupabaseClient,
  diaId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('rutina_ejercicios')
      .select('orden')
      .eq('dia_id', diaId)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error obteniendo orden:', error)
      return 1
    }

    return (data?.orden || 0) + 1
  } catch {
    return 1
  }
}
