// Un endpoint propio no factura por token, y la configuración tiene que saberlo.
//
// REGRESIÓN: al probar Ollama por primera vez, `loadConfig` se negó a cargar con
// «falta el precio del modelo "qwen2.5:7b"». El invariante era correcto —sin
// precio no se puede estimar el coste, y el tope duro dejaría de serlo— pero le
// faltaba el caso de un modelo servido por tu propia máquina, cuyo precio se
// conoce perfectamente: es cero.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const KEYS = ['OPENAI_BASE_URL', 'SCREEN_MODEL', 'WRITER_MODEL'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k]
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

/**
 * `config/budget.ts` lee el entorno AL IMPORTARSE, así que hace falta un import
 * nuevo por cada escenario. El contador evita `Date.now()`, que está prohibido
 * fuera de core/clock.ts — y la regla aplica también a los tests.
 */
let importacion = 0
async function cargarPresupuesto() {
  const mod = await import(`../../config/budget?t=${++importacion}`)
  return (mod as { BUDGET: { pricing: Record<string, unknown>; screenModel: string } }).BUDGET
}

describe('precios con endpoint propio', () => {
  it('un modelo local declara coste CERO, no «sin precio»', async () => {
    process.env['OPENAI_BASE_URL'] = 'http://127.0.0.1:11434/v1'
    process.env['SCREEN_MODEL'] = 'qwen2.5:7b'
    const budget = await cargarPresupuesto()
    expect(budget.pricing['qwen2.5:7b']).toEqual({
      inputPerMTokUsd: 0,
      outputPerMTokUsd: 0,
      batch: false,
    })
  })

  it('SIN endpoint propio, un modelo desconocido sigue sin precio', async () => {
    // El guardián del §7.6 no se relaja: si no sabemos lo que cuesta, no se
    // llama. Solo se abre la excepción cuando el modelo lo sirves tú.
    delete process.env['OPENAI_BASE_URL']
    process.env['SCREEN_MODEL'] = 'qwen2.5:7b'
    const budget = await cargarPresupuesto()
    expect(budget.pricing['qwen2.5:7b']).toBeUndefined()
  })

  it('un modelo de pago NO se abarata por llamarse igual con endpoint propio', async () => {
    // Sobreestimar es la dirección segura cuando hay un tope duro.
    process.env['OPENAI_BASE_URL'] = 'http://127.0.0.1:11434/v1'
    process.env['SCREEN_MODEL'] = 'gpt-5-mini'
    const budget = await cargarPresupuesto()
    expect(budget.pricing['gpt-5-mini']).toEqual({
      inputPerMTokUsd: 0.25,
      outputPerMTokUsd: 2.0,
      batch: false,
    })
  })

  it('los cuatro precios de catálogo están siempre', async () => {
    process.env['OPENAI_BASE_URL'] = 'http://127.0.0.1:11434/v1'
    process.env['SCREEN_MODEL'] = 'qwen2.5:7b'
    const budget = await cargarPresupuesto()
    for (const m of ['gpt-5-mini', 'gpt-5', 'claude-opus-5', 'claude-sonnet-5']) {
      expect(budget.pricing[m], m).toBeDefined()
    }
  })
})
