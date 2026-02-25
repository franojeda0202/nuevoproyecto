import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackErrorServer } from '@/lib/analytics-server'
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'

const GENERIC_ERROR_MESSAGE = 'No se pudo generar la rutina. Intenta de nuevo en unos minutos.'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function buildUserPrompt(userId: string, config: Record<string, unknown>, ejercicios: unknown[]): string {
  return `Actúa como GymLogic AI. Diseña una rutina de alta optimización biomecánica.

DATOS DEL USUARIO:
- USER_ID: ${userId}
- CONFIGURACIÓN: ${JSON.stringify(config)}

LISTA DE EJERCICIOS DISPONIBLES (USA SOLO ESTOS IDs):
${JSON.stringify(ejercicios)}

INSTRUCCIÓN CRÍTICA DE IDs:
Revisa cada 'ejercicio_id' generado. Si no es un UUID de la lista anterior, bórralo y elige un ejercicio que SÍ tenga un UUID válido de la lista. No inventes datos.

El campo "user_id" en el JSON final debe ser: ${userId}`
}

export async function POST(request: NextRequest) {
  let userId: string | null = null

  try {
    const body = await request.json()
    const bodyUserId = body?.user_id as string | undefined

    if (!bodyUserId) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    // Verificar sesión
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para generar una rutina' },
        { status: 401 }
      )
    }
    if (session.user.id !== bodyUserId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    userId = session.user.id

    // Rate limit
    const { limit, windowMs } = RATE_LIMIT.GENERAR_RUTINA
    const rate = checkRateLimit(`generar-rutina:${userId}`, limit, windowMs)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de generación. Espera un minuto antes de intentar de nuevo.' },
        { status: 429 }
      )
    }

    // 1. Obtener todos los ejercicios disponibles
    const { data: ejercicios, error: ejerciciosError } = await supabase
      .from('ejercicios')
      .select('*')

    if (ejerciciosError || !ejercicios?.length) {
      console.error('[generar-rutina] Error obteniendo ejercicios:', ejerciciosError)
      trackErrorServer(userId, 'api/generar-rutina', 'Error obteniendo ejercicios')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    // 2. Leer system prompt
    const systemPrompt = readFileSync(
      join(process.cwd(), 'lib/prompts/system-prompt-rutina.txt'),
      'utf-8'
    )

    // 3. Llamar a OpenAI
    const config = body.config as Record<string, unknown>
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(userId, config, ejercicios) },
      ],
    })

    const rawOutput = completion.choices[0]?.message?.content
    if (!rawOutput) {
      trackErrorServer(userId, 'api/generar-rutina', 'OpenAI respuesta vacía')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    let rutinaGenerada: {
      nombre_rutina: string
      dias: Array<{
        nombre_dia: string
        orden: number
        ejercicios: Array<{
          ejercicio_id: string
          series: number
          reps: string
          orden: number
          notas: string | null
        }>
      }>
    }

    try {
      rutinaGenerada = JSON.parse(rawOutput)
    } catch {
      console.error('[generar-rutina] OpenAI respuesta no es JSON válido')
      trackErrorServer(userId, 'api/generar-rutina', 'OpenAI respuesta no JSON')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    // 4. INSERT rutina
    const { data: rutina, error: rutinaError } = await supabase
      .from('rutinas')
      .insert({
        nombre: rutinaGenerada.nombre_rutina,
        user_id: userId,
        frecuencia: config.frecuencia as number,
      })
      .select('id')
      .single()

    if (rutinaError || !rutina) {
      console.error('[generar-rutina] Error creando rutina:', rutinaError)
      trackErrorServer(userId, 'api/generar-rutina', 'Error creando rutina en Supabase')
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
    }

    // 5. INSERT rutina_dias y rutina_ejercicios secuencialmente
    for (const dia of rutinaGenerada.dias) {
      const { data: rutinaDia, error: diaError } = await supabase
        .from('rutina_dias')
        .insert({
          rutina_id: rutina.id,
          nombre_dia: dia.nombre_dia,
          orden: dia.orden,
        })
        .select('id')
        .single()

      if (diaError || !rutinaDia) {
        console.error('[generar-rutina] Error creando día:', diaError)
        trackErrorServer(userId, 'api/generar-rutina', 'Error creando día en Supabase')
        return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
      }

      const ejerciciosDelDia = dia.ejercicios.map((ej, index) => ({
        dia_id: rutinaDia.id,
        ejercicio_id: ej.ejercicio_id,
        series: ej.series,
        repeticiones: ej.reps,
        orden: index + 1,
        notas_coach: ej.notas ?? null,
      }))

      const { error: ejerciciosInsertError } = await supabase
        .from('rutina_ejercicios')
        .insert(ejerciciosDelDia)

      if (ejerciciosInsertError) {
        console.error('[generar-rutina] Error creando ejercicios:', ejerciciosInsertError)
        trackErrorServer(userId, 'api/generar-rutina', 'Error creando ejercicios en Supabase')
        return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
      }
    }

    return NextResponse.json({
      status: 'success',
      rutina_id: rutina.id,
      user_id: userId,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[generar-rutina]', message)
    if (userId) {
      trackErrorServer(userId, 'api/generar-rutina', message, { error_type: 'exception' })
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
  }
}
