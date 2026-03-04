import { SupabaseClient } from '@supabase/supabase-js'
import {
  ResultadoOperacion,
  SesionActiva,
  SesionSerieEditable,
  EjercicioConSeries,
} from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Crear una nueva sesión de entrenamiento para un día
 * También crea todas las filas de sesion_series (una por ejercicio × serie)
 */
export async function crearSesion(
  supabase: SupabaseClient,
  params: { userId: string; rutinaId: string; diaId: string }
): Promise<ResultadoOperacion<{ sesionId: string }>> {
  if (!isValidUUID(params.userId) || !isValidUUID(params.rutinaId) || !isValidUUID(params.diaId)) {
    return { success: false, error: 'IDs inválidos' }
  }

  try {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        diaNombre: (data.rutina_dias as any)?.nombre_dia || '',
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
  sesionId: string
): Promise<ResultadoOperacion<SesionActiva>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

  try {
    // Cargar sesión con nombre del día
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id, dia_id, user_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('id', sesionId)
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diaNombre = (sesion.rutina_dias as any)?.nombre_dia || ''

    // Cargar ejercicios del día
    const { data: ejercicios, error: ejError } = await supabase
      .from('rutina_ejercicios')
      .select('id, series, orden, ejercicios:ejercicio_id(nombre)')
      .eq('dia_id', sesion.dia_id)
      .order('orden', { ascending: true })

    if (ejError || !ejercicios) {
      return { success: false, error: 'Error al cargar ejercicios' }
    }

    // Cargar series actuales de esta sesión
    const { data: seriesData, error: seriesError } = await supabase
      .from('sesion_series')
      .select('id, rutina_ejercicio_id, numero_serie, peso_kg, repeticiones, completada')
      .eq('sesion_id', sesionId)
      .order('numero_serie', { ascending: true })

    if (seriesError) {
      return { success: false, error: 'Error al cargar series de la sesión' }
    }

    const series = seriesData || []

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nombre = (ej.ejercicios as any)?.nombre || ''

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
 * Auto-save de una serie (fire-and-forget desde la UI)
 */
export async function upsertSerie(
  supabase: SupabaseClient,
  serie: {
    id: string
    peso_kg: number | null
    repeticiones: number | null
    completada: boolean
  }
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(serie.id)) return { success: false, error: 'ID inválido' }

  try {
    const { error } = await supabase
      .from('sesion_series')
      .update({
        peso_kg: serie.peso_kg,
        repeticiones: serie.repeticiones,
        completada: serie.completada,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serie.id)

    if (error) {
      console.error('Error guardando serie:', error)
      return { success: false, error: 'Error al guardar serie' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en upsertSerie:', err)
    return { success: false, error: 'Error al guardar serie' }
  }
}

/**
 * Marcar una sesión como finalizada
 */
export async function finalizarSesion(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ResultadoOperacion<null>> {
  if (!isValidUUID(sesionId)) return { success: false, error: 'ID inválido' }

  try {
    const { error } = await supabase
      .from('sesiones')
      .update({ finalizada_at: new Date().toISOString() })
      .eq('id', sesionId)

    if (error) {
      console.error('Error finalizando sesión:', error)
      return { success: false, error: 'Error al finalizar la sesión' }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error('Error en finalizarSesion:', err)
    return { success: false, error: 'Error al finalizar la sesión' }
  }
}
