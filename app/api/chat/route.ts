import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatMessage } from '@/lib/types/chat'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@/lib/supabase/server'
import { trackEventServer, trackErrorServer } from '@/lib/analytics-server'
import { checkRateLimit, RATE_LIMIT } from '@/lib/rate-limit'

// Leer system prompt desde archivo
const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'lib', 'prompts', 'system-prompt.txt'),
  'utf-8'
).trim()

const MODEL = 'gpt-4o-mini'
const GENERIC_CHAT_ERROR = 'No se pudo procesar tu mensaje. Intenta de nuevo en unos momentos.'

export async function POST(request: NextRequest) {
  let userId: string | null = null

  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    userId = session?.user?.id || null

    // Rate limit por usuario (o por IP si no hay sesión, usando un fallback)
    const rateKey = userId ? `chat:${userId}` : `chat:anon:${request.headers.get('x-forwarded-for') || 'unknown'}`
    const { limit, windowMs } = RATE_LIMIT.CHAT
    const rate = checkRateLimit(rateKey, limit, windowMs)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Has enviado muchos mensajes. Espera un minuto antes de continuar.' },
        { status: 429 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[chat] OPENAI_API_KEY no configurada')
      if (userId) trackErrorServer(userId, 'api/chat', 'OPENAI_API_KEY missing')
      return NextResponse.json(
        { error: GENERIC_CHAT_ERROR },
        { status: 500 }
      )
    }

    // Parsear body
    const body = await request.json()
    const { messages } = body as { messages: ChatMessage[] }

    // Validar mensajes
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Debes enviar al menos un mensaje' },
        { status: 400 }
      )
    }

    // Validar estructura de mensajes
    for (const msg of messages) {
      if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Formato de mensaje inválido' },
          { status: 400 }
        )
      }
    }

    // Tomar últimos 5-6 mensajes para mantener contexto sin exceder tokens
    const recentMessages = messages.slice(-6)

    // Preparar mensajes para OpenAI (system prompt + historial)
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      ...recentMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ]


    // Inicializar cliente OpenAI
    const openai = new OpenAI({
      apiKey: apiKey
    })

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: openaiMessages,
      max_tokens: 300,
      temperature: 0.7
    })

    const assistantMessage = completion.choices[0]?.message?.content

    if (!assistantMessage) {
      throw new Error('OpenAI no retornó una respuesta')
    }

    // Extraer usage para tracking
    const usage = completion.usage


    // Track evento con consumo de tokens (fire-and-forget, no añade latencia)
    if (userId) {
      trackEventServer(userId, 'chat_interaccion', {
        usage: usage ? {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens
        } : null,
        model: MODEL,
        messages_count: recentMessages.length
      })
    }

    // Retornar respuesta
    const response: ChatMessage = {
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date()
    }

    return NextResponse.json({ message: response })
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[chat]', rawMessage)

    if (userId) {
      trackErrorServer(userId, 'api/chat', rawMessage, {
        error_type: error instanceof OpenAI.APIError ? 'openai_api_error' : 'generic_error',
      })
    }

    // No exponer detalles sensibles al frontend
    const status = error instanceof OpenAI.APIError ? (error.status || 500) : 500
    return NextResponse.json(
      { error: GENERIC_CHAT_ERROR },
      { status }
    )
  }
}
