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

/** Modelos con precio de catálogo. Un nombre de estos NUNCA se toma por gratis. */
const MODELOS_DE_PAGO = ['gpt-5-mini', 'gpt-5', 'claude-opus-5', 'claude-sonnet-5'] as const

/**
 * Aplica el entorno a la configuración de presupuesto.
 *
 * SE LLAMA EN TIEMPO DE EJECUCIÓN, no al importar el módulo, y eso NO es un
 * detalle: los imports de ES se evalúan antes que cualquier sentencia, así que
 * un `process.env` leído aquí arriba se resolvería ANTES de que `readEnv()` haya
 * cargado `.env.local`. El síntoma era silencioso y grave: `SCREEN_MODEL`,
 * `WRITER_MODEL` y —lo peor— `AI_MONTHLY_BUDGET_EUR` puestos en `.env.local` se
 * ignoraban sin decir nada. Quien bajara el tope a 1 € seguía con 5.
 */
export function applyEnv(base: Budget, env: NodeJS.ProcessEnv = process.env): Budget {
  const screenModel = env['SCREEN_MODEL']?.trim() || base.screenModel
  const writerModel = env['WRITER_MODEL']?.trim() || base.writerModel
  const writerFallbackModel = env['WRITER_FALLBACK_MODEL']?.trim() || base.writerFallbackModel
  const tope = Number(env['AI_MONTHLY_BUDGET_EUR'])
  const endpointPropio = (env['OPENAI_BASE_URL'] ?? '').trim() !== ''

  // Un modelo servido por un endpoint propio no factura por token. Solo se
  // declara gratis si NO tiene precio de catálogo: si alguien llama a su modelo
  // local `gpt-5-mini`, se le sigue cobrando. Sobreestimar es la dirección
  // segura cuando hay un tope duro de por medio.
  const preciosPropios: Record<string, ModelPricing> = {}
  if (endpointPropio) {
    for (const modelo of [screenModel, writerModel, writerFallbackModel]) {
      if (!(MODELOS_DE_PAGO as readonly string[]).includes(modelo)) {
        preciosPropios[modelo] = SIN_COSTE
      }
    }
  }

  return {
    ...base,
    monthlyBudgetEur: Number.isFinite(tope) && tope > 0 ? tope : base.monthlyBudgetEur,
    screenModel,
    writerModel,
    writerFallbackModel,
    pricing: { ...base.pricing, ...preciosPropios },
  }
}

/** Valores POR DEFECTO. El entorno se aplica en `loadConfig()` (§3.5). */
export const BUDGET: Budget = {
  monthlyBudgetEur: 5,
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

  screenModel: 'gpt-5-mini',
  writerModel: 'claude-opus-5',
  writerFallbackModel: 'gpt-5',

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
