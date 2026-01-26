import { createClient } from '@/lib/supabase/client'

/**
 * Sistema de tracking de eventos de producto (Client-side)
 * 
 * Utiliza patrón fire-and-forget para no bloquear el hilo principal.
 * Los errores se registran silenciosamente sin afectar la UX.
 * 
 * Para tracking server-side, usar lib/analytics-server.ts
 */

type EventProperties = Record<string, unknown>

/**
 * Trackea un evento de producto en la tabla user_events
 * 
 * @param eventName - Nombre del evento (ej: 'rutina_generada', 'chat_interaccion')
 * @param properties - Propiedades adicionales del evento (opcional)
 * 
 * @example
 * trackEvent('rutina_generada', { dias: 4, objetivo: 'hipertrofia' })
 * trackEvent('chat_interaccion')
 * trackEvent('error_sistema', { origen: 'api/chat', mensaje: 'Rate limit exceeded' })
 */
export function trackEvent(eventName: string, properties?: EventProperties): void {
  // Fire-and-forget: ejecutamos sin await para no bloquear
  (async () => {
    try {
      const supabase = createClient()
      
      // Obtener sesión del usuario
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.warn('[Analytics] Error obteniendo sesión:', sessionError.message)
        return
      }
      
      // Sin usuario autenticado, no trackeamos
      if (!session?.user?.id) {
        console.debug('[Analytics] Sin usuario autenticado, evento ignorado:', eventName)
        return
      }

      // Insertar evento en la base de datos
      const { error: insertError } = await supabase
        .from('user_events')
        .insert({
          user_id: session.user.id,
          event_name: eventName,
          properties: properties || {},
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.warn('[Analytics] Error insertando evento:', insertError.message)
        return
      }

      console.debug('[Analytics] Evento trackeado:', eventName)
    } catch (error) {
      // Silencioso - el tracking nunca debe romper la app
      console.warn('[Analytics] Error inesperado:', error instanceof Error ? error.message : 'Unknown error')
    }
  })()
}

/**
 * Helper para trackear errores del sistema
 * Wrapper conveniente para eventos de tipo error
 */
export function trackError(origen: string, mensaje: string, extra?: EventProperties): void {
  trackEvent('error_sistema', {
    origen,
    mensaje,
    ...extra
  })
}
