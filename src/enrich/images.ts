// src/enrich/images.ts
// El punto más delicado, y la decisión (§12.2).
//
// Una fotografía SÍ es obra protegida. Que una web exponga `og:image` no es una
// licencia para republicarla, y enlazarla en caliente tampoco resuelve el
// problema — el uso sigue existiendo, y además consume ancho de banda ajeno.
//
// DECISIÓN: bcn-curator NO publica imágenes de terceros. El campo `image` se
// rellena solo si la imagen supera la cascada de abajo. Es la opción
// conservadora, y es deliberada: el beneficio de tener foto no compensa el
// riesgo de republicar la de un medio. Una ficha sin foto no queda rota, porque
// los placeholders de planonmap están bien resueltos.
import type { Fetcher } from '../crawl/fetcher'

/** Licencias aceptables de Wikimedia Commons. Nada más entra por esta vía. */
const FREE_LICENSES = /^(cc0|public domain|pd-|cc[- ]by(?:[- ]sa)?([- ]\d(\.\d)?)?)/i

/**
 * Hosts YA presentes en la lista blanca de planonmap. Fuera de esta lista, la
 * imagen se descarta: aunque tuviéramos derecho a usarla, planonmap no la
 * pintaría, así que publicarla sería ensuciar el JSON para nada.
 */
const RENDERABLE_HOSTS = [
  'upload.wikimedia.org',
  'res.cloudinary.com',
  '.barcelona.cat',
  '.macba.cat',
  '.diba.cat',
  '.cultura.gencat.cat',
] as const

/** Hosts que NUNCA: medios, bancos de imágenes y capturas de pantalla. */
const NEVER_HOSTS = [
  'timeout.es',
  'timeout.com',
  'barcelonasecreta.com',
  'lavanguardia.com',
  'elperiodico.com',
  'shutterstock',
  'gettyimages',
  'istockphoto',
  'unsplash.com',
] as const

export interface ResolvedImage {
  readonly url: string
  readonly credit: string
  readonly source: 'wikimedia' | 'venue' | 'owner'
}

export function isRenderableHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (NEVER_HOSTS.some((h) => host.includes(h))) return false
    return RENDERABLE_HOSTS.some((h) => (h.startsWith('.') ? host.endsWith(h.slice(1)) : host === h))
  } catch {
    return false
  }
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

/**
 * Vía 1 de la cascada: imagen con licencia libre VERIFICADA. Se consulta la API
 * de Commons para leer la licencia real del archivo —no se supone— y se guarda
 * la atribución exacta.
 */
export async function findCommonsImage(
  fetcher: Fetcher,
  query: string,
): Promise<ResolvedImage | null> {
  const searchUrl = `${COMMONS_API}?${new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '3',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200',
  }).toString()}`

  const body = await fetcher.getPlain(searchUrl, 1100)
  if (body === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  const pages = (parsed as { query?: { pages?: Record<string, unknown> } }).query?.pages
  if (!pages) return null

  for (const page of Object.values(pages)) {
    const info = (page as { imageinfo?: Record<string, unknown>[] }).imageinfo?.[0]
    if (!info) continue

    const meta = info['extmetadata'] as Record<string, { value?: string }> | undefined
    const license = meta?.['LicenseShortName']?.value ?? meta?.['License']?.value ?? ''
    if (!FREE_LICENSES.test(license.trim())) continue

    const url = (info['thumburl'] ?? info['url']) as string | undefined
    if (!url || !isRenderableHost(url)) continue

    const author = stripTags(meta?.['Artist']?.value ?? 'Wikimedia Commons')
    return {
      url,
      credit: `${author} · ${license.trim()} · Wikimedia Commons`,
      source: 'wikimedia',
    }
  }

  return null
}

/**
 * Vía 2: imagen del propio recinto público, y solo si su dominio ya está en la
 * lista de hosts renderizables de planonmap.
 */
export function venueImage(url: string | undefined, venueName: string): ResolvedImage | null {
  if (!url || !isRenderableHost(url)) return null
  return { url, credit: venueName, source: 'venue' }
}

/**
 * La cascada completa. Vía 4 —«nada»— es un resultado legítimo y el más común:
 * se omite `image` y planonmap aplica su propia cascada (foto del espacio →
 * cartel de la fiesta → placeholder degradado por categoría).
 */
export async function resolveImage(
  fetcher: Fetcher,
  opts: {
    readonly venueName: string
    readonly candidateUrl?: string | undefined
    readonly searchQuery?: string | undefined
    readonly allowCommons?: boolean | undefined
  },
): Promise<ResolvedImage | null> {
  const fromVenue = venueImage(opts.candidateUrl, opts.venueName)
  if (fromVenue) return fromVenue

  if (opts.allowCommons !== false) {
    const commons = await findCommonsImage(fetcher, opts.searchQuery ?? opts.venueName)
    if (commons) return commons
  }

  return null
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
