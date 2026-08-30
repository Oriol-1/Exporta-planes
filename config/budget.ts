// config/budget.ts
// Tope de gasto, modelos y precios por millón de tokens (§7.2, §7.4, §7.6).
//
// Los precios están en dólares porque así los publican los proveedores; la
// conversión a euros es directa y vive en `usdToEur`. Tener el precio en UN
// SOLO SITIO es lo que hace que un cambio de tarifas sea una línea.
import type { Budget, ModelPricing } from './schema'

/**
 * Un endpoint propio —un modelo local, típicamente— no factura por token.
 *
 * El invariante «sin precio no se llama» del §7.6 se mantiene intacto: lo que
 * cambia es que un modelo servido por TU máquina tiene un precio conocido, y es
 * cero. Sin esto, configurar OPENAI_BASE_URL hacía que la configuración se
 * negara a cargar, que es lo que pasó la primera vez que se probó.
 */
const SIN_COSTE: ModelPricing = { inputPerMTokUsd: 0, outputPerMTokUsd: 0, batch: false }

/** ¿Se ha configurado un endpoint compatible propio? */
const endpointPropio = (process.env['OPENAI_BASE_URL'] ?? '').trim() !== ''

const screenModel = process.env['SCREEN_MODEL'] ?? 'gpt-5-mini'
const writerModel = process.env['WRITER_MODEL'] ?? 'claude-opus-5'

/**
 * Precios de los modelos que se sirven desde el endpoint propio.
 *
 * Solo se añaden los que NO tienen precio ya: si alguien llama a su modelo local
 * `gpt-5-mini`, se le sigue cobrando el precio de OpenAI. Sobreestimar es la
 * dirección segura cuando hay un tope duro de por medio.
 */
const preciosPropios: Record<string, ModelPricing> = {}
if (endpointPropio) {
  for (const modelo of [screenModel, writerModel]) {
    if (!['gpt-5-mini', 'gpt-5', 'claude-opus-5', 'claude-sonnet-5'].includes(modelo)) {
      preciosPropios[modelo] = SIN_COSTE
    }
  }
}

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
    // Modelos servidos por un endpoint propio: coste cero, declarado.
    ...preciosPropios,
  },

  screenModel,
  writerModel,
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
