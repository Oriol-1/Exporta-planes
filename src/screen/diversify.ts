// src/screen/diversify.ts
// Variedad forzada (§5.6). La puntuación sola produce listas monótonas: seis
// museos de arte, todos en Ciutat Vella, todos de 15 €.
//
// Y la regla que manda sobre todas las cuotas: NUNCA se publica algo malo por
// rellenar un hueco.
import type { Quotas, Scoring } from '../../config/schema'
import type { ScoredCluster } from '../types'
import { isCheap } from '../normalize/price'
import { norm } from '../core/text'

export interface DiversifyResult {
  readonly selected: readonly ScoredCluster[]
  readonly rejected: readonly { readonly scored: ScoredCluster; readonly reason: string }[]
  /** Cuotas mínimas que no se pudieron cubrir. Se informan, no se fuerzan. */
  readonly unmetMinimums: readonly string[]
}

interface Counters {
  byCategory: Map<string, number>
  byNeighborhood: Map<string, number>
  byVenue: Map<string, number>
  cheap: number
  atemporal: number
  temporada: number
}

function keyFor(scored: ScoredCluster): {
  category: string
  neighborhood: string
  venue: string
} {
  const v = scored.cluster.venue
  return {
    category: scored.cluster.category,
    neighborhood: norm(v.neighborhood ?? v.district ?? 'sin-barrio'),
    venue: norm(v.name),
  }
}

function breaksQuota(
  scored: ScoredCluster,
  counters: Counters,
  quotas: Quotas,
): string | null {
  const k = keyFor(scored)
  if ((counters.byCategory.get(k.category) ?? 0) >= quotas.maxPorCategoria) {
    return `cuota de categoría (${k.category}, máx. ${quotas.maxPorCategoria})`
  }
  if ((counters.byNeighborhood.get(k.neighborhood) ?? 0) >= quotas.maxPorBarrio) {
    return `cuota de barrio (${k.neighborhood}, máx. ${quotas.maxPorBarrio})`
  }
  if ((counters.byVenue.get(k.venue) ?? 0) >= quotas.maxPorRecinto) {
    return `cuota de recinto (${k.venue}, máx. ${quotas.maxPorRecinto})`
  }
  return null
}

function accept(scored: ScoredCluster, counters: Counters, quotas: Quotas): void {
  const k = keyFor(scored)
  counters.byCategory.set(k.category, (counters.byCategory.get(k.category) ?? 0) + 1)
  counters.byNeighborhood.set(k.neighborhood, (counters.byNeighborhood.get(k.neighborhood) ?? 0) + 1)
  counters.byVenue.set(k.venue, (counters.byVenue.get(k.venue) ?? 0) + 1)
  if (isCheap(scored.cluster.price, quotas.umbralGratuitoEur)) counters.cheap++
  if (scored.temporality === 'atemporal') counters.atemporal++
  else counters.temporada++
}

/**
 * Pasada codiciosa con cuotas: ordenar por puntuación descendente, recorrer,
 * aceptar si ninguna cuota se rompe. Si al final falta cubrir un mínimo, se
 * recorre otra vez rebajando el umbral SOLO para ese hueco. Si aun así no hay
 * candidato, el hueco se queda vacío.
 */
export function diversify(
  candidates: readonly ScoredCluster[],
  quotas: Quotas,
  scoring: Scoring,
  limit: number,
): DiversifyResult {
  const counters: Counters = {
    byCategory: new Map(),
    byNeighborhood: new Map(),
    byVenue: new Map(),
    cheap: 0,
    atemporal: 0,
    temporada: 0,
  }

  const ordered = [...candidates].sort((a, b) => b.total - a.total)
  const selected: ScoredCluster[] = []
  const rejected: { scored: ScoredCluster; reason: string }[] = []
  const leftovers: ScoredCluster[] = []

  for (const scored of ordered) {
    if (selected.length >= limit) {
      rejected.push({ scored, reason: 'límite de la ejecución alcanzado' })
      continue
    }
    if (scored.total < scoring.threshold) {
      leftovers.push(scored)
      continue
    }
    const broken = breaksQuota(scored, counters, quotas)
    if (broken) {
      rejected.push({ scored, reason: broken })
      leftovers.push(scored)
      continue
    }
    selected.push(scored)
    accept(scored, counters, quotas)
  }

  // Segunda pasada: rellenar los mínimos que quedaron sin cubrir, rebajando el
  // umbral a `quotaFallbackThreshold` SOLO para ese hueco concreto.
  const unmet: string[] = []
  const needs: { name: string; met: () => boolean; matches: (s: ScoredCluster) => boolean }[] = [
    {
      name: `minGratuitos (${quotas.minGratuitos})`,
      met: () => counters.cheap >= quotas.minGratuitos,
      matches: (s) => isCheap(s.cluster.price, quotas.umbralGratuitoEur),
    },
    {
      name: `minAtemporales (${quotas.minAtemporales})`,
      met: () => counters.atemporal >= quotas.minAtemporales,
      matches: (s) => s.temporality === 'atemporal',
    },
    {
      name: `minTemporada (${quotas.minTemporada})`,
      met: () => counters.temporada >= quotas.minTemporada,
      matches: (s) => s.temporality === 'temporada',
    },
  ]

  for (const need of needs) {
    while (!need.met() && selected.length < limit) {
      const filler = leftovers.find(
        (s) =>
          !selected.includes(s) &&
          need.matches(s) &&
          !s.vetoed &&
          s.total >= scoring.quotaFallbackThreshold,
      )
      // Sin candidato, el hueco se queda vacío. Publicar algo malo por rellenar
      // una cuota sería peor que no cubrirla.
      if (!filler) break
      selected.push(filler)
      accept(filler, counters, quotas)
    }
    if (!need.met()) unmet.push(need.name)
  }

  return {
    selected,
    rejected: rejected.filter((r) => !selected.includes(r.scored)),
    unmetMinimums: unmet,
  }
}

/** Reparto por categoría y barrio de lo seleccionado. Para el informe semanal. */
export function coverage(selected: readonly ScoredCluster[]): {
  byCategory: Record<string, number>
  byNeighborhood: Record<string, number>
} {
  const byCategory: Record<string, number> = {}
  const byNeighborhood: Record<string, number> = {}
  for (const s of selected) {
    const k = keyFor(s)
    byCategory[k.category] = (byCategory[k.category] ?? 0) + 1
    byNeighborhood[k.neighborhood] = (byNeighborhood[k.neighborhood] ?? 0) + 1
  }
  return { byCategory, byNeighborhood }
}
