import { SupabaseClient } from '@supabase/supabase-js'
import {
  ResultadoOperacion,
  MetricasResumen,
  PRejercicio,
  EjercicioRutinaActiva,
} from '@/lib/types/database'
import { isValidUUID } from './rutina-service'

/**
 * Calcular el inicio de semana (lunes) para una fecha dada.
 * JS: getDay() retorna 0=domingo, 1=lunes, ..., 6=sábado
 */
function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day  // ajuste para que lunes=inicio
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Calcular racha de semanas consecutivas con ≥1 sesión.
 * La semana en curso (que incluye "hoy") siempre cuenta —
 * si el usuario no entrenó esta semana pero entrenó las anteriores,
 * la racha incluye esas semanas previas (la semana actual no está rota aún).
 */
function calcularRacha(fechasFinalizadas: string[]): number {
  if (fechasFinalizadas.length === 0) return 0

  // Convertir a timestamps de inicio de semana (lunes)
  const semanasEntrenadas = new Set(
    fechasFinalizadas.map(f => inicioSemana(new Date(f)).getTime())
  )

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let semanaActual = inicioSemana(hoy)
  let racha = 0

  // Empezamos desde la semana actual hacia atrás.
  // Si la semana actual no tiene sesión, la saltamos (no rompe la racha).
  // Si una semana anterior no tiene sesión, la racha se corta.
  let primeraIteracion = true

  while (true) {
    const tieneEntrenamiento = semanasEntrenadas.has(semanaActual.getTime())

    if (!tieneEntrenamiento) {
      // La semana actual sin entrenamiento no rompe la racha (es la primera iteración)
      if (primeraIteracion) {
        // Avanzar a la semana anterior sin sumar racha
        semanaActual = new Date(semanaActual.getTime() - 7 * 24 * 60 * 60 * 1000)
        primeraIteracion = false
        // Verificar si la semana anterior tampoco tiene datos → racha = 0
        if (!semanasEntrenadas.has(semanaActual.getTime())) return 0
        continue
      }
      // Una semana anterior sin entrenamiento → racha terminada
      break
    }

    racha++
    primeraIteracion = false
    semanaActual = new Date(semanaActual.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  return racha
}

/**
 * Obtener todas las métricas de resumen para la pantalla de Métricas.
 * Todas las queries son routine-agnostic (sin filtro por rutina_id).
 */
export async function obtenerMetricasResumen(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<MetricasResumen>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    const ahora = new Date()
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const inicioMesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString()
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).toISOString()

    // Queries en paralelo (solo las que no dependen de resultados intermedios)
    const [sesionesActualResult, sesionesAnteriorResult, todasSesionesResult] =
      await Promise.all([
        // Sesiones mes actual
        supabase
          .from('sesiones')
          .select('id, iniciada_at, finalizada_at')
          .eq('user_id', userId)
          .gte('finalizada_at', inicioMesActual)
          .lt('finalizada_at', inicioMesSiguiente)
          .not('finalizada_at', 'is', null),

        // Sesiones mes anterior (solo count)
        supabase
          .from('sesiones')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('finalizada_at', inicioMesAnterior)
          .lt('finalizada_at', inicioMesActual)
          .not('finalizada_at', 'is', null),

        // Todas las sesiones finalizadas (para racha)
        supabase
          .from('sesiones')
          .select('finalizada_at')
          .eq('user_id', userId)
          .not('finalizada_at', 'is', null)
          .order('finalizada_at', { ascending: false }),
      ])

    if (sesionesActualResult.error) throw sesionesActualResult.error
    if (sesionesAnteriorResult.error) throw sesionesAnteriorResult.error
    if (todasSesionesResult.error) throw todasSesionesResult.error

    const sesionesActual = sesionesActualResult.data ?? []
    const sesionIds = sesionesActual.map(s => s.id)

    // Fetch series del mes actual (requiere sesionIds del paso anterior)
    let totalSeries = 0
    let completadas = 0
    if (sesionIds.length > 0) {
      const { data: series, error: seriesError } = await supabase
        .from('sesion_series')
        .select('completada')
        .in('sesion_id', sesionIds)

      if (seriesError) throw seriesError
      totalSeries = series?.length ?? 0
      completadas = series?.filter(s => s.completada).length ?? 0
    }

    // Duración promedio (en minutos)
    const sesionesConDuracion = sesionesActual.filter(
      s => s.iniciada_at && s.finalizada_at
    )
    let duracionPromedioMinutos: number | null = null
    if (sesionesConDuracion.length > 0) {
      const totalMs = sesionesConDuracion.reduce((acc, s) => {
        return acc + (new Date(s.finalizada_at!).getTime() - new Date(s.iniciada_at!).getTime())
      }, 0)
      duracionPromedioMinutos = Math.round(totalMs / sesionesConDuracion.length / 60000)
    }

    // Racha
    const todasFechas = (todasSesionesResult.data ?? []).map(s => s.finalizada_at as string)
    const rachaActual = calcularRacha(todasFechas)

    // Días entrenados este mes (ISO "YYYY-MM-DD" en hora LOCAL del usuario).
    // No usar toISOString() — retorna UTC y en timezones negativas (ej: Argentina UTC-3)
    // un entreno a las 23:30 locales aparecería en el día siguiente en UTC.
    const diasEntrenadosEsteMes = sesionesActual
      .filter(s => s.finalizada_at)
      .map(s => {
        const d = new Date(s.finalizada_at!)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })

    return {
      success: true,
      data: {
        entrenamientosEsteMes: sesionesActual.length,
        entrenamientosMesPasado: sesionesAnteriorResult.count ?? 0,
        rachaActual,
        duracionPromedioMinutos,
        porcentajeSeriesCompletadas: totalSeries > 0
          ? Math.round((completadas / totalSeries) * 100)
          : null,
        diasEntrenadosEsteMes,
      },
    }
  } catch (err) {
    console.error('Error en obtenerMetricasResumen:', err)
    return { success: false, error: 'Error al cargar métricas' }
  }
}

/**
 * Obtener el PR (mejor peso × reps) histórico para un array de ejercicio_ids.
 * No resuelve nombres — el caller ya los tiene desde obtenerEjerciciosRutinaActiva.
 * Usa LEFT JOIN en rutina_ejercicios para sobrevivir al orphan cleanup de rutinas.
 */
export async function obtenerPRsEjercicios(
  supabase: SupabaseClient,
  userId: string,
  ejercicioIds: string[]
): Promise<ResultadoOperacion<PRejercicio[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }
  if (ejercicioIds.length === 0) return { success: true, data: [] }

  try {
    // Supabase JS no soporta LEFT JOIN nativo en .from().select()
    // Usamos rpc o query directa con .rpc(), pero la forma más simple es
    // hacer el query en dos partes: primero obtener sesion_series del usuario,
    // luego cruzar con rutina_ejercicios para obtener el ejercicio_id.
    //
    // Alternativa: usar .from('sesion_series') con join embebido que Supabase sí permite
    // cuando hay FK en ambos lados. La tabla sesion_series tiene FK a rutina_ejercicios.
    // Supabase auto-resuelve el join con !inner por defecto, usamos el nombre de la FK.

    const { data, error } = await supabase
      .from('sesion_series')
      .select(`
        completada,
        peso_kg,
        repeticiones,
        rutina_ejercicios!left (
          ejercicio_id
        ),
        sesiones!inner (
          user_id
        )
      `)
      .eq('sesiones.user_id', userId)
      .eq('completada', true)
      .not('peso_kg', 'is', null)
      .not('repeticiones', 'is', null)
      .in('rutina_ejercicios.ejercicio_id', ejercicioIds)
      .order('peso_kg', { ascending: false })
      .order('repeticiones', { ascending: false })

    if (error) throw error

    // Agrupar: un PR por ejercicio_id (la primera fila ya es la mejor por el ORDER BY)
    const prMap = new Map<string, PRejercicio>()
    for (const row of data ?? []) {
      const ejId = (row.rutina_ejercicios as unknown as { ejercicio_id: string } | null)?.ejercicio_id
      if (!ejId || !ejercicioIds.includes(ejId)) continue
      if (prMap.has(ejId)) continue  // ya tenemos el PR para este ejercicio
      prMap.set(ejId, {
        ejercicioId: ejId,
        pesoKg: row.peso_kg as number,
        repeticiones: row.repeticiones as number,
      })
    }

    return { success: true, data: Array.from(prMap.values()) }
  } catch (err) {
    console.error('Error en obtenerPRsEjercicios:', err)
    return { success: false, error: 'Error al cargar PRs' }
  }
}

/**
 * Obtener ejercicios únicos de la rutina más reciente del usuario.
 * Retorna lista vacía (sin error) si el usuario no tiene rutinas.
 */
export async function obtenerEjerciciosRutinaActiva(
  supabase: SupabaseClient,
  userId: string
): Promise<ResultadoOperacion<EjercicioRutinaActiva[]>> {
  if (!isValidUUID(userId)) return { success: false, error: 'ID inválido' }

  try {
    // Rutina más reciente
    const { data: rutina, error: rutinaError } = await supabase
      .from('rutinas')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rutinaError) throw rutinaError
    if (!rutina) return { success: true, data: [] }

    // Ejercicios de todos los días de la rutina
    const { data: rows, error: rowsError } = await supabase
      .from('rutina_ejercicios')
      .select(`
        ejercicio_id,
        rutina_dias!inner (
          rutina_id
        ),
        ejercicios:ejercicio_id (
          nombre,
          patron_movimiento
        )
      `)
      .eq('rutina_dias.rutina_id', rutina.id)

    if (rowsError) throw rowsError

    // Deduplicar por ejercicio_id, contar frecuencia (días distintos que lo incluyen)
    const frecMap = new Map<string, { nombre: string; esCompuesto: boolean; count: number }>()
    for (const row of rows ?? []) {
      const ejId = row.ejercicio_id as string
      const ej = row.ejercicios as unknown as { nombre: string; patron_movimiento: string } | null
      if (!ej || !ejId) continue
      const esCompuesto = ['push', 'pull', 'rodilla', 'cadera'].includes(ej.patron_movimiento)
      const existing = frecMap.get(ejId)
      if (existing) {
        existing.count++
      } else {
        frecMap.set(ejId, { nombre: ej.nombre, esCompuesto, count: 1 })
      }
    }

    const resultado: EjercicioRutinaActiva[] = Array.from(frecMap.entries()).map(([id, val]) => ({
      ejercicioId: id,
      nombre: val.nombre,
      esCompuesto: val.esCompuesto,
      frecuencia: val.count,
    }))

    return { success: true, data: resultado }
  } catch (err) {
    console.error('Error en obtenerEjerciciosRutinaActiva:', err)
    return { success: false, error: 'Error al cargar ejercicios de rutina' }
  }
}
