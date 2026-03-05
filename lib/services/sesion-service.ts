import { SupabaseClient } from '@supabase/supabase-js'
import {
  ResultadoOperacion,
  SesionActiva,
  SesionSerieEditable,
  EjercicioConSeries,
  SesionResumen,
  SesionDetalle,
  EjercicioDetalle,
  SerieDetalle,
} from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Crear una nueva sesión de entrenamiento para un día
 * También crea todas las filas de sesion_series (una por ejercicio × serie)
 *
 * PREREQUISITO DB (ejecutar una vez en Supabase Dashboard → SQL Editor):
 *   CREATE UNIQUE INDEX IF NOT EXISTS sesiones_user_sesion_activa_unique
 *     ON sesiones (user_id)
 *     WHERE finalizada_at IS NULL;
 *
 * Este índice garantiza que un usuario solo pueda tener una sesión activa a la vez.
 * Si no existe el índice, el manejo del error 23505 abajo no tendrá efecto.
 */
export async function crearSesion(
  supabase: SupabaseClient,
  params: { userId: string; rutinaId: string; diaId: string }
): Promise<ResultadoOperacion<{ sesionId: string }>> {
  if (!isValidUUID(params.userId) || !isValidUUID(params.rutinaId) || !isValidUUID(params.diaId)) {
    return { success: false, error: 'IDs inválidos' }
  }

  try {
    // Verificar que el día pertenece a la rutina (defense-in-depth)
    const { data: diaValido, error: diaError } = await supabase
      .from('rutina_dias')
      .select('id')
      .eq('id', params.diaId)
      .eq('rutina_id', params.rutinaId)
      .single()

    if (diaError || !diaValido) {
      return { success: false, error: 'Día no encontrado en la rutina' }
    }

    // Crear la sesión
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .insert({
        user_id: params.userId,
        rutina_id: params.rutinaId,
        dia_id: params.diaId,
      })
      .select('id')
      .single()

    if (sesionError || !sesion) {
      // 23505 = unique_violation: ya existe una sesión activa para este usuario
      if (sesionError?.code === '23505') {
        return { success: false, error: 'Ya tenés una sesión activa. Finalizala antes de empezar una nueva.' }
      }
      console.error('Error creando sesión:', sesionError)
      return { success: false, error: 'Error al crear la sesión' }
    }

    // Cargar ejercicios del día para crear las series
    const { data: ejercicios, error: ejError } = await supabase
      .from('rutina_ejercicios')
      .select('id, series, orden')
      .eq('dia_id', params.diaId)
      .order('orden', { ascending: true })

    if (ejError || !ejercicios) {
      // Limpiar la sesión creada
      await supabase.from('sesiones').delete().eq('id', sesion.id)
      return { success: false, error: 'Error al cargar ejercicios del día' }
    }

    // Crear filas de sesion_series: una por ejercicio × número de series
    const seriesRows = ejercicios.flatMap(ej =>
      Array.from({ length: ej.series }, (_, i) => ({
        sesion_id: sesion.id,
        rutina_ejercicio_id: ej.id,
        numero_serie: i + 1,
        peso_kg: null,
        repeticiones: null,
        completada: false,
      }))
    )

    if (seriesRows.length > 0) {
      const { error: insertError } = await supabase
        .from('sesion_series')
        .insert(seriesRows)

      if (insertError) {
        console.error('Error creando series:', insertError)
        await supabase.from('sesiones').delete().eq('id', sesion.id)
        return { success: false, error: 'Error al inicializar la sesión' }
      }
    }

    return { success: true, data: { sesionId: sesion.id } }
  } catch (err) {
    console.error('Error en crearSesion:', err)
    return { success: false, error: 'Error al crear la sesión' }
  }
}

/**
 * Buscar sesión en progreso (sin finalizada_at) del usuario
 */
export async function obtenerSesionEnProgreso(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<{ sesionId: string; diaNombre: string } | null>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('sesiones')
      .select('id, rutina_dias(nombre_dia)')
      .eq('user_id', userId)
      .is('finalizada_at', null)
      .order('iniciada_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error buscando sesión en progreso:', error)
      return { success: false, error: 'Error al buscar sesión en progreso' }
    }

    if (!data) return { success: true, data: null }

    return {
      success: true,
      data: {
        sesionId: data.id,
        diaNombre: (data.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? '',
      },
    }
  } catch (err) {
    console.error('Error en obtenerSesionEnProgreso:', err)
    return { success: false, error: 'Error al buscar sesión en progreso' }
  }
}

/**
 * Cargar todos los datos para la pantalla de sesión activa:
 * - Info de la sesión + nombre del día
 * - Ejercicios del día con sus series (estado actual)
 * - Pre-fill: último peso/reps registrados para cada ejercicio en sesiones anteriores
 */
export async function obtenerSesionActiva(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<SesionActiva>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) return { success: false, error: 'IDs inválidos' }

  try {
    // Cargar sesión con nombre del día
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, user_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .eq('user_id', userId)   // ← NUEVO
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    const diaNombre = (sesion.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? ''

    // Cargar ejercicios del día y series actuales en paralelo
    const [ejResult, seriesResult] = await Promise.all([
      supabase
        .from('rutina_ejercicios')
        .select('id, series, orden, ejercicios:ejercicio_id(nombre)')
        .eq('dia_id', sesion.dia_id)
        .order('orden', { ascending: true }),
      supabase
        .from('sesion_series')
        .select('id, rutina_ejercicio_id, numero_serie, peso_kg, repeticiones, completada')
        .eq('sesion_id', sesionId)
        .order('numero_serie', { ascending: true }),
    ])

    if (ejResult.error || !ejResult.data) {
      return { success: false, error: 'Error al cargar ejercicios' }
    }
    if (seriesResult.error) {
      return { success: false, error: 'Error al cargar series de la sesión' }
    }

    const ejercicios = ejResult.data
    const series = seriesResult.data || []

    // Pre-fill: buscar la sesión más reciente finalizada para el mismo día
    const prefillMap: Record<string, { peso_kg: number | null; repeticiones: number | null }> = {}

    const { data: lastSession } = await supabase
      .from('sesiones')
      .select('id')
      .eq('user_id', sesion.user_id)
      .eq('dia_id', sesion.dia_id)
      .neq('id', sesionId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSession) {
      const { data: lastSeries } = await supabase
        .from('sesion_series')
        .select('rutina_ejercicio_id, peso_kg, repeticiones')
        .eq('sesion_id', lastSession.id)
        .eq('completada', true)
        .order('numero_serie', { ascending: true })

      if (lastSeries) {
        // Tomar el primer valor completado por ejercicio (número de serie más bajo)
        for (const s of lastSeries) {
          if (!prefillMap[s.rutina_ejercicio_id]) {
            prefillMap[s.rutina_ejercicio_id] = {
              peso_kg: s.peso_kg,
              repeticiones: s.repeticiones,
            }
          }
        }
      }
    }

    // Armar estructura EjercicioConSeries[]
    const ejerciciosConSeries: EjercicioConSeries[] = ejercicios.map(ej => {
      const nombre = (ej.ejercicios as unknown as { nombre: string } | null)?.nombre ?? ''

      const ejSeries: SesionSerieEditable[] = series
        .filter(s => s.rutina_ejercicio_id === ej.id)
        .map(s => ({
          id: s.id,
          sesion_id: sesionId,
          rutina_ejercicio_id: ej.id,
          numero_serie: s.numero_serie,
          peso_kg: s.peso_kg !== null ? String(s.peso_kg) : '',
          repeticiones: s.repeticiones !== null ? String(s.repeticiones) : '',
          completada: s.completada,
        }))

      return {
        rutina_ejercicio_id: ej.id,
        nombre,
        series_rutina: ej.series,
        series: ejSeries,
        ultima_serie: prefillMap[ej.id] || null,
      }
    })

    return {
      success: true,
      data: {
        id: sesionId,
        dia_nombre: diaNombre,
        finalizada_at: sesion.finalizada_at,
        ejercicios: ejerciciosConSeries,
      },
    }
  } catch (err) {
    console.error('Error en obtenerSesionActiva:', err)
    return { success: false, error: 'Error al cargar la sesión' }
  }
}

/**
 * Actualizar una serie existente (auto-save fire-and-forget desde la UI)
 */
export async function actualizarSerie(
  supabase: SupabaseClient,
  serie: {
    id: string
    sesionId: string
    peso_kg: number | null
    repeticiones: number | null
    completada?: boolean
  }
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(serie.id) || !isValidUUID(serie.sesionId)) return { success: false, error: 'IDs inválidos' }

  try {
    const { error } = await supabase
      .from('sesion_series')
      .update({
        peso_kg: serie.peso_kg,
        repeticiones: serie.repeticiones,
        ...(serie.completada !== undefined && { completada: serie.completada }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', serie.id)
      .eq('sesion_id', serie.sesionId)

    if (error) {
      console.error('Error guardando serie:', error)
      return { success: false, error: 'Error al guardar serie' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en actualizarSerie:', err)
    return { success: false, error: 'Error al guardar serie' }
  }
}

/**
 * Marcar una sesión como finalizada
 */
export async function finalizarSesion(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) return { success: false, error: 'IDs inválidos' }

  try {
    const { data: updated, error } = await supabase
      .from('sesiones')
      .update({ finalizada_at: new Date().toISOString() })
      .eq('id', sesionId)
      .eq('user_id', userId)   // ← NUEVO
      .select('id')

    if (error) {
      console.error('Error finalizando sesión:', error)
      return { success: false, error: 'Error al finalizar la sesión' }
    }

    if (!updated || updated.length === 0) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en finalizarSesion:', err)
    return { success: false, error: 'Error al finalizar la sesión' }
  }
}

/**
 * Obtener historial de sesiones finalizadas del usuario
 * Incluye el conteo de series completadas por sesión
 */
export async function obtenerHistorialSesiones(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<SesionResumen[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data: sesiones, error } = await supabase
      .from('sesiones')
      .select('id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('user_id', userId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo historial:', error)
      return { success: false, error: 'Error al cargar el historial' }
    }

    if (!sesiones || sesiones.length === 0) {
      return { success: true, data: [] }
    }

    // Obtener conteo de series completadas para todas las sesiones en una sola query
    const sesionIds = sesiones.map(s => s.id)
    const { data: seriesCompletadas } = await supabase
      .from('sesion_series')
      .select('sesion_id')
      .in('sesion_id', sesionIds)
      .eq('completada', true)

    // Contar por sesion_id en JS
    const conteoMap: Record<string, number> = {}
    for (const s of seriesCompletadas || []) {
      conteoMap[s.sesion_id] = (conteoMap[s.sesion_id] || 0) + 1
    }

    const resumen: SesionResumen[] = sesiones.map(s => ({
      id: s.id,
      dia_nombre: (s.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? '',
      finalizada_at: s.finalizada_at as string,
      series_completadas: conteoMap[s.id] || 0,
    }))

    return { success: true, data: resumen }
  } catch (err) {
    console.error('Error en obtenerHistorialSesiones:', err)
    return { success: false, error: 'Error al cargar el historial' }
  }
}

/**
 * Obtener el detalle completo de una sesión finalizada (read-only)
 */
export async function obtenerDetalleSesion(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<SesionDetalle>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) return { success: false, error: 'IDs inválidos' }

  try {
    // Sesión + nombre del día
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .eq('user_id', userId)             // ← NUEVO
      .not('finalizada_at', 'is', null)
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    const diaNombre = (sesion.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? ''

    // Ejercicios del día + series de la sesión en paralelo
    const [ejResult, seriesResult] = await Promise.all([
      supabase
        .from('rutina_ejercicios')
        .select('id, orden, ejercicios:ejercicio_id(nombre)')
        .eq('dia_id', sesion.dia_id)
        .order('orden', { ascending: true }),
      supabase
        .from('sesion_series')
        .select('rutina_ejercicio_id, numero_serie, peso_kg, repeticiones, completada')
        .eq('sesion_id', sesionId)
        .order('numero_serie', { ascending: true }),
    ])

    if (ejResult.error || !ejResult.data) {
      return { success: false, error: 'Error al cargar ejercicios' }
    }
    if (seriesResult.error) {
      return { success: false, error: 'Error al cargar las series' }
    }
    const series = seriesResult.data ?? []

    const ejercicios: EjercicioDetalle[] = ejResult.data.map(ej => {
      const nombre = (ej.ejercicios as unknown as { nombre: string } | null)?.nombre ?? ''
      const ejSeries: SerieDetalle[] = series
        .filter(s => s.rutina_ejercicio_id === ej.id)
        .map(s => ({
          numero_serie: s.numero_serie,
          peso_kg: s.peso_kg,
          repeticiones: s.repeticiones,
          completada: s.completada,
        }))
      return { nombre, series: ejSeries }
    })

    return {
      success: true,
      data: {
        id: sesionId,
        dia_nombre: diaNombre,
        finalizada_at: sesion.finalizada_at as string,
        ejercicios,
      },
    }
  } catch (err) {
    console.error('Error en obtenerDetalleSesion:', err)
    return { success: false, error: 'Error al cargar el detalle' }
  }
}

/**
 * Eliminar una sesión finalizada del historial
 */
export async function eliminarSesion(
  supabase: SupabaseClient,
  sesionId: string,
  userId: string
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(sesionId) || !isValidUUID(userId)) {
    return { success: false, error: 'IDs inválidos' }
  }

  try {
    // Eliminar series primero (evita FK violation si no hay CASCADE)
    const { error: seriesError } = await supabase
      .from('sesion_series')
      .delete()
      .eq('sesion_id', sesionId)

    if (seriesError) {
      console.error('Error eliminando series de sesión:', seriesError)
      return { success: false, error: 'Error al eliminar el entrenamiento' }
    }

    const { error } = await supabase
      .from('sesiones')
      .delete()
      .eq('id', sesionId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error eliminando sesión:', error)
      return { success: false, error: 'Error al eliminar el entrenamiento' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en eliminarSesion:', err)
    return { success: false, error: 'Error al eliminar el entrenamiento' }
  }
}
