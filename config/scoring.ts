// config/scoring.ts
// Los 100 puntos del cribado: 45 deterministas (coste cero) y 55 del modelo.
// Viven aquí para poder afinarlos sin tocar código (§5.1).
import type { Scoring } from './schema'

/** Base de consenso por número de fuentes de nivel A/B. 4 o más → 25. */
export const CONSENSO_BASE = { 1: 10, 2: 18, 3: 23, 4: 25 } as const

export const SCORING: Scoring = {
  consensusBase: CONSENSO_BASE,
  completenessPointsPerField: 2, // 5 campos × 2 = 10 puntos
  freshness: { d14: 5, d30: 3, d60: 1 },
  maxReputation: 5,
  /**
   * Umbral de paso al enriquecimiento. Se eligió midiendo: 62 deja pasar a un
   * plan de dos fuentes (18) con ficha completa (10), vigente (5), fuente sólida
   * (4) y un juicio editorial decente (25 de 55), y detiene a uno de una sola
   * fuente con juicio mediocre. Es el número más ajustable del proyecto; se
   * revisa con las métricas del §5.5.
   */
  threshold: 62,
  quotaFallbackThreshold: 55,
  singleSourceMinDeterministic: 20,
}

/** Vetos duros del modelo: si alguno es `true`, el candidato se descarta (§5.1). */
export const HARD_VETOES = [
  'es_trampa_turistica',
  'es_generico_europeo',
  'requiere_ser_local',
  'es_marca_disfrazada',
] as const
export type HardVeto = (typeof HARD_VETOES)[number]

/** Techos de las cuatro señales del modelo. Suman 55. */
export const LLM_MAX = {
  vale_el_viaje: 15,
  caracteristico_bcn: 15,
  sin_barrera_idioma: 10,
  no_trampa_turistica: 15,
} as const

/**
 * Ajuste automático de la reputación de fuente, mensual y con ≥ 20 propuestas
 * acumuladas (§5.5). El cambio se PROPONE en un PR; no se aplica solo.
 */
export const TRUST_ADJUSTMENT = {
  minProposals: 20,
  dropToZeroBelow: 0.3,
  halveBelow: 0.5,
  boostAbove: 0.85,
  boostFactor: 1.1,
} as const
