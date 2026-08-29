// src/screen/score.ts
// 100 puntos: 45 sin IA y 55 con IA (§5.1).
//
// La fórmula del consenso está escrita SIN AMBIGÜEDAD, porque «suma de trust» y
// «tabla por número de fuentes» no son lo mismo y el código tiene que elegir
// una: base por número de fuentes A/B, MULTIPLICADA por la media de su trust.
import type { Scoring } from '../../config/schema'
import type { Cluster, DeterministicScore, ScoredCluster, ScreenVerdict, SourceRef } from '../types'
import { HARD_VETOES, LLM_MAX } from '../../config/scoring'
import { goodSources } from '../cluster/group'
import { freshnessPoints } from './prefilter'

/**
 * Consenso: 0–25 puntos.
 *
 * Dos fuentes de nivel A (trust 1,00 y 0,95) dan 18 × 0,975 = 18. Dos de nivel B
 * (0,80) dan 18 × 0,80 = 14. Es la diferencia que se busca: el aval de dos
 * medios con criterio propio pesa más que el de dos agendas institucionales.
 */
export function puntuarConsenso(fuentes: readonly SourceRef[], scoring: Scoring): number {
  const buenas = fuentes.filter((f) => f.tier === 'A' || f.tier === 'B')
  if (buenas.length === 0) return 0
  const n = Math.min(buenas.length, 4) as 1 | 2 | 3 | 4
  const base = scoring.consensusBase[n]
  const trustMedio = buenas.reduce((a, f) => a + f.trust, 0) / buenas.length
  return Math.round(base * trustMedio)
}

/** Completitud: 0–10. Dos puntos por cada campo que de verdad ayuda al lector. */
export function puntuarCompletitud(cluster: Cluster, scoring: Scoring): number {
  const p = scoring.completenessPointsPerField
  let points = 0
  if (cluster.price.type !== 'unknown') points += p
  if (cluster.schedule.length > 0) points += p
  if (cluster.venue.locationPrecision === 'exact' && cluster.venue.address.length > 5) points += p
  if (cluster.officialUrl) points += p
  if (cluster.image) points += p
  return Math.min(points, p * 5)
}

/**
 * Reputación de la fuente: 0–5. Media ponderada del trust EFECTIVO, que es el
 * base ajustado por la tasa histórica de aprobación editorial (§5.5).
 */
export function puntuarReputacion(
  cluster: Cluster,
  scoring: Scoring,
  effectiveTrust: (sourceId: string) => number | undefined,
): number {
  const buenas = goodSources(cluster)
  if (buenas.length === 0) return 0
  const media =
    buenas.reduce((a, f) => a + (effectiveTrust(f.id) ?? f.trust), 0) / buenas.length
  return Math.round(media * scoring.maxReputation)
}

export function deterministicScore(
  cluster: Cluster,
  now: Date,
  scoring: Scoring,
  effectiveTrust: (sourceId: string) => number | undefined = () => undefined,
): DeterministicScore {
  const consensus = puntuarConsenso(cluster.sources, scoring)
  const completeness = puntuarCompletitud(cluster, scoring)
  const freshness = freshnessPoints(cluster, now, scoring)
  const reputation = puntuarReputacion(cluster, scoring, effectiveTrust)
  return {
    consensus,
    completeness,
    freshness,
    reputation,
    total: consensus + completeness + freshness + reputation,
  }
}

/** Los 55 puntos del modelo, sumados y acotados. */
export function llmPoints(verdict: ScreenVerdict): number {
  return (
    Math.min(verdict.vale_el_viaje, LLM_MAX.vale_el_viaje) +
    Math.min(verdict.caracteristico_bcn, LLM_MAX.caracteristico_bcn) +
    Math.min(verdict.sin_barrera_idioma, LLM_MAX.sin_barrera_idioma) +
    Math.min(verdict.no_trampa_turistica, LLM_MAX.no_trampa_turistica)
  )
}

/** ¿Algún veto duro? Si lo hay, el candidato se descarta sin importar la nota. */
export function hardVeto(verdict: ScreenVerdict): string | undefined {
  for (const veto of HARD_VETOES) {
    if (verdict[veto]) return veto
  }
  return undefined
}

export function scoreCluster(
  cluster: Cluster,
  now: Date,
  scoring: Scoring,
  verdict: ScreenVerdict | undefined,
  effectiveTrust: (sourceId: string) => number | undefined = () => undefined,
): ScoredCluster {
  const deterministic = deterministicScore(cluster, now, scoring, effectiveTrust)
  const points = verdict ? llmPoints(verdict) : 0
  const veto = verdict ? hardVeto(verdict) : undefined

  return {
    cluster,
    deterministic,
    verdict,
    llmPoints: points,
    total: deterministic.total + points,
    vetoed: veto !== undefined,
    vetoReason: veto,
    temporality: verdict?.temporalidad ?? (cluster.collection === 'museums' ? 'atemporal' : 'temporada'),
  }
}

/**
 * ¿Pasa al enriquecimiento?
 *
 * LA EXCEPCIÓN DE LOS MUSEOS (§5.1): la colección C no pasa por el umbral, y
 * conviene decirlo explícitamente porque si no el sistema se contradice. Los
 * museos entran porque están en `config/museums.ts`; su fuente principal es su
 * propia web —nivel C, que puntúa 0 en consenso—, así que aplicarles el corte de
 * 62 los dejaría fuera a casi todos, y el Museu Picasso no necesita que dos
 * medios lo avalen para merecer una ficha.
 */
export function passesThreshold(scored: ScoredCluster, scoring: Scoring): boolean {
  if (scored.cluster.collection === 'museums') return true
  if (scored.vetoed) return false
  return scored.total >= scoring.threshold
}
