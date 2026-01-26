import { createClient } from '@/lib/supabase/server'

/**
 * Sistema de tracking de eventos de producto (Server-side)
 * 
 * Para uso en Route Handlers, Server Actions y Server Components.
 * Utiliza el cliente de Supabase para servidor.
 * 
 * Para tracking client-side, usar lib/analytics.ts
 */

type EventProperties = Record<string, unknown>

/**
 * Trackea un evento desde el servidor (Route Handlers, Server Actions)
 * 
 * A diferencia de trackEvent (client-side), esta función:
 * - Usa el cliente de Supabase para servidor
 * - Requiere que se le pase el userId explícitamente
 * - Es async pero se puede llamar sin await (fire-and-forget)
 * 
 * @param userId - ID del usuario (UUID)
 * @param eventName - Nombre del evento
 * @param properties - Propiedades adicionales del evento
 * 
 * @example
 * // Fire-and-forget desde un Route Handler
 * trackEventServer(userId, 'chat_interaccion', { 
 *   usage: { prompt: 120, completion: 50, total: 170 },
 *   model: 'gpt-4o-mini'
 * })
 */
export function trackEventServer(
  userId: string,
  eventName: string, 
  properties?: EventProperties
): void {
  // Fire-and-forget
  (async () => {
    try {
      if (!userId) {
        console.debug('[Analytics:Server] Sin userId, evento ignorado:', eventName)
        return
      }

      const supabase = await createClient()

      const { error: insertError } = await supabase
        .from('user_events')
        .insert({
          user_id: userId,
          event_name: eventName,
          properties: properties || {},
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.warn('[Analytics:Server] Error insertando evento:', insertError.message)
        return
      }

      console.debug('[Analytics:Server] Evento trackeado:', eventName)
    } catch (error) {
      console.warn('[Analytics:Server] Error inesperado:', error instanceof Error ? error.message : 'Unknown error')
    }
  })()
}

/**
 * Helper para trackear errores desde el servidor
 */
export function trackErrorServer(
  userId: string,
  origen: string, 
  mensaje: string, 
  extra?: EventProperties
): void {
  trackEventServer(userId, 'error_sistema', {
    origen,
    mensaje,
    ...extra
  })
}
