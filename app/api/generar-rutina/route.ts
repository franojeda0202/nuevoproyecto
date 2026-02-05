import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackErrorServer } from '@/lib/analytics-server'
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'

const GENERIC_ERROR_MESSAGE = 'No se pudo generar la rutina. Intenta de nuevo en unos minutos.'

export async function POST(request: NextRequest) {
  let userId: string | null = null

  try {
    const body = await request.json()
    const bodyUserId = body?.user_id as string | undefined

    if (!bodyUserId) {
      return NextResponse.json(
        { error: 'Solicitud inválida' },
        { status: 400 }
      )
    }

    // Verificar sesión y que el user_id del body coincida con el usuario autenticado
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para generar una rutina' },
        { status: 401 }
      )
    }
    if (session.user.id !== bodyUserId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    userId = session.user.id

    // Rate limit: 2 rutinas por minuto por usuario
    const { limit, windowMs } = RATE_LIMIT.GENERAR_RUTINA
    const rate = checkRateLimit(`generar-rutina:${userId}`, limit, windowMs)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de generación. Espera un minuto antes de intentar de nuevo.' },
        { status: 429 }
      )
    }

    const n8nWebhookUrl =
      process.env.N8N_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ||
      'http://localhost:5678/webhook-test/generar-rutina'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Header de seguridad para el webhook (producción)
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET
    if (webhookSecret) {
      headers['x-webhook-secret'] = webhookSecret
    }

    if (process.env.N8N_HEADER_NAME && process.env.N8N_HEADER_VALUE) {
      headers[process.env.N8N_HEADER_NAME] = process.env.N8N_HEADER_VALUE
    }
    if (process.env.N8N_AUTH_USER && process.env.N8N_AUTH_PASSWORD) {
      const auth = Buffer.from(`${process.env.N8N_AUTH_USER}:${process.env.N8N_AUTH_PASSWORD}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }
    if (process.env.N8N_API_KEY) {
      const apiKeyValue = process.env.N8N_API_KEY.trim()
      if (apiKeyValue.startsWith('Bearer ')) {
        headers['Authorization'] = apiKeyValue
      } else {
        const headerName = process.env.N8N_API_HEADER_NAME || 'X-N8N-API-KEY'
        headers[headerName] = apiKeyValue
      }
    }
    if (process.env.N8N_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.N8N_TOKEN}`
    }

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[generar-rutina] n8n error:', response.status, errorText?.substring(0, 200))
      if (userId) {
        trackErrorServer(userId, 'api/generar-rutina', `n8n ${response.status}: ${errorText?.substring(0, 100)}`, {
          status: response.status,
        })
      }
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: response.status >= 500 ? 502 : response.status }
      )
    }

    const responseText = await response.text()
    if (!responseText?.trim()) {
      if (userId) trackErrorServer(userId, 'api/generar-rutina', 'n8n respuesta vacía')
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      )
    }

    let data: unknown
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('[generar-rutina] Respuesta no JSON')
      if (userId) trackErrorServer(userId, 'api/generar-rutina', 'n8n respuesta no JSON')
      return NextResponse.json(
        { error: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[generar-rutina]', message)
    if (userId) {
      trackErrorServer(userId, 'api/generar-rutina', message, {
        error_type: 'exception',
      })
    }
    return NextResponse.json(
      { error: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    )
  }
}
