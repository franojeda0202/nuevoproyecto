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
    // Verificar que el día pertenece a la rutina y cargar sus ejercicios antes de crear la sesión
    const { data: diaValido, error: diaError } = await supabase
      .from('rutina_dias')
      .select('id')
      .eq('id', params.diaId)
      .eq('rutina_id', params.rutinaId)
      .single()

    if (diaError || !diaValido) {
      return { success: false, error: 'Día no encontrado en la rutina' }
    }

    // Cargar ejercicios antes de crear la sesión — si el día no tiene ejercicios, fallar sin dejar sesión huérfana
    const { data: ejercicios, error: ejError } = await supabase
      .from('rutina_ejercicios')
      .select('id, series, orden')
      .eq('dia_id', params.diaId)
      .order('orden', { ascending: true })

    if (ejError || !ejercicios) {
      return { success: false, error: 'Error al cargar ejercicios del día' }
    }

    if (ejercicios.length === 0) {
      return { success: false, error: 'Este día no tiene ejercicios. Agregá al menos uno antes de entrenar.' }
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

    // Crear filas de sesion_series: una por ejercicio × número de series
    // (ejercicios ya fue cargado y validado antes de crear la sesión)
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
): Promise<ResultadoOperacion<{ sesionId: string; diaNombre: string; iniciadaAt: string } | null>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('sesiones')
      .select('id, iniciada_at, rutina_dias(nombre_dia, orden)')
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
        iniciadaAt: data.iniciada_at as string,
        diaNombre: (() => {
          const rd = data.rutina_dias as unknown as { nombre_dia: string; orden: number } | null
          return rd ? `Día ${rd.orden} — ${rd.nombre_dia}` : ''
        })(),
      },
    }
  } catch (err) {
    console.error('Error en obtenerSesionEnProgreso:', err)
    return { success: false, error: 'Error al buscar sesión en progreso' }
  }
}

/**
 * Sesiones terminadas más recientes, para la pantalla "Hoy": qué día toca
 * (el siguiente al último) y cómo viene la semana.
 *
 * Solo cuentan las que tienen al menos una serie completada: una sesión
 * empezada y terminada sin cargar nada no es un entrenamiento, y si contara
 * avanzaría la rotación de días y mostraría "0 series".
 *
 * Con `limite` chico (14 sesiones × ~30 series) no hay riesgo de pasar el
 * tope de 1000 filas de Supabase.
 */
export async function obtenerSesionesRecientes(
  supabase: SupabaseClient,
  userId: string,
  limite = 14
): Promise<ResultadoOperacion<Array<{
  id: string
  dia_id: string | null
  finalizada_at: string
  dia_nombre: string
  series_completadas: number
}>>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data, error } = await supabase
      .from('sesiones')
      .select('id, dia_id, finalizada_at, rutina_dias(nombre_dia)')
      .eq('user_id', userId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })
      .limit(limite)

    if (error) {
      console.error('Error buscando sesiones recientes:', error)
      return { success: false, error: 'Error al cargar sesiones recientes' }
    }
    if (!data || data.length === 0) return { success: true, data: [] }

    const { data: series, error: seriesError } = await supabase
      .from('sesion_series')
      .select('sesion_id')
      .in('sesion_id', data.map((s) => s.id))
      .eq('completada', true)

    if (seriesError) {
      console.error('Error contando series de sesiones recientes:', seriesError)
      return { success: false, error: 'Error al cargar sesiones recientes' }
    }

    const porSesion = new Map<string, number>()
    for (const fila of series ?? []) {
      porSesion.set(fila.sesion_id, (porSesion.get(fila.sesion_id) ?? 0) + 1)
    }

    const sesiones = data
      .map((s) => ({
        id: s.id as string,
        dia_id: s.dia_id as string | null,
        finalizada_at: s.finalizada_at as string,
        dia_nombre: (s.rutina_dias as unknown as { nombre_dia: string } | null)?.nombre_dia ?? '',
        series_completadas: porSesion.get(s.id) ?? 0,
      }))
      .filter((s) => s.series_completadas > 0)

    return { success: true, data: sesiones }
  } catch (err) {
    console.error('Error en obtenerSesionesRecientes:', err)
    return { success: false, error: 'Error al cargar sesiones recientes' }
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
      .select('id, dia_id, user_id, iniciada_at, finalizada_at, rutina_dias(nombre_dia, orden)')
      .eq('id', sesionId)
      .eq('user_id', userId)   // ← NUEVO
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    const rutinaDia = sesion.rutina_dias as unknown as { nombre_dia: string; orden: number } | null
    const diaNombre = rutinaDia ? `Día ${rutinaDia.orden} — ${rutinaDia.nombre_dia}` : ''

    // Cargar ejercicios del día y series actuales en paralelo
    const [ejResult, seriesResult] = await Promise.all([
      supabase
        .from('rutina_ejercicios')
        .select('id, ejercicio_id, series, repeticiones, orden, ejercicios:ejercicio_id(nombre)')
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

    // Pre-fill / "Última vez": por EJERCICIO, no por día de la rutina. Así
    // sirve aunque la última vez de este día haya quedado vacía, aunque el
    // ejercicio esté en otro día (Rama hace jalón neutro en Pull y en Torso) y
    // aunque se haya cambiado de rutina.
    // Se mira solo en las últimas 30 sesiones terminadas: con ~25 series por
    // sesión queda lejos del tope de 1000 filas de Supabase.
    const prefillPorEjercicio: Record<string, { peso_kg: number | null; repeticiones: number | null }> = {}
    const ejercicioIds = [...new Set(ejercicios.map((ej) => ej.ejercicio_id as string))]

    const { data: recientes } = await supabase
      .from('sesiones')
      .select('id')
      .eq('user_id', sesion.user_id)
      .neq('id', sesionId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })
      .limit(30)

    if (recientes && recientes.length > 0 && ejercicioIds.length > 0) {
      const ordenSesion = new Map(recientes.map((r, i) => [r.id as string, i]))
      const { data: anteriores } = await supabase
        .from('sesion_series')
        .select('sesion_id, numero_serie, peso_kg, repeticiones, rutina_ejercicios!inner(ejercicio_id)')
        .in('sesion_id', recientes.map((r) => r.id))
        .in('rutina_ejercicios.ejercicio_id', ejercicioIds)
        .eq('completada', true)

      // La sesión más reciente gana; dentro de ella, la serie de número más bajo
      const ordenadas = (anteriores ?? []).slice().sort((a, b) =>
        (ordenSesion.get(a.sesion_id) ?? 99) - (ordenSesion.get(b.sesion_id) ?? 99) ||
        a.numero_serie - b.numero_serie
      )
      for (const fila of ordenadas) {
        const ejercicioId = (fila.rutina_ejercicios as unknown as { ejercicio_id: string } | null)?.ejercicio_id
        if (ejercicioId && !prefillPorEjercicio[ejercicioId]) {
          prefillPorEjercicio[ejercicioId] = { peso_kg: fila.peso_kg, repeticiones: fila.repeticiones }
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
        // Supabase retorna `any` sin schema generado; la columna es TEXT en DB (ver RutinaEjercicio)
        repeticiones_rutina: (ej.repeticiones as string | null) ?? '',
        series: ejSeries,
        ultima_serie: prefillPorEjercicio[ej.ejercicio_id as string] || null,
      }
    })

    return {
      success: true,
      data: {
        id: sesionId,
        dia_nombre: diaNombre,
        iniciada_at: sesion.iniciada_at,
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
 * Obtener historial de sesiones finalizadas del usuario, con duración,
 * series (hechas y totales) y kilos movidos por sesión.
 *
 * Trae TODAS las series de esas sesiones (no solo las completadas) para
 * poder mostrar "10 de 12". Por eso el límite es de 30 sesiones: con ~30
 * series cada una queda por debajo del tope de 1000 filas de Supabase.
 * Para ver más atrás hace falta paginar.
 */
export async function obtenerHistorialSesiones(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<SesionResumen[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const { data: sesiones, error } = await supabase
      .from('sesiones')
      .select('id, iniciada_at, finalizada_at, rutina_dias(nombre_dia, orden)')
      .eq('user_id', userId)
      .not('finalizada_at', 'is', null)
      .order('finalizada_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Error obteniendo historial:', error)
      return { success: false, error: 'Error al cargar el historial' }
    }

    if (!sesiones || sesiones.length === 0) {
      return { success: true, data: [] }
    }

    const { data: series, error: seriesError } = await supabase
      .from('sesion_series')
      .select('sesion_id, completada, peso_kg, repeticiones')
      .in('sesion_id', sesiones.map((s) => s.id))

    if (seriesError) {
      console.error('Error obteniendo series del historial:', seriesError)
      return { success: false, error: 'Error al cargar el historial' }
    }

    const porSesion: Record<string, { hechas: number; totales: number; kg: number }> = {}
    for (const fila of series || []) {
      const acc = (porSesion[fila.sesion_id] ??= { hechas: 0, totales: 0, kg: 0 })
      acc.totales += 1
      if (fila.completada) {
        acc.hechas += 1
        if (fila.peso_kg !== null && fila.repeticiones !== null) {
          acc.kg += Number(fila.peso_kg) * fila.repeticiones
        }
      }
    }

    const resumen: SesionResumen[] = sesiones.map((s) => {
      const rd = s.rutina_dias as unknown as { nombre_dia: string; orden: number } | null
      const acc = porSesion[s.id] ?? { hechas: 0, totales: 0, kg: 0 }
      return {
        id: s.id,
        dia_nombre: rd ? `Día ${rd.orden} — ${rd.nombre_dia}` : '',
        dia_orden: rd?.orden ?? null,
        nombre_dia: rd?.nombre_dia ?? '',
        iniciada_at: (s.iniciada_at as string | null) ?? null,
        finalizada_at: s.finalizada_at as string,
        series_completadas: acc.hechas,
        series_totales: acc.totales,
        kg_movidos: Math.round(acc.kg),
      }
    })

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
      .select('id, dia_id, finalizada_at, rutina_dias(nombre_dia, orden)')
      .eq('id', sesionId)
      .eq('user_id', userId)             // ← NUEVO
      .not('finalizada_at', 'is', null)
      .single()

    if (sesionError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    const rutinaDia = sesion.rutina_dias as unknown as { nombre_dia: string; orden: number } | null
    const diaNombre = rutinaDia ? `Día ${rutinaDia.orden} — ${rutinaDia.nombre_dia}` : ''

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
    // Verificar ownership antes de tocar datos relacionados
    const { data: sesion, error: ownerError } = await supabase
      .from('sesiones')
      .select('id')
      .eq('id', sesionId)
      .eq('user_id', userId)
      .maybeSingle()

    if (ownerError || !sesion) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    // Ownership confirmado — eliminar series primero (evita FK violation si no hay CASCADE)
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
