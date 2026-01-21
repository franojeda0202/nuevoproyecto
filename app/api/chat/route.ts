import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatMessage } from '@/lib/types/chat'
import { readFileSync } from 'fs'
import { join } from 'path'

// Leer system prompt desde archivo
const SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), 'lib', 'prompts', 'system-prompt.txt'),
  'utf-8'
).trim()

export async function POST(request: NextRequest) {
  try {
    // Verificar API Key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
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

    console.log(`📤 Enviando ${recentMessages.length} mensajes a OpenAI`)

    // Inicializar cliente OpenAI
    const openai = new OpenAI({
      apiKey: apiKey
    })

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 300,
      temperature: 0.7
    })

    const assistantMessage = completion.choices[0]?.message?.content

    if (!assistantMessage) {
      throw new Error('OpenAI no retornó una respuesta')
    }

    console.log('✅ Respuesta recibida de OpenAI')

    // Retornar respuesta
    const response: ChatMessage = {
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date()
    }

    return NextResponse.json({ message: response })
  } catch (error) {
    console.error('❌ Error en API chat:', error)

    // Manejar errores específicos de OpenAI
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `Error de OpenAI: ${error.message}` },
        { status: error.status || 500 }
      )
    }

    // Error genérico
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
