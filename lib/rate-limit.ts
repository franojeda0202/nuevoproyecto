/**
 * Rate limiter in-memory (simple, single-instance).
 * Para producción multi-instancia considerar Redis/Vercel KV.
 */

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Limpiar entradas expiradas cada minuto
const CLEANUP_INTERVAL_MS = 60_000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref()
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Comprueba si la petición está dentro del límite.
 * @param key - Identificador único (ej: userId, ip)
 * @param limit - Número máximo de peticiones en la ventana
 * @param windowMs - Ventana en milisegundos
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  ensureCleanup()
  const now = Date.now()
  let entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt }
  }

  entry.count += 1
  const remaining = Math.max(0, limit - entry.count)
  const allowed = entry.count <= limit

  return { allowed, remaining, resetAt: entry.resetAt }
}

export const RATE_LIMIT = {
  /** 2 rutinas por minuto por usuario */
  GENERAR_RUTINA: { limit: 2, windowMs: 60_000 },
  /** 30 mensajes de chat por minuto por usuario */
  CHAT: { limit: 30, windowMs: 60_000 },
} as const
