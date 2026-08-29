// config/budget.ts
// Tope de gasto, modelos y precios por millón de tokens (§7.2, §7.4, §7.6).
//
// Los precios están en dólares porque así los publican los proveedores; la
// conversión a euros es directa y vive en `usdToEur`. Tener el precio en UN
// SOLO SITIO es lo que hace que un cambio de tarifas sea una línea.
import type { Budget } from './schema'

export const BUDGET: Budget = {
  /** Tope duro. Se sobrescribe con AI_MONTHLY_BUDGET_EUR. */
  monthlyBudgetEur: Number(process.env['AI_MONTHLY_BUDGET_EUR'] ?? 5),
  usdToEur: 0.93, // agosto de 2026
  warnAtFraction: 0.7,

  pricing: {
    // Cribado: SÍNCRONO a precio de lista. Va en síncrono a propósito (§7.2 bis):
    // el resultado hace falta en la misma ejecución para decidir qué se redacta.
    'gpt-5-mini': { inputPerMTokUsd: 0.25, outputPerMTokUsd: 2.0, batch: false },
    // Redacción: Batch API, 50 % de descuento YA aplicado a estas cifras.
    'claude-opus-5': { inputPerMTokUsd: 2.5, outputPerMTokUsd: 12.5, batch: true },
    // Palanca de emergencia: la mitad de coste, algo menos de calidad (§7.2).
    'claude-sonnet-5': { inputPerMTokUsd: 1.0, outputPerMTokUsd: 5.0, batch: true },
    // Cascada de proveedor si Anthropic falla (§7.7).
    'gpt-5': { inputPerMTokUsd: 0.625, outputPerMTokUsd: 5.0, batch: true },
  },

  screenModel: process.env['SCREEN_MODEL'] ?? 'gpt-5-mini',
  writerModel: process.env['WRITER_MODEL'] ?? 'claude-opus-5',
  writerFallbackModel: process.env['WRITER_FALLBACK_MODEL'] ?? 'gpt-5',

  screenBatchSize: 10,
  writeBatchSize: 30,
  /**
   * OJO: este tope INCLUYE los tokens de razonamiento. El JSON visible de un
   * lote de diez ronda los 650 tokens, pero a `reasoning_effort: low` el modelo
   * genera además unos 850 de razonamiento. Con 1.200 la respuesta se cortaría a
   * mitad de JSON de forma intermitente — la peor clase de fallo. 3.000 deja
   * margen holgado y no cuesta nada: se paga por token generado, no por el tope.
   */
  screenMaxOutputTokens: 3000,
  writeMaxTokens: 4000,
  batchExpiryHours: 26,
}

/** Tokens estimados por candidato en el prompt de cribado (§7.4). */
export const TOKEN_ESTIMATES = {
  screenSystemTokens: 430,
  screenPerCandidateTokens: 470,
  screenOutputPerBatch: 1500, // 650 visibles + ~850 de razonamiento
  writeSystemTokens: 700,
  writeMaterialMaxTokens: 2500,
  writeOutputPerCard: 2100, // ~1.400 visibles + ~700 de pensamiento
} as const
