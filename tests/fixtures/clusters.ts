// tests/fixtures/clusters.ts
// Constructores de clusters para los tests. El «ahora» se inyecta siempre, así
// que estas fechas fijas no caducan solas.
import type { Cluster, ScoredCluster, ScreenVerdict, SourceRef } from '../../src/types'
import type { Category, Price } from '../../contracts/event'
import type { CuratedCollection } from '../../contracts/curated'
import { semanticHash } from '../../src/core/hash'
import { dedupeKey } from '../../src/cluster/planonmapKey'

export const NOW = new Date('2026-09-03T02:30:00Z')
export const NOW_ISO = '2026-09-03T04:30:00.000+02:00'

export function sourceRef(
  id: string,
  tier: 'A' | 'B' | 'C',
  trust: number,
): SourceRef {
  return {
    id,
    tier,
    trust,
    url: `https://ejemplo.test/${id}/ficha`,
    retrievedAt: NOW_ISO,
  }
}

export interface ClusterOverrides {
  clusterId?: string
  collection?: CuratedCollection
  title?: string
  sources?: SourceRef[]
  startDate?: string | undefined
  endDate?: string | undefined
  price?: Price
  category?: Category
  lat?: number
  lng?: number
  neighborhood?: string
  venueName?: string
  description?: string
  officialUrl?: string | undefined
  schedule?: { days: string; hours: string }[]
  extractText?: string
  seedSlug?: string | undefined
  image?: string | undefined
}

export function makeCluster(overrides: ClusterOverrides = {}): Cluster {
  const title = overrides.title ?? 'Exposicion de prueba en Barcelona'
  const startDate = 'startDate' in overrides ? overrides.startDate : '2026-09-10T19:30:00.000+02:00'
  const venue = {
    name: overrides.venueName ?? 'Sala de prueba',
    address: 'Carrer de Prova, 1, 08001 Barcelona',
    lat: overrides.lat ?? 41.3851,
    lng: overrides.lng ?? 2.1734,
    neighborhood: overrides.neighborhood ?? 'El Gotic',
    district: 'Ciutat Vella',
    municipality: 'barcelona',
    locationPrecision: 'exact' as const,
  }

  const schedule = overrides.schedule ?? [{ days: 'De martes a domingo', hours: '10:00-19:00' }]
  const description =
    overrides.description ??
    'Una exposicion con material suficiente para poder escribir una ficha honesta sobre ella, ' +
      'con datos practicos claros y sin lenguaje promocional de ninguna clase.'

  const base: Cluster = {
    clusterId: overrides.clusterId ?? 'exposicion-de-prueba',
    collection: overrides.collection ?? 'plans',
    title,
    titles: [title],
    description,
    sources: overrides.sources ?? [sourceRef('timeout-bcn', 'A', 1)],
    startDate,
    endDate: 'endDate' in overrides ? overrides.endDate : undefined,
    timeConfidence: 'exact',
    dateSummary: startDate ? startDate.slice(0, 10) : 'permanente',
    schedule,
    scheduleLines: schedule.map((s) => `${s.days}: ${s.hours}`),
    venue,
    category: overrides.category ?? 'culture',
    price: overrides.price ?? { type: 'paid', amount: 12, currency: 'EUR' },
    priceTexts: ['Entrada general 12 €'],
    officialUrl: 'officialUrl' in overrides ? overrides.officialUrl : 'https://ejemplo.test/oficial',
    ticketsUrl: undefined,
    image: 'image' in overrides ? overrides.image : undefined,
    transitHints: ['Jaume I (L4) · metro 300 m'],
    extracts: [
      {
        url: 'https://ejemplo.test/timeout-bcn/ficha',
        text:
          overrides.extractText ??
          'La sala abre de martes a domingo y la entrada general cuesta 12 euros. ' +
            'El recorrido dura aproximadamente una hora y media y no hace falta saber ningun idioma.',
      },
    ],
    planonmapDedupeKey: dedupeKey({
      title,
      startDate: startDate ?? '2026-09-03T00:00:00+02:00',
      venue,
    }),
    semanticHash: '',
    firstSeen: NOW_ISO,
    seedSlug: overrides.seedSlug,
  }

  return { ...base, semanticHash: semanticHash(base) }
}

export function makeVerdict(overrides: Partial<ScreenVerdict> = {}): ScreenVerdict {
  return {
    id: 'exposicion-de-prueba',
    vale_el_viaje: 12,
    caracteristico_bcn: 12,
    sin_barrera_idioma: 8,
    no_trampa_turistica: 12,
    es_trampa_turistica: false,
    es_generico_europeo: false,
    requiere_ser_local: false,
    es_marca_disfrazada: false,
    temporalidad: 'temporada',
    motivo: 'Buena exposicion accesible sin idioma',
    ...overrides,
  }
}

export function makeScored(
  cluster: Cluster,
  total: number,
  temporality: 'atemporal' | 'temporada' = 'temporada',
): ScoredCluster {
  return {
    cluster,
    deterministic: { consensus: 18, completeness: 10, freshness: 5, reputation: 4, total: 37 },
    verdict: makeVerdict({ id: cluster.clusterId, temporalidad: temporality }),
    llmPoints: Math.max(0, total - 37),
    total,
    vetoed: false,
    temporality,
  }
}
