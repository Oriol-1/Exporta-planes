// src/crawl/adapters/index.ts
// Un adaptador por fuente, más el registro. Un adaptador es DELIBERADAMENTE
// pequeño: los selectores propios de esa web y poco más. Todo lo que se pueda
// resolver de forma genérica vive en `extract/` y NO se duplica aquí — es la
// lección del §1.8: una sola copia de cada regla.
import type { CuratedCollection } from '../../../contracts/curated'
import type { RawExtract } from '../../types'
import { DEFAULT_SELECTORS, type SelectorMap } from '../extract'

export interface Adapter {
  readonly sourceId: string
  /** Selectores propios. Solo se usan si JSON-LD y OpenGraph no dieron nada. */
  readonly selectors: SelectorMap
  /** ¿Esta URL es una ficha, o es una portada/listado que no interesa? */
  isDetailUrl(url: string): boolean
  /** A qué colección aspira una URL de esta fuente. */
  collectionOf(url: string): CuratedCollection | null
  /** Retoques específicos tras la extracción genérica. Casi siempre, ninguno. */
  refine?(extract: RawExtract, url: string): RawExtract
}

/** Rutas que nunca son una ficha, sea cual sea la fuente. */
const NEVER_DETAIL =
  /\/(tag|tags|categoria|category|author|autor|page|pagina|search|buscar|feed|wp-json|wp-admin|amp)\//i

function looksLikeDetail(url: string): boolean {
  if (NEVER_DETAIL.test(url)) return false
  try {
    const path = new URL(url).pathname.replace(/\/$/, '')
    // Una portada ('' o '/es') no es una ficha; una ruta con dos o más
    // segmentos y un slug largo casi siempre lo es.
    const segments = path.split('/').filter(Boolean)
    if (segments.length < 2) return false
    const last = segments[segments.length - 1] ?? ''
    return last.length >= 8 && last.includes('-')
  } catch {
    return false
  }
}

function baseAdapter(
  sourceId: string,
  collections: readonly CuratedCollection[],
  selectors: SelectorMap = DEFAULT_SELECTORS,
  detect?: (url: string) => CuratedCollection | null,
): Adapter {
  return {
    sourceId,
    selectors,
    isDetailUrl: looksLikeDetail,
    collectionOf(url) {
      if (detect) {
        const found = detect(url)
        if (found) return found
      }
      return collections[0] ?? null
    },
  }
}

// ── Nivel A ─────────────────────────────────────────────────────────────────

const timeoutBcn: Adapter = baseAdapter(
  'timeout-bcn',
  ['plans', 'shows'],
  {
    title: 'h1',
    description: '[data-testid="summary_testID"], .article-summary',
    body: 'article, [data-testid="article-body"]',
    image: 'article img',
  },
  (url) => (/\/(teatro|musica|conciertos|theatre|music)\//i.test(url) ? 'shows' : 'plans'),
)

const barcelonaSecreta: Adapter = baseAdapter('barcelona-secreta', ['plans'], {
  title: 'h1',
  description: '.post-excerpt, .entry-excerpt',
  body: '.entry-content, article',
  image: '.wp-post-image, article img',
})

const lecoolBcn: Adapter = baseAdapter('lecool-bcn', ['plans', 'shows'])
const beteveAgenda: Adapter = baseAdapter('beteve-agenda', ['plans'])
const laVanguardia: Adapter = baseAdapter('lavanguardia-quehacer', ['plans'])

// ── Nivel B ─────────────────────────────────────────────────────────────────

const teatreBarcelona: Adapter = {
  ...baseAdapter('teatre-barcelona', ['shows'], {
    title: 'h1',
    description: '.sinopsis, .obra-sinopsi',
    body: '.obra-contingut, article, main',
    price: '.preus, .precios',
    schedule: '.horaris li, .funciones li',
    venue: '.teatre-nom, .sala',
    ticketsUrl: 'a.comprar, a[href*="entrades"], a[href*="entradas"]',
  }),
  // Su sitemap mezcla obras y salas; solo las obras son fichas.
  isDetailUrl: (url) => /\/obra[s]?\//i.test(url) || /\/espectacle/i.test(url),
}

const enderrockAgenda: Adapter = baseAdapter('enderrock-agenda', ['shows'])

const visitBarcelona: Adapter = baseAdapter(
  'visit-barcelona',
  ['plans', 'museums'],
  DEFAULT_SELECTORS,
  (url) => (/museu|museo|museum/i.test(url) ? 'museums' : 'plans'),
)

const bcnCultura: Adapter = baseAdapter(
  'bcn-cultura',
  ['plans', 'museums'],
  DEFAULT_SELECTORS,
  (url) => (/museu|museo|museum/i.test(url) ? 'museums' : 'plans'),
)

// ── Nivel C · solo verifican ────────────────────────────────────────────────

const articket: Adapter = baseAdapter('articket', ['museums'])
const museusBcn: Adapter = baseAdapter('museus-bcn', ['museums'])

/**
 * La ficha oficial del propio recinto. Acepta CUALQUIER URL, porque la URL no
 * la descubre un sitemap: la trae `config/museums.ts`. Sin esta excepción, el
 * filtro genérico de «esto parece una ficha» descartaría la home de un museo,
 * que es justo la página que hay que leer.
 */
const venueOfficial: Adapter = {
  ...baseAdapter('venue-official', ['museums'], {
    title: 'h1',
    body: 'main, article, .content',
    price: '[class*="preu"], [class*="precio"], [class*="price"], [class*="tarif"]',
    schedule: '[class*="horari"], [class*="horario"], [class*="hours"]',
  }),
  isDetailUrl: () => true,
}

export const ADAPTERS: readonly Adapter[] = [
  timeoutBcn,
  barcelonaSecreta,
  lecoolBcn,
  beteveAgenda,
  laVanguardia,
  teatreBarcelona,
  enderrockAgenda,
  visitBarcelona,
  bcnCultura,
  articket,
  museusBcn,
  venueOfficial,
]

const BY_ID = new Map(ADAPTERS.map((a) => [a.sourceId, a]))

export function adapterFor(sourceId: string): Adapter | undefined {
  return BY_ID.get(sourceId)
}
