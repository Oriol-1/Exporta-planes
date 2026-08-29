// El tope de gasto duro (§7.6).
//
// «El peor caso casi duplica el tope de 5 €, y POR ESO EL TOPE EXISTE. Al
// alcanzarlo, el sistema deja de llamar a los modelos y sigue publicando la
// última versión buena. No es un fallo del diseño: es el diseño.»
import { describe, expect, it } from 'vitest'
import { BUDGET, TOKEN_ESTIMATES } from '../../config/budget'
import { approximateTokens, estimateCost, formatLedger } from '../../src/ai/budget'
import type { SpendLedger } from '../../src/types'

describe('estimateCost', () => {
  it('cobra entrada y salida a sus precios respectivos', () => {
    const cost = estimateCost(BUDGET, 'gpt-5-mini', 1_000_000, 1_000_000)
    expect(cost.usd).toBeCloseTo(0.25 + 2.0, 6)
    expect(cost.eur).toBeCloseTo((0.25 + 2.0) * BUDGET.usdToEur, 6)
  })

  it('el precio de la redacción ya lleva aplicado el 50 % del Batch API', () => {
    // Opus 5 en lote: 2,50 / 12,50 por millón. Es donde el descuento vale de
    // verdad: 2,85 € frente a 5,69 € (§7.2).
    expect(BUDGET.pricing['claude-opus-5']?.batch).toBe(true)
    expect(BUDGET.pricing['claude-opus-5']?.outputPerMTokUsd).toBe(12.5)
    // El cribado va en SÍNCRONO, a precio de lista, a propósito (§7.2 bis).
    expect(BUDGET.pricing['gpt-5-mini']?.batch).toBe(false)
  })

  it('la palanca de emergencia cuesta la mitad', () => {
    const opus = BUDGET.pricing['claude-opus-5']!
    const sonnet = BUDGET.pricing['claude-sonnet-5']!
    expect(sonnet.outputPerMTokUsd).toBeCloseTo(opus.outputPerMTokUsd / 2.5, 6)
    expect(sonnet.outputPerMTokUsd).toBeLessThan(opus.outputPerMTokUsd)
  })

  it('falla ruidosamente si falta el precio de un modelo', () => {
    // Sin precio no se puede estimar antes de llamar, y el tope duro dejaría de
    // ser duro.
    expect(() => estimateCost(BUDGET, 'modelo-inventado', 1000, 1000)).toThrow()
  })
})

describe('approximateTokens', () => {
  it('sobreestima a propósito: mejor cortar de más que pasarse del tope', () => {
    const texto = 'a'.repeat(360)
    expect(approximateTokens(texto)).toBe(100)
    expect(approximateTokens('')).toBe(0)
  })
})

describe('el escenario esperado del §7.4 cuadra', () => {
  it('el cribado mensual ronda los 0,24 €', () => {
    // 60 lotes de 10: 307.800 de entrada y 90.000 de salida.
    const cost = estimateCost(BUDGET, 'gpt-5-mini', 307_800, 90_000)
    expect(cost.eur).toBeGreaterThan(0.2)
    expect(cost.eur).toBeLessThan(0.3)
  })

  it('la redacción mensual ronda los 1,91 €', () => {
    // 60 fichas: 192.000 de entrada y 126.000 de salida.
    const cost = estimateCost(BUDGET, 'claude-opus-5', 192_000, 126_000)
    expect(cost.eur).toBeGreaterThan(1.8)
    expect(cost.eur).toBeLessThan(2.0)
  })

  it('el total esperado cabe holgadamente en el tope de 5 €', () => {
    const cribado = estimateCost(BUDGET, 'gpt-5-mini', 307_800, 90_000)
    const redaccion = estimateCost(BUDGET, 'claude-opus-5', 192_000, 126_000)
    const museos = estimateCost(BUDGET, 'claude-opus-5', 12_800, 8_400)
    const total = cribado.eur + redaccion.eur + museos.eur
    expect(total).toBeLessThan(BUDGET.monthlyBudgetEur)
    expect(total).toBeCloseTo(2.28, 1)
  })

  it('el PEOR CASO se sale del tope, y por eso el tope existe', () => {
    // 240 fichas en un mes: no es un mes cargado, es un reproceso masivo.
    const cribado = estimateCost(BUDGET, 'gpt-5-mini', 461_700, 135_000)
    const redaccion = estimateCost(BUDGET, 'claude-opus-5', 768_000, 504_000)
    const museos = estimateCost(BUDGET, 'claude-opus-5', 38_400, 25_200)
    const total = cribado.eur + redaccion.eur + museos.eur
    expect(total).toBeGreaterThan(BUDGET.monthlyBudgetEur)
    expect(total).toBeCloseTo(8.39, 1)
  })

  it('con Sonnet 5 ni el peor mes se corta', () => {
    const cribado = estimateCost(BUDGET, 'gpt-5-mini', 461_700, 135_000)
    const redaccion = estimateCost(BUDGET, 'claude-sonnet-5', 768_000, 504_000)
    const museos = estimateCost(BUDGET, 'claude-sonnet-5', 38_400, 25_200)
    expect(cribado.eur + redaccion.eur + museos.eur).toBeLessThan(BUDGET.monthlyBudgetEur)
  })
})

describe('estimaciones de tokens', () => {
  it('cuentan el razonamiento, que se factura como salida (defecto nº 14)', () => {
    // El JSON visible de un lote ronda los 650 tokens; a reasoning_effort low el
    // modelo genera además unos 850 de razonamiento.
    expect(TOKEN_ESTIMATES.screenOutputPerBatch).toBeGreaterThan(650)
    expect(TOKEN_ESTIMATES.writeOutputPerCard).toBeGreaterThan(1400)
  })

  it('el material nunca supera los 2.500 tokens', () => {
    expect(TOKEN_ESTIMATES.writeMaterialMaxTokens).toBe(2500)
  })
})

describe('formatLedger', () => {
  it('señala los lotes en vuelo, que llevan importe estimado', () => {
    const ledger: SpendLedger = {
      month: '2026-09',
      budgetEur: 5,
      spentEur: 1.87,
      byModel: { 'claude-opus-5': 1.83, 'gpt-5-mini': 0.04 },
      calls: [
        {
          at: '2026-09-03T02:34:11Z',
          model: 'claude-opus-5',
          task: 'write',
          inputTokens: 12800,
          outputTokens: 5600,
          eur: 0.095,
          batchId: 'msgbatch_01',
          pending: true,
        },
      ],
    }
    const text = formatLedger(ledger)
    expect(text).toContain('1.87')
    expect(text).toContain('en vuelo')
  })
})
