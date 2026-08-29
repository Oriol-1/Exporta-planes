// src/normalize/geo.ts
// Coordenadas: el campo más importante que produce este proyecto, por delante
// incluso del texto (§1.11). Sin lat/lng correctas no hay mapa, ni cercanía, ni
// «cómo llegar», y planonmap no puede hacer nada con la ficha.
//
// Si no hay coordenadas, el candidato SE DESCARTA. Nunca se inventa una posición.
import type { Fetcher } from '../crawl/fetcher'
import { readGeocodeCache, writeGeocodeCache, type GeoPoint } from '../store/cache'
import { norm } from '../core/text'

/** Recuadro del área metropolitana. Fuera de él, el candidato se descarta (§4.7). */
export const BBOX = { minLat: 41.2, maxLat: 41.6, minLng: 1.9, maxLng: 2.35 } as const

export function inBarcelonaBbox(lat: number, lng: number): boolean {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng
}

/** Haversine, radio terrestre 6.371 km. El mismo que usa planonmap (§1.11). */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const toRad = (d: number): number => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

function cacheKeyOf(address: string): string {
  return norm(address)
}

/**
 * Geocodifica una dirección con Nominatim, con caché PERMANENTE: una dirección
 * se resuelve una vez en la vida (§7.1).
 *
 * Nominatim no es un plan gratuito con un contrato detrás; es un servicio
 * comunitario con una política de uso razonable. Con caché permanente estamos
 * tres órdenes de magnitud por debajo de lo que pediría un problema. Si no
 * responde, se devuelve `null` y el candidato se descarta — que es exactamente
 * lo correcto.
 */
export async function geocode(
  fetcher: Fetcher,
  address: string,
  now: Date,
): Promise<GeoPoint | null> {
  const key = cacheKeyOf(address)
  if (key.length < 6) return null

  const cache = await readGeocodeCache()
  const hit = cache[key]
  if (hit) return hit

  const url = `${NOMINATIM}?${new URLSearchParams({
    q: `${address}, Barcelona, Espanya`,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'es',
    viewbox: `${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng},${BBOX.minLat}`,
    bounded: '1',
  }).toString()}`

  // 1 petición/segundo es la política de Nominatim, y se respeta.
  const body = await fetcher.getPlain(url, 1100)
  if (body === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null

  const first = parsed[0] as Record<string, unknown>
  const lat = Number(first['lat'])
  const lng = Number(first['lon'])
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBarcelonaBbox(lat, lng)) return null

  const point: GeoPoint = {
    lat,
    lng,
    resolvedAt: now.toISOString(),
    displayName: typeof first['display_name'] === 'string' ? first['display_name'] : undefined,
  }
  cache[key] = point
  await writeGeocodeCache(cache)
  return point
}

/** Distritos de Barcelona, para las cuotas de variedad y para `venue.district`. */
const DISTRICTS = [
  'Ciutat Vella',
  'Eixample',
  'Sants-Montjuïc',
  'Les Corts',
  'Sarrià-Sant Gervasi',
  'Gràcia',
  'Horta-Guinardó',
  'Nou Barris',
  'Sant Andreu',
  'Sant Martí',
] as const

export function guessDistrict(text: string | undefined): string | undefined {
  if (!text) return undefined
  const t = norm(text)
  return DISTRICTS.find((d) => t.includes(norm(d)))
}

/** Slug estable de municipio, tal y como lo espera planonmap (§1.4). */
export function guessMunicipality(address: string | undefined): string {
  const t = norm(address)
  if (t.includes('hospitalet')) return 'lhospitalet'
  if (t.includes('badalona')) return 'badalona'
  if (t.includes('santa coloma')) return 'santacoloma'
  if (t.includes('cornella')) return 'cornella'
  if (t.includes('esplugues')) return 'esplugues'
  if (t.includes('sant adria')) return 'santadria'
  return 'barcelona'
}
