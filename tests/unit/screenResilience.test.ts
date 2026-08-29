// REGRESIÓN: una caída del proveedor NO puede tumbar la ejecución (§4.4, §7.7).
//
// Se descubrió con una clave real sin saldo: el 429 `credit_balance_exhausted`
// se propagaba y mataba `pnpm curate` entero. El rastreo, el prefiltro, el
// consenso y la publicación tienen que seguir corriendo pase lo que pase.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUDGET } from '../../config/budget'
import { BudgetGuard } from '../../src/ai/budget'
import { isProviderDown, screenAll, screenBatch } from '../../src/screen/llmScreen'
import * as clients from '../../src/ai/clients'
import { makeCluster, NOW } from '../fixtures/clusters'

function apiError(status: number, code: string, type?: string): Error {
  return Object.assign(new Error(`fallo simulado ${code}`), { status, code, type })
}

/** Sustituye el cliente por uno que siempre falla con el error dado. */
function failWith(error: Error): void {
  vi.spyOn(clients, 'openai').mockReturnValue({
    chat: { completions: { create: () => Promise.reject(error) } },
  } as unknown as ReturnType<typeof clients.openai>)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isProviderDown', () => {
  it('sin saldo, clave inválida o sin permiso: reintentar es inútil', () => {
    expect(isProviderDown(apiError(429, 'credit_balance_exhausted', 'insufficient_quota'))).toBe(true)
    expect(isProviderDown(apiError(401, 'invalid_api_key'))).toBe(true)
    expect(isProviderDown(apiError(403, 'model_not_found'))).toBe(true)
  })

  it('un 429 de ritmo o un 500 SÍ merecen reintento', () => {
    expect(isProviderDown(apiError(429, 'rate_limit_exceeded'))).toBe(false)
    expect(isProviderDown(apiError(500, 'server_error'))).toBe(false)
    expect(isProviderDown(new Error('socket hang up'))).toBe(false)
  })
})

describe('screenBatch ante un proveedor caído', () => {
  it('NO lanza: devuelve los candidatos como pendientes', async () => {
    failWith(apiError(429, 'credit_balance_exhausted', 'insufficient_quota'))
    const guard = await BudgetGuard.load(BUDGET, NOW)
    const batch = [makeCluster({ clusterId: 'uno' }), makeCluster({ clusterId: 'dos' })]

    const outcome = await screenBatch(batch, BUDGET, guard, NOW)

    expect(outcome.verdicts.size).toBe(0)
    expect(outcome.missing).toEqual(['uno', 'dos'])
    expect(outcome.providerDown).toBe(true)
    expect(outcome.providerError).toContain('credit_balance_exhausted')
    // Y no se apunta gasto por una llamada que no llegó a hacerse.
    expect(outcome.eur).toBe(0)
  })
})

describe('screenAll ante un proveedor sin saldo', () => {
  it('deja de intentarlo: una llamada, no cincuenta', async () => {
    // Sin esto, el reintento individual del §5.4 haría una llamada fallida por
    // CADA candidato, más una por cada lote restante.
    const error = apiError(429, 'credit_balance_exhausted', 'insufficient_quota')
    const create = vi.fn().mockRejectedValue(error)
    vi.spyOn(clients, 'openai').mockReturnValue({
      chat: { completions: { create } },
    } as unknown as ReturnType<typeof clients.openai>)

    const guard = await BudgetGuard.load(BUDGET, NOW)
    const clusters = Array.from({ length: 25 }, (_, i) =>
      makeCluster({ clusterId: `plan-${i}`, title: `Plan numero ${i} en Barcelona` }),
    )

    const outcome = await screenAll(clusters, BUDGET, guard, NOW)

    expect(create).toHaveBeenCalledTimes(1)
    expect(outcome.providerDown).toBe(true)
    expect(outcome.missing).toHaveLength(25)
    expect(outcome.verdicts.size).toBe(0)
  })

  it('un fallo transitorio SÍ se reintenta candidato a candidato', async () => {
    const error = apiError(500, 'server_error')
    const create = vi.fn().mockRejectedValue(error)
    vi.spyOn(clients, 'openai').mockReturnValue({
      chat: { completions: { create } },
    } as unknown as ReturnType<typeof clients.openai>)

    const guard = await BudgetGuard.load(BUDGET, NOW)
    const clusters = [makeCluster({ clusterId: 'uno' }), makeCluster({ clusterId: 'dos' })]

    const outcome = await screenAll(clusters, BUDGET, guard, NOW)

    // 1 lote + 2 reintentos individuales.
    expect(create).toHaveBeenCalledTimes(3)
    expect(outcome.providerDown).toBe(false)
    expect(outcome.missing).toEqual(['uno', 'dos'])
  })
})
