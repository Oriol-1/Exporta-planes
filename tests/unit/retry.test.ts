// Reintento con espera para fallos transitorios.
//
// Hace falta de verdad con las capas gratuitas: sirven desde un pool compartido
// y devuelven `429 … temporarily rate-limited upstream` con un Retry-After de
// unos segundos. Comprobado contra OpenRouter.
import { describe, expect, it, vi } from 'vitest'
import { isTransient, retryAfterMs, withRetry } from '../../src/ai/retry'

const err = (extra: Record<string, unknown>): Error => Object.assign(new Error('fallo'), extra)

describe('isTransient', () => {
  it('un límite de ritmo o un fallo del servidor SÍ se reintentan', () => {
    expect(isTransient(err({ status: 429 }))).toBe(true)
    expect(isTransient(err({ status: 500 }))).toBe(true)
    expect(isTransient(err({ status: 503 }))).toBe(true)
  })

  it('un corte de red también', () => {
    expect(isTransient(new Error('socket hang up'))).toBe(true)
  })

  it('sin saldo, clave inválida o sin permiso NO se reintentan', () => {
    // Esperar no arregla ninguno de los tres.
    expect(isTransient(err({ status: 429, type: 'insufficient_quota' }))).toBe(false)
    expect(isTransient(err({ status: 429, code: 'credit_balance_exhausted' }))).toBe(false)
    expect(isTransient(err({ status: 401 }))).toBe(false)
    expect(isTransient(err({ status: 403 }))).toBe(false)
  })
})

describe('retryAfterMs', () => {
  it('lee el retry_after_seconds que manda OpenRouter', () => {
    expect(retryAfterMs(err({ error: { metadata: { retry_after_seconds: 5 } } }))).toBe(5000)
  })

  it('lee la cabecera Retry-After estándar', () => {
    expect(retryAfterMs(err({ headers: { get: (k: string) => (k === 'retry-after' ? '12' : null) } }))).toBe(12_000)
  })

  it('devuelve undefined si el proveedor no dice nada', () => {
    expect(retryAfterMs(err({ status: 429 }))).toBeUndefined()
  })
})

describe('withRetry', () => {
  it('devuelve el resultado al primer intento cuando no hay fallo', async () => {
    const fn = vi.fn().mockResolvedValue('bien')
    expect(await withRetry(fn, { sleep: () => Promise.resolve() })).toBe('bien')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('reintenta un transitorio y acaba acertando', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(err({ status: 429 }))
      .mockResolvedValue('bien')
    expect(await withRetry(fn, { sleep: () => Promise.resolve() })).toBe('bien')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('respeta el tiempo que pide el proveedor', async () => {
    // Esperar lo que te piden es más rápido y más educado que un retroceso a
    // ciegas.
    const esperas: number[] = []
    const fn = vi.fn()
      .mockRejectedValueOnce(err({ status: 429, error: { metadata: { retry_after_seconds: 7 } } }))
      .mockResolvedValue('bien')
    await withRetry(fn, { sleep: (ms) => { esperas.push(ms); return Promise.resolve() } })
    expect(esperas).toEqual([7000])
  })

  it('sin indicación, retrocede exponencialmente', async () => {
    const esperas: number[] = []
    const fn = vi.fn().mockRejectedValue(err({ status: 500 }))
    await expect(
      withRetry(fn, { attempts: 4, baseDelayMs: 1000, sleep: (ms) => { esperas.push(ms); return Promise.resolve() } }),
    ).rejects.toThrow()
    expect(esperas).toEqual([1000, 2000, 4000])
  })

  it('nunca duerme más del techo', async () => {
    const esperas: number[] = []
    const fn = vi.fn().mockRejectedValue(err({ status: 429, error: { metadata: { retry_after_seconds: 9999 } } }))
    await expect(
      withRetry(fn, { attempts: 2, maxDelayMs: 30_000, sleep: (ms) => { esperas.push(ms); return Promise.resolve() } }),
    ).rejects.toThrow()
    expect(esperas).toEqual([30_000])
  })

  it('NO reintenta lo que no se arregla esperando: falla al primer intento', async () => {
    const fn = vi.fn().mockRejectedValue(err({ status: 401 }))
    await expect(withRetry(fn, { sleep: () => Promise.resolve() })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('avisa antes de cada espera, para que el CLI pueda decirlo', async () => {
    const avisos: number[] = []
    const fn = vi.fn().mockRejectedValueOnce(err({ status: 429 })).mockResolvedValue('bien')
    await withRetry(fn, { sleep: () => Promise.resolve(), onRetry: (i) => avisos.push(i) })
    expect(avisos).toEqual([1])
  })
})
