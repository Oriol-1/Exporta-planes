// src/normalize/toCandidate.ts
// De crudo a `Candidate` (§4.7): un `Event` incompleto más metadatos de
// procedencia. Es el punto donde el proyecto deja de hablar de páginas web y
// empieza a hablar de planes.
import type { SourceConfig } from '../../config/schema'
import type { CuratedCollection } from '../../contracts/curated'
import type { ScheduleSlot } from '../../contracts/event'
import type { Candidate, RawExtract } from '../types'
import { classify, deriveTags } from './category'
import { parseDate, museumWindow } from './dates'
import { bestPrice } from './price'
import { guessDistrict, guessMunicipality, inBarcelonaBbox } from './geo'
import { clip, stripHtml } from '../core/text'

export type NormalizeFailure =
  | 'sin-titulo'
  | 'sin-fecha'
  | 'sin-coordenadas'
  | 'fuera-de-barcelona'

export type NormalizeResult =
  | { readonly ok: true; readonly candidate: Candidate }
  | { readonly ok: false; readonly reason: NormalizeFailure }

export interface NormalizeInput {
  readonly extract: RawExtract
  readonly url: string
  readonly source: SourceConfig
  readonly collection: CuratedCollection
  readonly retrievedAt: string
  readonly now: Date
  /** Coordenadas ya resueltas (del catálogo o de la geocodificación). */
  readonly coords?: { readonly lat: number; readonly lng: number } | undefined
  /** Datos del catálogo de museos, que mandan sobre lo extraído. */
  readonly seed?:
    | {
        readonly slug: string
        readonly name: string
        readonly address: string
        readonly neighborhood?: string | undefined
        readonly district?: string | undefined
        readonly municipality?: string | undefined
        readonly zipCode?: string | undefined
        readonly officialUrl: string
        readonly ticketsUrl?: string | undefined
      }
    | undefined
}

/** Convierte líneas sueltas de horario en tramos `{days, hours}`. */
export function toScheduleSlots(lines: readonly string[] | undefined): ScheduleSlot[] {
  if (!lines) return []
  const out: ScheduleSlot[] = []
  for (const raw of lines.slice(0, 12)) {
    const line = stripHtml(raw)
    if (line.length < 3) continue
    const split = /^(.{2,40}?)\s*[:·—–-]\s*(.{2,60})$/.exec(line)
    if (split?.[1] && split[2]) {
      out.push({ days: split[1].trim(), hours: split[2].trim() })
    } else {
      out.push({ days: '', hours: line })
    }
  }
  return out
}

/**
 * Normaliza un extracto al esquema común. Devuelve el motivo del descarte en vez
 * de lanzar: el rastreo procesa cientos de páginas y necesita seguir (§4.4).
 */
export function toCandidate(input: NormalizeInput): NormalizeResult {
  const { extract, url, source, collection, seed } = input

  const title = stripHtml(seed?.name ?? extract.title ?? '')
  if (title.length === 0) return { ok: false, reason: 'sin-titulo' }

  // ── Coordenadas. Sin ellas no hay ficha: se descarta, nunca se inventan.
  const lat = input.coords?.lat ?? extract.lat
  const lng = input.coords?.lng ?? extract.lng
  if (lat === undefined || lng === undefined) return { ok: false, reason: 'sin-coordenadas' }
  if (!inBarcelonaBbox(lat, lng)) return { ok: false, reason: 'fuera-de-barcelona' }

  // ── Fechas. Un museo no tiene fecha propia: usa el convenio del §8.5.
  let startDate: string | undefined
  let endDate: string | undefined
  let timeConfidence: 'exact' | 'day' = 'day'

  if (collection === 'museums') {
    const window = museumWindow(input.now)
    startDate = window.startDate
    endDate = window.endDate
    timeConfidence = 'day'
  } else {
    const start = parseDate(extract.startDate)
    if (start === null) return { ok: false, reason: 'sin-fecha' }
    startDate = start.iso
    timeConfidence = start.confidence
    endDate = parseDate(extract.endDate)?.iso
  }

  const address = stripHtml(seed?.address ?? extract.address ?? '') || title
  const description = clip(stripHtml(extract.description ?? extract.bodyText ?? ''), 2000)
  const bodyText = stripHtml(extract.bodyText ?? extract.description ?? '')

  const priceTexts = [extract.priceText, ...(extract.scheduleLines ?? [])].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  )
  const price = bestPrice([extract.priceText, bodyText.slice(0, 1500)])

  const classification = classify(`${title} ${description}`, collection)
  const district = seed?.district ?? guessDistrict(address) ?? guessDistrict(description)
  const municipality = seed?.municipality ?? guessMunicipality(address)

  const candidate: Candidate = {
    sourceId: source.id,
    tier: source.tier,
    trust: source.trust,
    url,
    collection,
    title,
    description,
    startDate,
    endDate,
    timeConfidence,
    schedule: toScheduleSlots(extract.scheduleLines),
    venue: {
      name: stripHtml(seed?.name ?? extract.venueName ?? title),
      address,
      lat,
      lng,
      ...(seed?.neighborhood ? { neighborhood: seed.neighborhood } : {}),
      ...(district ? { district } : {}),
      municipality,
      ...(seed?.zipCode ? { zipCode: seed.zipCode } : {}),
      locationPrecision: input.coords !== undefined || extract.lat !== undefined ? 'exact' : 'neighborhood',
    },
    category: classification.category,
    price,
    priceTexts,
    officialUrl: seed?.officialUrl ?? extract.officialUrl ?? undefined,
    ticketsUrl: seed?.ticketsUrl ?? extract.ticketsUrl ?? undefined,
    // La imagen NO se copia aquí: pasa por la cascada de licencias del §12.2.
    image: undefined,
    bodyText,
    retrievedAt: input.retrievedAt,
    seedSlug: seed?.slug,
  }

  return { ok: true, candidate }
}

/** Etiquetas del candidato, ya normalizadas. Reexportado por comodidad. */
export { deriveTags }
