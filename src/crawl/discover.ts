// src/crawl/discover.ts
// Descubrimiento por sitemap y RSS. El rastreador NO navega: pide el sitemap o
// el RSS, mira `lastmod`/`pubDate` y descarga solo lo que cambió (§4.2). Esto
// reduce el tráfico en dos órdenes de magnitud, es lo que los sitios esperan que
// hagas, y es lo que hace viable el «coste cero».
import { XMLParser } from 'fast-xml-parser'
import type { SourceConfig } from '../../config/schema'
import type { Fetcher } from './fetcher'
import { MUSEUMS } from '../../config/museums'

/** Tope de sub-sitemaps por fuente: un índice enorme no puede comerse el día. */
const MAX_SUBSITEMAPS = 8

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
})

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function textOf(node: unknown): string | undefined {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (node && typeof node === 'object' && '#text' in node) {
    const t = (node as Record<string, unknown>)['#text']
    return typeof t === 'string' ? t : undefined
  }
  return undefined
}

export interface DiscoveredUrl {
  readonly url: string
  readonly lastmod?: string | undefined
}

export interface DiscoveryResult {
  readonly urls: readonly DiscoveredUrl[]
  readonly notes: readonly string[]
}

async function fetchXml(
  fetcher: Fetcher,
  url: string,
  source: SourceConfig,
): Promise<unknown> {
  const res = await fetcher.get(url, source)
  if (!res.ok || res.value.body === null) return null
  try {
    return parser.parse(res.value.body) as unknown
  } catch {
    return null
  }
}

/** Sub-sitemaps que casi nunca traen contenido: taxonomías y metadatos. */
const TAXONOMY_SITEMAP = /(category|categoria|tag|taxonom|author|autor|genere|professional|original_title)[-_]?sitemap/i

/**
 * Elige qué sub-sitemaps leer cuando hay más de los que caben en el tope.
 *
 * Leer «los ocho primeros» es lo que parece obvio y es justo lo que falla: un
 * índice de WordPress los lista por tipo, y los primeros suelen ser taxonomías y
 * archivos históricos. En barcelonasecreta.com los ocho primeros son páginas,
 * categorías, autores y artículos de 2018; el contenido vivo está en el octavo
 * archivo de `posts_v2`. Aquí se filtra por lo que pida la fuente, se descartan
 * las taxonomías y se ordena por `lastmod` descendente.
 */
export function chooseSubSitemaps(
  maps: readonly DiscoveredUrl[],
  includes: readonly string[] | undefined,
  limit: number,
): DiscoveredUrl[] {
  let candidates = [...maps]

  if (includes && includes.length > 0) {
    const filtered = candidates.filter((m) => includes.some((i) => m.url.includes(i)))
    // Si el filtro no casa con nada, la fuente ha cambiado su estructura: mejor
    // seguir con todos que quedarse a ciegas sin decir nada.
    if (filtered.length > 0) candidates = filtered
  } else {
    const withoutTaxonomy = candidates.filter((m) => !TAXONOMY_SITEMAP.test(m.url))
    if (withoutTaxonomy.length > 0) candidates = withoutTaxonomy
  }

  // Lo más recientemente modificado primero; sin `lastmod`, al final.
  candidates.sort((a, b) => {
    const ta = a.lastmod ? Date.parse(a.lastmod) : Number.NEGATIVE_INFINITY
    const tb = b.lastmod ? Date.parse(b.lastmod) : Number.NEGATIVE_INFINITY
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
    return (Number.isNaN(tb) ? Number.NEGATIVE_INFINITY : tb) - (Number.isNaN(ta) ? Number.NEGATIVE_INFINITY : ta)
  })

  return candidates.slice(0, limit)
}

function collectSitemapUrls(doc: unknown): { maps: DiscoveredUrl[]; urls: DiscoveredUrl[] } {
  const maps: DiscoveredUrl[] = []
  const urls: DiscoveredUrl[] = []
  const root = doc as Record<string, unknown> | null
  if (!root) return { maps, urls }

  const index = root['sitemapindex'] as Record<string, unknown> | undefined
  if (index) {
    for (const sm of asArray(index['sitemap'] as Record<string, unknown> | Record<string, unknown>[])) {
      const loc = textOf(sm['loc'])
      if (loc) maps.push({ url: loc, lastmod: textOf(sm['lastmod']) })
    }
  }

  const urlset = root['urlset'] as Record<string, unknown> | undefined
  if (urlset) {
    for (const u of asArray(urlset['url'] as Record<string, unknown> | Record<string, unknown>[])) {
      const loc = textOf(u['loc'])
      if (!loc) continue
      urls.push({ url: loc, lastmod: textOf(u['lastmod']) })
    }
  }

  return { maps, urls }
}

function collectRssUrls(doc: unknown): DiscoveredUrl[] {
  const root = doc as Record<string, unknown> | null
  if (!root) return []
  const out: DiscoveredUrl[] = []

  // RSS 2.0
  const rss = root['rss'] as Record<string, unknown> | undefined
  const channel = rss?.['channel'] as Record<string, unknown> | undefined
  for (const item of asArray(channel?.['item'] as Record<string, unknown> | Record<string, unknown>[])) {
    const link = textOf(item['link'])
    if (link) out.push({ url: link, lastmod: textOf(item['pubDate']) })
  }

  // Atom
  const feed = root['feed'] as Record<string, unknown> | undefined
  for (const entry of asArray(feed?.['entry'] as Record<string, unknown> | Record<string, unknown>[])) {
    const link = entry['link'] as Record<string, unknown> | Record<string, unknown>[] | undefined
    const href = Array.isArray(link)
      ? (link[0]?.['@_href'] as string | undefined)
      : (link?.['@_href'] as string | undefined)
    if (href) out.push({ url: href, lastmod: textOf(entry['updated']) })
  }

  return out
}

/**
 * URL candidatas de una fuente, ya filtradas por fecha y por ruta y acotadas a
 * `maxPagesPerDay`. `since` es la última vez que se rastreó esta fuente.
 */
export async function discover(
  fetcher: Fetcher,
  source: SourceConfig,
  since: Date,
): Promise<DiscoveryResult> {
  const notes: string[] = []

  switch (source.discovery.kind) {
    case 'sitemap': {
      const entry =
        source.discovery.url ??
        (source.home ? new URL('/sitemap.xml', source.home).href : null)
      if (!entry) {
        return { urls: [], notes: ['sitemap sin URL y sin home: nada que pedir'] }
      }

      const first = await fetchXml(fetcher, entry, source)
      if (first === null) return { urls: [], notes: [`sitemap ilegible: ${entry}`] }

      const { maps, urls } = collectSitemapUrls(first)
      const all: DiscoveredUrl[] = [...urls]

      const chosen = chooseSubSitemaps(maps, source.discovery.sitemapIncludes, MAX_SUBSITEMAPS)
      for (const map of chosen) {
        const sub = await fetchXml(fetcher, map.url, source)
        if (sub === null) {
          notes.push(`sub-sitemap ilegible: ${map.url}`)
          continue
        }
        all.push(...collectSitemapUrls(sub).urls)
      }
      if (maps.length > chosen.length) {
        notes.push(
          `${maps.length} sub-sitemaps; se leyeron ${chosen.length}: ` +
            chosen.map((m) => m.url.split('/').pop()).join(', '),
        )
      }

      const pathIncludes = source.discovery.pathIncludes
      const filtered = all.filter((u) => {
        if (u.lastmod) {
          const at = new Date(u.lastmod)
          if (!Number.isNaN(at.getTime()) && at < since) return false
        }
        if (pathIncludes && !pathIncludes.some((p) => u.url.includes(p))) return false
        return true
      })

      return { urls: dedupe(filtered).slice(0, source.maxPagesPerDay), notes }
    }

    case 'rss': {
      const doc = await fetchXml(fetcher, source.discovery.url, source)
      if (doc === null) return { urls: [], notes: [`RSS ilegible: ${source.discovery.url}`] }
      const items = collectRssUrls(doc).filter((u) => {
        if (!u.lastmod) return true
        const at = new Date(u.lastmod)
        return Number.isNaN(at.getTime()) || at >= since
      })
      return { urls: dedupe(items).slice(0, source.maxPagesPerDay), notes }
    }

    case 'perEntity': {
      // La URL sale del catálogo, no de la web: un museo se consulta en SU ficha
      // oficial. Es lo que permite verificar precio y horario contra la fuente
      // que manda de verdad.
      const urls = MUSEUMS.filter((m) => m.enabled !== false).flatMap((m) => {
        const target = m.hoursUrl ?? m.officialUrl
        return [{ url: target, lastmod: undefined }]
      })
      return { urls: urls.slice(0, source.maxPagesPerDay), notes }
    }

    case 'manual':
      // Fuente que se consulta solo cuando alguien pega una URL a mano. No
      // descubre nada por su cuenta, y eso es deliberado.
      return { urls: [], notes: ['descubrimiento manual: sin URL automáticas'] }
  }
}

function dedupe(urls: readonly DiscoveredUrl[]): DiscoveredUrl[] {
  const seen = new Set<string>()
  const out: DiscoveredUrl[] = []
  for (const u of urls) {
    const key = u.url.split('#')[0] ?? u.url
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ url: key, lastmod: u.lastmod })
  }
  return out
}
