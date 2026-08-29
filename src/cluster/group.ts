// src/cluster/group.ts
// El mismo plan en varias webs es UN cluster (§4.8).
//
// Aquí está la inversión conceptual que sostiene el proyecto: en un agregador
// normal el consenso es ruido a deduplicar; aquí es la señal de calidad más
// barata y más fiable que tenemos, y por eso pesa 25 de los 100 puntos.
import type { Candidate, Cluster, SourceRef } from '../types'
import { dedupeKey } from './planonmapKey'
import { haversineMeters } from '../normalize/geo'
import { titleSimilarity, clip } from '../core/text'
import { semanticHash } from '../core/hash'
import { slugify } from '../core/ids'
import { summarizeDates } from '../normalize/dates'

/** Dos candidatos son el mismo plan si coinciden AL MENOS DOS de estas tres. */
export function sameplan(a: Candidate, b: Candidate): boolean {
  if (a.collection !== b.collection) return false

  let signals = 0

  // 1 · dedupeKey de planonmap idéntica.
  if (a.startDate && b.startDate) {
    const ka = dedupeKey({ title: a.title, startDate: a.startDate, venue: a.venue })
    const kb = dedupeKey({ title: b.title, startDate: b.startDate, venue: b.venue })
    if (ka === kb) signals++
  }

  // 2 · Distancia < 150 m Y solapamiento de fechas.
  if (haversineMeters(a.venue, b.venue) < 150 && datesOverlap(a, b)) signals++

  // 3 · Similitud de títulos ≥ 0,82 por trigramas.
  if (titleSimilarity(a.title, b.title) >= 0.82) signals++

  return signals >= 2
}

function datesOverlap(a: Candidate, b: Candidate): boolean {
  if (!a.startDate || !b.startDate) return false
  const aStart = new Date(a.startDate).getTime()
  const aEnd = new Date(a.endDate ?? a.startDate).getTime()
  const bStart = new Date(b.startDate).getTime()
  const bEnd = new Date(b.endDate ?? b.startDate).getTime()
  return aStart <= bEnd && bStart <= aEnd
}

/** El valor más completo gana; si empatan, gana el de mayor `trust`. */
function bestOf<T>(
  members: readonly Candidate[],
  pick: (c: Candidate) => T | undefined,
  weight: (v: T) => number = () => 1,
): T | undefined {
  let best: { value: T; score: number; trust: number } | null = null
  for (const m of members) {
    const value = pick(m)
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim().length === 0) continue
    const score = weight(value)
    if (
      best === null ||
      score > best.score ||
      (score === best.score && m.trust > best.trust)
    ) {
      best = { value, score, trust: m.trust }
    }
  }
  return best?.value
}

function longest(v: string): number {
  return v.length
}

/**
 * Funde un grupo de candidatos en un cluster. Guarda TODAS las URL de origen,
 * TODAS las fuentes y el mejor valor de cada campo.
 */
export function mergeCluster(
  members: readonly Candidate[],
  temporality: 'atemporal' | 'temporada',
  transitHints: readonly string[] = [],
): Cluster {
  const first = members[0]
  if (!first) throw new Error('mergeCluster: grupo vacío')

  // La fuente más fiable primero: en un empate gana la primera aparición, así
  // que el orden importa (§1.3).
  const ordered = [...members].sort((a, b) => b.trust - a.trust)
  const leader = ordered[0] ?? first

  const sources: SourceRef[] = ordered.map((m) => ({
    id: m.sourceId,
    tier: m.tier,
    trust: m.trust,
    url: m.url,
    retrievedAt: m.retrievedAt,
  }))

  const title = leader.title
  const description = bestOf(ordered, (c) => c.description, longest) ?? ''
  const venue = bestOf(ordered, (c) => c.venue, (v) => v.address.length) ?? leader.venue
  const startDate = bestOf(ordered, (c) => c.startDate)
  const endDate = bestOf(ordered, (c) => c.endDate)
  const schedule = bestOf(ordered, (c) => (c.schedule.length > 0 ? c.schedule : undefined), (s) => s.length) ?? []
  const price = bestOf(ordered, (c) => (c.price.type === 'unknown' ? undefined : c.price)) ?? leader.price

  const clusterId = leader.seedSlug ?? slugify(title)

  const cluster: Cluster = {
    clusterId,
    collection: leader.collection,
    title,
    titles: [...new Set(ordered.map((m) => m.title))].slice(0, 3),
    description,
    sources,
    startDate,
    endDate,
    timeConfidence: ordered.some((m) => m.timeConfidence === 'exact') ? 'exact' : 'day',
    dateSummary: summarizeDates(startDate, endDate, temporality),
    schedule,
    scheduleLines: schedule.map((s) => (s.days ? `${s.days}: ${s.hours}` : s.hours)),
    venue,
    category: leader.category,
    price,
    priceTexts: [...new Set(ordered.flatMap((m) => m.priceTexts))].slice(0, 3),
    officialUrl: bestOf(ordered, (c) => c.officialUrl),
    ticketsUrl: bestOf(ordered, (c) => c.ticketsUrl),
    image: bestOf(ordered, (c) => c.image),
    transitHints,
    extracts: ordered
      .filter((m) => m.bodyText.length > 0)
      .slice(0, 3)
      .map((m) => ({ url: m.url, text: clip(m.bodyText, 700) })),
    planonmapDedupeKey: startDate
      ? dedupeKey({ title, startDate, venue })
      : dedupeKey({ title, startDate: '0000-00-00', venue }),
    semanticHash: '',
    firstSeen: ordered.reduce(
      (min, m) => (m.retrievedAt < min ? m.retrievedAt : min),
      leader.retrievedAt,
    ),
    seedSlug: leader.seedSlug,
  }

  return { ...cluster, semanticHash: semanticHash(cluster) }
}

/**
 * Agrupa una lista de candidatos. Codicioso y O(n²), que con ~40 candidatos
 * nuevos al día es de sobra: optimizarlo sería complicar lo que no duele.
 */
export function groupCandidates(
  candidates: readonly Candidate[],
  temporalityOf: (c: Candidate) => 'atemporal' | 'temporada' = () => 'temporada',
): Cluster[] {
  const groups: Candidate[][] = []

  for (const candidate of candidates) {
    const target = groups.find((g) => g.some((m) => sameplan(m, candidate)))
    if (target) target.push(candidate)
    else groups.push([candidate])
  }

  return groups.map((g) => {
    const leader = g[0]
    return mergeCluster(g, leader ? temporalityOf(leader) : 'temporada')
  })
}

/** Cuántas fuentes de nivel A/B avalan un cluster. Las de nivel C no cuentan. */
export function goodSources(cluster: Cluster): SourceRef[] {
  return cluster.sources.filter((s) => s.tier === 'A' || s.tier === 'B')
}
