// src/cluster/planonmapKey.ts
// El algoritmo de deduplicación de planonmap, reproducido CARÁCTER POR CARÁCTER
// (§1.9). Es lo que permite decir «este plan curado ya está en el feed».
//
// AVISO que viaja también en el contrato: para una ficha ATEMPORAL esta clave es
// INESTABLE POR CONSTRUCCIÓN (§4.9). El `startDate` de un museo rueda hacia
// delante en cada refresco semanal, así que su `dedupeKey` cambia cada semana.
// La identidad SIEMPRE es el `slug`; `dedupeKey` no es un identificador, es una
// heurística de emparejamiento con un feed ajeno, y solo sirve donde la fecha
// significa algo.
import { normalizeTitleForDedupe } from '../core/text'
import { haversineMeters } from '../normalize/geo'
import { titleSimilarity } from '../core/text'

export interface DedupeInput {
  readonly title: string
  readonly startDate: string
  readonly venue: { readonly lat: number; readonly lng: number }
}

/** Copia literal de `lib/sources/dedupe.ts::dedupeKey` de planonmap. */
export function dedupeKey(event: DedupeInput): string {
  const slug = normalizeTitleForDedupe(event.title)
  const date = event.startDate.slice(0, 10) // "2026-09-10"
  const lat = event.venue.lat.toFixed(2) // ~1,1 km de precisión
  const lng = event.venue.lng.toFixed(2)
  return `${slug}|${date}|${lat}|${lng}`
}

/** Umbrales de la vía de emparejamiento por proximidad, para lo atemporal (§4.9). */
export const PROXIMITY_MATCH = { maxMeters: 150, minTitleSimilarity: 0.82 } as const

/**
 * La vía correcta para emparejar una ficha ATEMPORAL con el feed abierto:
 * coordenadas a menos de 150 m y similitud de títulos ≥ 0,82. Nunca `dedupeKey`.
 */
export function matchesByProximity(
  a: { title: string; venue: { lat: number; lng: number } },
  b: { title: string; venue: { lat: number; lng: number } },
): boolean {
  if (haversineMeters(a.venue, b.venue) > PROXIMITY_MATCH.maxMeters) return false
  return titleSimilarity(a.title, b.title) >= PROXIMITY_MATCH.minTitleSimilarity
}

/**
 * Pista de fusión para planonmap: ¿esperamos que este plan ya exista en su feed
 * de datos abiertos, o es nuevo? Es una pista, no una orden: quien decide es el
 * consumidor.
 */
export function mergeHint(
  temporality: 'atemporal' | 'temporada',
  sources: readonly { readonly id: string }[],
): 'new' | 'merge' {
  // Los recintos públicos publican su temporada en la agenda del Ajuntament, así
  // que es muy probable que planonmap ya los tenga por la vía de datos abiertos.
  const institutional = new Set(['bcn-cultura', 'museus-bcn', 'visit-barcelona', 'teatre-barcelona'])
  const hasInstitutional = sources.some((s) => institutional.has(s.id))
  if (temporality === 'temporada' && hasInstitutional) return 'merge'
  return 'new'
}
