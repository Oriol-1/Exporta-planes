// src/ai/budget.ts
// El tope de gasto duro y el libro de gasto (§7.6).
//
// El peor caso casi duplica el tope de 5 €, y POR ESO EL TOPE EXISTE. Al
// alcanzarlo, el sistema deja de llamar a los modelos y sigue publicando la
// última versión buena. No es un fallo del diseño: es el diseño.
import type { Budget } from '../../config/schema'
import type { SpendCall, SpendLedger } from '../types'
import { madridMonthString } from '../core/clock'
import { readLedger, writeLedger } from '../store/cache'

export interface CostEstimate {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly usd: number
  readonly eur: number
}

/**
 * Coste de una llamada. Los tokens de razonamiento se facturan como SALIDA y
 * aquí están contados: es el error de estimación más común con estos modelos y
 * el que más desvía una previsión (§7.4).
 */
export function estimateCost(
  budget: Budget,
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostEstimate {
  const pricing = budget.pricing[model]
  if (!pricing) throw new Error(`sin precio para el modelo "${model}"`)
  const usd =
    (inputTokens / 1_000_000) * pricing.inputPerMTokUsd +
    (outputTokens / 1_000_000) * pricing.outputPerMTokUsd
  return { inputTokens, outputTokens, usd, eur: usd * budget.usdToEur }
}

/**
 * Recuento de tokens aproximado para OpenAI: caracteres partido por 3,6. Sobre-
 * estima A PROPÓSITO — es mejor cortar de más que pasarse del tope.
 */
export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 3.6)
}

export class BudgetGuard {
  private ledger: SpendLedger

  private constructor(
    private readonly budget: Budget,
    private readonly now: Date,
    ledger: SpendLedger,
  ) {
    this.ledger = ledger
  }

  static async load(budget: Budget, now: Date): Promise<BudgetGuard> {
    const month = madridMonthString(now)
    const existing = await readLedger(month)
    const ledger: SpendLedger = existing ?? {
      month,
      budgetEur: budget.monthlyBudgetEur,
      spentEur: 0,
      byModel: {},
      calls: [],
    }
    return new BudgetGuard(budget, now, { ...ledger, budgetEur: budget.monthlyBudgetEur })
  }

  get spentEur(): number {
    return this.ledger.spentEur
  }

  get budgetEur(): number {
    return this.ledger.budgetEur
  }

  get remainingEur(): number {
    return Math.max(0, this.ledger.budgetEur - this.ledger.spentEur)
  }

  get exhausted(): boolean {
    return this.ledger.spentEur >= this.ledger.budgetEur
  }

  /** ¿Se ha cruzado el 70 %? Da margen de reacción antes del corte (§7.6). */
  get shouldWarn(): boolean {
    return (
      this.ledger.spentEur >= this.ledger.budgetEur * this.budget.warnAtFraction &&
      this.ledger.warnedAt70 === undefined
    )
  }

  snapshot(): SpendLedger {
    return this.ledger
  }

  /** ¿Cabe esta llamada? Se comprueba ANTES de hacerla, nunca después. */
  canAfford(estimate: CostEstimate): boolean {
    return this.ledger.spentEur + estimate.eur <= this.ledger.budgetEur
  }

  /**
   * Apunta una llamada. Con el Batch API el gasto se apunta DOS VECES: al enviar
   * se anota el importe estimado con `pending: true` —así el tope ya cuenta con
   * un lote en vuelo y no se puede enviar un segundo que juntos lo rebasarían— y
   * al recoger se sustituye por el consumo real (§7.6).
   */
  async record(call: SpendCall): Promise<void> {
    const byModel = { ...this.ledger.byModel }
    byModel[call.model] = (byModel[call.model] ?? 0) + call.eur

    this.ledger = {
      ...this.ledger,
      spentEur: round4(this.ledger.spentEur + call.eur),
      byModel,
      calls: [...this.ledger.calls, call],
    }
    await this.persist()
  }

  /** Sustituye el apunte provisional de un lote por su consumo real. */
  async settleBatch(
    batchId: string,
    actual: { model: string; inputTokens: number; outputTokens: number },
  ): Promise<void> {
    const pending = this.ledger.calls.find((c) => c.batchId === batchId && c.pending === true)
    const cost = estimateCost(this.budget, actual.model, actual.inputTokens, actual.outputTokens)

    const withoutPending = this.ledger.calls.filter(
      (c) => !(c.batchId === batchId && c.pending === true),
    )
    const byModel = { ...this.ledger.byModel }
    if (pending) byModel[pending.model] = (byModel[pending.model] ?? 0) - pending.eur
    byModel[actual.model] = (byModel[actual.model] ?? 0) + cost.eur

    const settled: SpendCall = {
      at: this.now.toISOString(),
      model: actual.model,
      task: 'write',
      inputTokens: actual.inputTokens,
      outputTokens: actual.outputTokens,
      eur: round4(cost.eur),
      batchId,
    }

    this.ledger = {
      ...this.ledger,
      spentEur: round4(this.ledger.spentEur - (pending?.eur ?? 0) + cost.eur),
      byModel,
      calls: [...withoutPending, settled],
    }
    await this.persist()
  }

  async markWarned(): Promise<void> {
    this.ledger = { ...this.ledger, warnedAt70: this.now.toISOString() }
    await this.persist()
  }

  async markExhausted(): Promise<void> {
    if (this.ledger.exhaustedAt) return
    this.ledger = { ...this.ledger, exhaustedAt: this.now.toISOString() }
    await this.persist()
  }

  private async persist(): Promise<void> {
    await writeLedger(this.ledger)
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** Desglose legible del libro de gasto, para `pnpm spend` y el cuerpo del PR. */
export function formatLedger(ledger: SpendLedger): string {
  const lines = [
    `Mes ${ledger.month}`,
    `Gasto: ${ledger.spentEur.toFixed(2)} € de ${ledger.budgetEur.toFixed(2)} €`,
    '',
    'Por modelo:',
  ]
  for (const [model, eur] of Object.entries(ledger.byModel).sort()) {
    lines.push(`  ${model.padEnd(20)} ${eur.toFixed(4)} €`)
  }
  lines.push('', `Llamadas: ${ledger.calls.length}`)
  const pending = ledger.calls.filter((c) => c.pending)
  if (pending.length > 0) {
    lines.push(`  (${pending.length} en vuelo, con importe estimado)`)
  }
  if (ledger.exhaustedAt) lines.push(`Presupuesto agotado el ${ledger.exhaustedAt}`)
  return lines.join('\n')
}
