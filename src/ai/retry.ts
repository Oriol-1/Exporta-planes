// src/ai/retry.ts
// Reintento con espera para fallos TRANSITORIOS del proveedor.
//
// Hace falta de verdad con las capas gratuitas: sirven desde un pool compartido
// y devuelven `429 … temporarily rate-limited upstream` con un `Retry-After` de
// unos segundos. No es un error del que haya que rendirse, es la forma normal de
// funcionar de un recurso compartido — pero tampoco se puede reintentar en
// bucle, porque entonces un proveedor caído se convierte en una espera infinita.
//
// Lo que NO se reintenta nunca está en `isProviderDown` (§7.7): sin saldo, clave
// inválida o sin permiso sobre el modelo no se arreglan esperando.

/** Cuánto pide esperar el proveedor, si lo dice. En milisegundos. */
export function retryAfterMs(error: unknown): number | undefined {
  const e = error as {
    error?: { metadata?: { retry_after_seconds?: number } }
    headers?: { get?: (k: string) => string | null }
  }

  // OpenRouter lo manda dentro de `error.metadata`.
  const segundos = e?.error?.metadata?.retry_after_seconds
  if (typeof segundos === 'number' && segundos > 0) return segundos * 1000

  // El resto, en la cabecera estándar.
  const cabecera = e?.headers?.get?.('retry-after')
  if (cabecera) {
    const n = Number(cabecera)
    if (Number.isFinite(n) && n > 0) return n * 1000
  }

  return undefined
}

/** ¿Es un fallo del que tiene sentido recuperarse esperando? */
export function isTransient(error: unknown): boolean {
  const e = error as { status?: number; code?: string; type?: string }

  // Sin saldo o sin permiso: esperar no arregla nada.
  if (e?.type === 'insufficient_quota') return false
  if (e?.code === 'credit_balance_exhausted' || e?.code === 'invalid_api_key') return false
  if (e?.status === 401 || e?.status === 403) return false

  // Límite de ritmo o fallo del servidor: sí.
  if (e?.status === 429) return true
  if (typeof e?.status === 'number' && e.status >= 500) return true

  // Un corte de red no trae estado.
  return e?.status === undefined
}

export interface RetryOptions {
  /** Intentos totales, incluido el primero. */
  readonly attempts?: number
  /** Espera base cuando el proveedor no dice cuánto esperar. */
  readonly baseDelayMs?: number
  /** Techo de espera por intento: nadie duerme más de esto. */
  readonly maxDelayMs?: number
  /** Se avisa antes de cada espera, para que el CLI pueda decirlo. */
  readonly onRetry?: (intento: number, esperaMs: number, error: unknown) => void
  readonly sleep?: (ms: number) => Promise<void>
}

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Ejecuta `fn`, reintentando los fallos transitorios.
 *
 * Respeta el `Retry-After` del proveedor cuando lo hay: esperar lo que te piden
 * es más rápido y más educado que un retroceso exponencial a ciegas.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 4
  const base = options.baseDelayMs ?? 2000
  const max = options.maxDelayMs ?? 30_000
  const sleep = options.sleep ?? dormir

  let ultimo: unknown
  for (let intento = 1; intento <= attempts; intento++) {
    try {
      return await fn()
    } catch (error) {
      ultimo = error
      if (intento === attempts || !isTransient(error)) throw error

      // Lo que pide el proveedor manda; si no dice nada, retroceso exponencial.
      const espera = Math.min(retryAfterMs(error) ?? base * 2 ** (intento - 1), max)
      options.onRetry?.(intento, espera, error)
      await sleep(espera)
    }
  }
  throw ultimo
}
