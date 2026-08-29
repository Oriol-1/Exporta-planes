// src/normalize/transit.ts
// Paradas de metro, bus, FGC y Rodalies a menos de 500 m, de Overpass API.
//
// Se hace FUERA del modelo a propósito (§6.2): es un dato objetivo y gratis, y
// pedirle al modelo que adivine la parada de metro es la forma más rápida de
// tener una alucinación con aspecto de dato.
import type { Fetcher } from '../crawl/fetcher'
import { readTransitCache, writeTransitCache } from '../store/cache'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const RADIUS_M = 500
const MAX_HINTS = 4

/** Clave por coordenada redondeada: dos museos de la misma calle comparten caché. */
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

interface OverpassElement {
  readonly tags?: Record<string, string> | undefined
  readonly lat?: number | undefined
  readonly lon?: number | undefined
  readonly center?: { lat: number; lon: number } | undefined
}

function describe(el: OverpassElement, origin: { lat: number; lng: number }): string | null {
  const tags = el.tags ?? {}
  const name = tags['name']
  if (!name) return null

  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  const distance =
    lat !== undefined && lon !== undefined
      ? Math.round(
          Math.hypot((lat - origin.lat) * 111_320, (lon - origin.lng) * 111_320 * 0.75) / 10,
        ) * 10
      : null

  const line = tags['ref'] ?? tags['route_ref'] ?? tags['network']
  const mode =
    tags['station'] === 'subway' || tags['subway'] === 'yes'
      ? 'metro'
      : tags['train'] === 'yes'
        ? 'tren'
        : tags['tram'] === 'yes'
          ? 'tram'
          : 'bus'

  const parts = [name]
  if (line) parts.push(`(${line})`)
  parts.push(`· ${mode}`)
  if (distance !== null) parts.push(`${distance} m`)
  return parts.join(' ')
}

/**
 * Paradas cercanas a una coordenada, cacheadas para siempre. Si Overpass no
 * responde se devuelve lista vacía: la ficha se publica igual y el campo
 * `comoLlegar` simplemente se omite (§6.4). Es agradable, no imprescindible.
 */
export async function nearbyTransit(
  fetcher: Fetcher,
  lat: number,
  lng: number,
): Promise<readonly string[]> {
  const key = coordKey(lat, lng)
  const cache = await readTransitCache()
  const hit = cache[key]
  if (hit) return hit

  const query = `
[out:json][timeout:20];
(
  node(around:${RADIUS_M},${lat},${lng})[railway=station];
  node(around:${RADIUS_M},${lat},${lng})[station=subway];
  node(around:${RADIUS_M},${lat},${lng})[highway=bus_stop];
  node(around:${RADIUS_M},${lat},${lng})[public_transport=station];
);
out center ${MAX_HINTS * 5};`

  const body = await fetcher.getPlain(`${OVERPASS}?data=${encodeURIComponent(query)}`, 1100)
  if (body === null) return []

  let parsed: { elements?: OverpassElement[] }
  try {
    parsed = JSON.parse(body) as { elements?: OverpassElement[] }
  } catch {
    return []
  }

  const seen = new Set<string>()
  const hints: string[] = []
  for (const el of parsed.elements ?? []) {
    const line = describe(el, { lat, lng })
    if (!line) continue
    const name = el.tags?.['name'] ?? ''
    if (seen.has(name)) continue
    seen.add(name)
    hints.push(line)
    if (hints.length >= MAX_HINTS) break
  }

  cache[key] = hints
  await writeTransitCache(cache)
  return hints
}
