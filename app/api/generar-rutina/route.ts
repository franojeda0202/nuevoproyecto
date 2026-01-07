import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/generar-rutina'
    
    // Configurar headers de autenticación si están disponibles
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // Header Auth - configuración flexible
    // Puedes usar N8N_HEADER_NAME y N8N_HEADER_VALUE para cualquier header
    if (process.env.N8N_HEADER_NAME && process.env.N8N_HEADER_VALUE) {
      headers[process.env.N8N_HEADER_NAME] = process.env.N8N_HEADER_VALUE
    }
    
    // Si hay autenticación configurada, agregarla
    // Opción 1: Basic Auth (usuario:contraseña)
    if (process.env.N8N_AUTH_USER && process.env.N8N_AUTH_PASSWORD) {
      const auth = Buffer.from(`${process.env.N8N_AUTH_USER}:${process.env.N8N_AUTH_PASSWORD}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }
    
    // Opción 2: API Key - Si el valor incluye "Bearer", va en Authorization, sino en header personalizado
    if (process.env.N8N_API_KEY) {
      const apiKeyValue = process.env.N8N_API_KEY.trim()
      // Si el valor ya incluye "Bearer", usar Authorization header directamente
      if (apiKeyValue.startsWith('Bearer ')) {
        headers['Authorization'] = apiKeyValue
      } else {
        // Si no, usar el header que especifiques o uno por defecto
        const headerName = process.env.N8N_API_HEADER_NAME || 'X-N8N-API-KEY'
        headers[headerName] = apiKeyValue
      }
    }
    
    // Opción 3: Token Bearer
    if (process.env.N8N_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.N8N_TOKEN}`
    }
    
    console.log('🚀 [API Route] Llamando a n8n:', n8nWebhookUrl)
    console.log('📦 [API Route] Body:', JSON.stringify(body, null, 2))
    console.log('🔐 [API Route] Headers:', Object.keys(headers).filter(k => k !== 'Authorization' || headers[k]?.toString().substring(0, 10)))

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    console.log('📥 [API Route] Status:', response.status)
    console.log('📥 [API Route] Content-Type:', response.headers.get('content-type'))

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Error desconocido')
      console.error('❌ [API Route] Error:', response.status, errorText)
      return NextResponse.json(
        { error: `Error del servidor (${response.status}): ${errorText}` },
        { status: response.status }
      )
    }

    // Obtener el texto de la respuesta primero
    const responseText = await response.text()
    console.log('📄 [API Route] Respuesta raw:', responseText.substring(0, 500)) // Primeros 500 caracteres
    
    // Verificar si la respuesta está vacía
    if (!responseText || responseText.trim() === '') {
      console.warn('⚠️ [API Route] Respuesta vacía de n8n')
      return NextResponse.json(
        { error: 'El servidor de n8n respondió con un cuerpo vacío. Verifica que el flujo esté retornando datos correctamente.' },
        { status: 500 }
      )
    }

    // Intentar parsear como JSON
    let data
    try {
      data = JSON.parse(responseText)
      console.log('✅ [API Route] Respuesta parseada exitosamente')
    } catch (jsonError) {
      console.error('❌ [API Route] Error parseando JSON:', jsonError)
      console.error('📄 [API Route] Respuesta completa:', responseText)
      return NextResponse.json(
        { 
          error: 'El servidor respondió pero con un formato inválido. Verifica que el flujo de n8n esté retornando JSON válido.',
          details: responseText.substring(0, 200) // Primeros 200 caracteres para debug
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ [API Route] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

