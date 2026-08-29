// src/crawl/extract/jsonld.ts
// El extractor preferido: estable ante rediseños (§4.5). Es la razón por la que
// no hace falta un navegador y por la que un rediseño de la web no nos rompe:
// WordPress con Yoast o RankMath lo emite solo, y la mayoría de estas webs son eso.
import * as cheerio from 'cheerio'
import type { RawExtract } from '../../types'
import { stripHtml } from '../../core/text'

const INTERESTING = /Event|Museum|TouristAttraction|Place|ExhibitionEvent|TheaterEvent|MusicEvent|Festival/

type Node = Record<string, unknown>

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return stripHtml(v) || undefined
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return str(v[0])
  if (v && typeof v === 'object') {
    const n = v as Node
    return str(n['name'] ?? n['@value'] ?? n['text'])
  }
  return undefined
}

function firstUrl(v: unknown): string | undefined {
  if (typeof v === 'string') return v.startsWith('http') ? v : undefined
  if (Array.isArray(v)) {
    for (const item of v) {
      const u = firstUrl(item)
      if (u) return u
    }
    return undefined
  }
  if (v && typeof v === 'object') {
    const n = v as Node
    return firstUrl(n['url'] ?? n['contentUrl'] ?? n['@id'])
  }
  return undefined
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Number(v.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Aplana `@graph`, arrays anidados y nodos sueltos en una lista de nodos. */
export function flattenGraph(data: unknown, depth = 0): Node[] {
  if (depth > 6 || data === null || typeof data !== 'object') return []
  if (Array.isArray(data)) return data.flatMap((d) => flattenGraph(d, depth + 1))
  const node = data as Node
  const out: Node[] = [node]
  const graph = node['@graph']
  if (graph) out.push(...flattenGraph(graph, depth + 1))
  return out
}

function typeOf(node: Node): string {
  const t = node['@type']
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return t.filter((x) => typeof x === 'string').join(' ')
  return ''
}

/** Texto de precio a partir de `offers`, para que el parser de precios trabaje. */
function offersToText(offers: unknown): string | undefined {
  const nodes = flattenGraph(offers)
  const parts: string[] = []
  for (const o of nodes) {
    const price = num(o['price']) ?? num(o['lowPrice'])
    const high = num(o['highPrice'])
    const currency = str(o['priceCurrency'])
    if (price !== undefined) {
      parts.push(
        high !== undefined && high > price
          ? `de ${price} a ${high} ${currency ?? 'EUR'}`
          : `${price} ${currency ?? 'EUR'}`,
      )
    }
    const spec = o['priceSpecification']
    if (spec) {
      const s = offersToText(spec)
      if (s) parts.push(s)
    }
  }
  return parts.length > 0 ? parts.join(' | ') : undefined
}

function locationOf(node: Node): {
  venueName?: string | undefined
  address?: string | undefined
  lat?: number | undefined
  lng?: number | undefined
} {
  const loc = (node['location'] ?? node['containedInPlace'] ?? node) as Node | undefined
  if (!loc || typeof loc !== 'object') return {}
  const place = Array.isArray(loc) ? ((loc as Node[])[0] ?? {}) : loc

  const addr = place['address']
  let address: string | undefined
  if (typeof addr === 'string') address = stripHtml(addr)
  else if (addr && typeof addr === 'object') {
    const a = addr as Node
    address = [str(a['streetAddress']), str(a['postalCode']), str(a['addressLocality'])]
      .filter(Boolean)
      .join(', ')
  }

  const geo = place['geo'] as Node | undefined
  return {
    venueName: str(place['name']),
    address: address || undefined,
    lat: num(geo?.['latitude']),
    lng: num(geo?.['longitude']),
  }
}

/** Convierte `openingHoursSpecification` en líneas de horario legibles. */
function openingHoursLines(spec: unknown): string[] {
  const out: string[] = []
  for (const s of flattenGraph(spec)) {
    const days = s['dayOfWeek']
    const dayNames = (Array.isArray(days) ? days : [days])
      .map((d) => str(d)?.split('/').pop())
      .filter((d): d is string => Boolean(d))
    const opens = str(s['opens'])
    const closes = str(s['closes'])
    if (dayNames.length > 0 && opens) {
      out.push(`${dayNames.join(', ')}: ${opens}${closes ? `–${closes}` : ''}`)
    }
  }
  return out
}

/**
 * Extrae todos los nodos schema.org interesantes de una página. Un JSON roto se
 * ignora sin ruido: una web con un `<script>` mal cerrado no puede impedir que
 * se lea el resto.
 */
export function extractJsonLd(html: string): RawExtract[] {
  const $ = cheerio.load(html)
  const out: RawExtract[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown
    try {
      data = JSON.parse($(el).contents().text())
    } catch {
      return // JSON roto: se ignora
    }

    for (const node of flattenGraph(data)) {
      if (!INTERESTING.test(typeOf(node))) continue
      const loc = locationOf(node)
      const hours = openingHoursLines(node['openingHoursSpecification'])

      const extract: RawExtract = {
        via: 'jsonld',
        title: str(node['name']),
        description: str(node['description']),
        startDate: str(node['startDate']),
        endDate: str(node['endDate']),
        image: firstUrl(node['image']),
        url: firstUrl(node['url']),
        priceText: offersToText(node['offers']),
        offers: node['offers'],
        location: node['location'],
        openingHours: node['openingHoursSpecification'],
        scheduleLines: hours.length > 0 ? hours : undefined,
        officialUrl: firstUrl(node['sameAs']) ?? firstUrl(node['url']),
        ticketsUrl: firstUrl((node['offers'] as Node | undefined)?.['url']),
        venueName: loc.venueName,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
      }
      out.push(extract)
    }
  })

  return out
}
