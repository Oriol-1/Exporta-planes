// src/crawl/extract/index.ts
// Los tres niveles se intentan EN ORDEN y se FUSIONAN: cada campo se queda con
// el primer valor no vacío (§4.5). El orden es del más estable al más frágil, y
// esa es toda la estrategia anti-rediseño.
import type { RawExtract } from '../../types'
import { extractJsonLd } from './jsonld'
import { extractOpenGraph } from './opengraph'
import { DEFAULT_SELECTORS, extractBodyText, extractWithSelectors, type SelectorMap } from './selectors'

export type { SelectorMap } from './selectors'
export { DEFAULT_SELECTORS, extractBodyText } from './selectors'
export { extractJsonLd } from './jsonld'
export { extractOpenGraph } from './opengraph'

/** Primer valor no vacío de una lista de candidatos. */
function first<T>(values: readonly (T | undefined)[]): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim().length > 0)) return v
  }
  return undefined
}

/**
 * Fusiona varios extractos en uno. La fuente de cada campo queda implícita en el
 * orden: lo que venga de JSON-LD gana a OpenGraph, y OpenGraph gana a selectores.
 */
export function mergeExtracts(extracts: readonly RawExtract[]): RawExtract | null {
  if (extracts.length === 0) return null
  const via = extracts[0]?.via ?? 'selectors'

  return {
    via,
    title: first(extracts.map((e) => e.title)),
    description: first(extracts.map((e) => e.description)),
    startDate: first(extracts.map((e) => e.startDate)),
    endDate: first(extracts.map((e) => e.endDate)),
    image: first(extracts.map((e) => e.image)),
    url: first(extracts.map((e) => e.url)),
    priceText: first(extracts.map((e) => e.priceText)),
    offers: first(extracts.map((e) => e.offers)),
    location: first(extracts.map((e) => e.location)),
    openingHours: first(extracts.map((e) => e.openingHours)),
    scheduleLines: first(extracts.map((e) => e.scheduleLines)),
    officialUrl: first(extracts.map((e) => e.officialUrl)),
    ticketsUrl: first(extracts.map((e) => e.ticketsUrl)),
    venueName: first(extracts.map((e) => e.venueName)),
    address: first(extracts.map((e) => e.address)),
    lat: first(extracts.map((e) => e.lat)),
    lng: first(extracts.map((e) => e.lng)),
    bodyText: first(extracts.map((e) => e.bodyText)),
  }
}

export interface ExtractionOutcome {
  readonly extract: RawExtract | null
  /** Cuántos elementos válidos vio cada nivel. Alimenta el canario (§4.6). */
  readonly counts: { readonly jsonld: number; readonly opengraph: number; readonly selectors: number }
}

/**
 * Extracción completa de una página. Devuelve además el recuento por nivel,
 * porque es lo que el canario de rendimiento necesita para detectar que una web
 * ha cambiado su HTML antes de que la degradación se vuelva silenciosa.
 */
export function extractAll(html: string, selectors: SelectorMap = DEFAULT_SELECTORS): ExtractionOutcome {
  const jsonld = extractJsonLd(html)
  const opengraph = extractOpenGraph(html)
  const bySelectors = extractWithSelectors(html, selectors)

  const merged = mergeExtracts([...jsonld, ...opengraph, ...bySelectors])
  if (merged === null) {
    return { extract: null, counts: { jsonld: 0, opengraph: 0, selectors: 0 } }
  }

  return {
    extract: { ...merged, bodyText: merged.bodyText ?? extractBodyText(html) },
    counts: { jsonld: jsonld.length, opengraph: opengraph.length, selectors: bySelectors.length },
  }
}

/** Cuántos de los campos que importan vienen vacíos. Alimenta el canario (§4.6). */
export function emptyFieldRate(extract: RawExtract): number {
  const fields = [
    extract.title,
    extract.description,
    extract.startDate,
    extract.priceText,
    extract.venueName,
    extract.address,
    extract.image,
  ]
  const empty = fields.filter((f) => f === undefined || f === '').length
  return empty / fields.length
}
