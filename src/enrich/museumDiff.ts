// src/enrich/museumDiff.ts
// Por qué los museos casi no cuestan (§6.6).
//
// Un museo cambia de horario dos veces al año y de exposición temporal tres o
// cuatro. El resto del tiempo, reprocesarlo es tirar el dinero. Con este flujo
// la colección C cuesta unos 0,12 €/mes en régimen estacionario, frente a los
// ~1,73 € del arranque. Es la mejor ilustración del principio general: un plan
// ya analizado nunca se vuelve a analizar.
import type { CuratedEvent } from '../../contracts/curated'
import type { Price, ScheduleSlot } from '../../contracts/event'
import type { Cluster } from '../types'
import { changeHash, priceFingerprint, type MuseumChangeKind } from '../core/hash'
import { norm } from '../core/text'

export interface VolatileFields {
  readonly openingHours: readonly ScheduleSlot[]
  readonly price: Price
  readonly freeAdmission: readonly string[]
  readonly currentExhibition?: { readonly title: string; readonly endsOn: string } | undefined
}

/** Los campos volátiles tal y como están hoy en la ficha publicada. */
export function volatileOfCard(card: CuratedEvent): VolatileFields {
  const museum = card.curated.museum
  return {
    openingHours: museum?.openingHours ?? card.schedule ?? [],
    price: card.price,
    freeAdmission: museum?.freeAdmission ?? [],
    currentExhibition: museum?.currentExhibition
      ? { title: museum.currentExhibition.title, endsOn: museum.currentExhibition.endsOn }
      : undefined,
  }
}

/** Los campos volátiles tal y como se acaban de extraer de la web oficial. */
export function volatileOfCluster(cluster: Cluster): VolatileFields {
  return {
    openingHours: cluster.schedule,
    price: cluster.price,
    freeAdmission: extractFreeAdmission(cluster),
    currentExhibition: undefined, // lo detecta el redactor, con evidencia
  }
}

const FREE_LINE =
  /\b(gratu[ai]t\w*|gratis|entrada lliure|entrada libre|free)\b[^.;]{0,90}/g

/** Franjas de entrada gratuita, en texto y sin interpretar. */
export function extractFreeAdmission(cluster: Cluster): string[] {
  const haystack = [cluster.priceTexts.join(' '), ...cluster.extracts.map((e) => e.text)].join(' ')
  const found = norm(haystack).match(FREE_LINE) ?? []
  return [...new Set(found.map((f) => f.trim()))].slice(0, 6).map((f) => f.slice(0, 120))
}

export interface MuseumDiff {
  readonly kind: MuseumChangeKind
  readonly previousHash: string | null
  readonly currentHash: string
  readonly changed: readonly string[]
}

/**
 * Compara lo publicado con lo recién extraído y decide qué hacer:
 *
 *   - `none`            → no se llama a ningún modelo. Coste: 0 €.
 *   - `structured-only` → cambiaron horarios o precios: se actualizan los campos
 *                         estructurados directamente. TAMPOCO se llama a ningún
 *                         modelo, porque el texto narrativo no hablaba de ellos.
 *   - `needs-rewrite`   → cambió la exposición temporal: ahí sí, porque el texto
 *                         sí la menciona. Se estima en unas 4 fichas al mes.
 */
export function diffMuseum(
  published: CuratedEvent | null,
  fresh: VolatileFields,
): MuseumDiff {
  const currentHash = changeHash(fresh)
  if (!published) {
    return { kind: 'needs-rewrite', previousHash: null, currentHash, changed: ['ficha nueva'] }
  }

  const previous = volatileOfCard(published)
  const previousHash = changeHash(previous)
  if (previousHash === currentHash) {
    return { kind: 'none', previousHash, currentHash, changed: [] }
  }

  const changed: string[] = []
  if (hoursKey(previous.openingHours) !== hoursKey(fresh.openingHours)) changed.push('horarios')
  if (priceFingerprint(previous.price) !== priceFingerprint(fresh.price)) changed.push('precio')
  if (freeKey(previous.freeAdmission) !== freeKey(fresh.freeAdmission)) changed.push('gratuidades')

  const exhibitionChanged =
    exhibitionKey(previous.currentExhibition) !== exhibitionKey(fresh.currentExhibition)
  if (exhibitionChanged) changed.push('exposición temporal')

  return {
    kind: exhibitionChanged ? 'needs-rewrite' : 'structured-only',
    previousHash,
    currentHash,
    changed,
  }
}

/**
 * Aplica un cambio `structured-only` sin tocar el texto: se actualizan precio,
 * horarios y gratuidades, y se conserva la redacción tal cual. Es lo que hace
 * que un cambio de horario no cueste un céntimo.
 */
export function applyStructuredUpdate(
  card: CuratedEvent,
  fresh: VolatileFields,
  curatedAt: string,
): CuratedEvent {
  return {
    ...card,
    price: fresh.price,
    schedule: [...fresh.openingHours],
    curated: {
      ...card.curated,
      curatedAt,
      museum: {
        ...card.curated.museum,
        openingHours: [...fresh.openingHours],
        freeAdmission: [...fresh.freeAdmission],
      },
    },
  }
}

function hoursKey(slots: readonly ScheduleSlot[]): string {
  return slots
    .map((s) => `${norm(s.days)}@${norm(s.hours)}`)
    .sort()
    .join(';')
}

function freeKey(lines: readonly string[]): string {
  return lines.map(norm).sort().join(';')
}

function exhibitionKey(e: { title: string; endsOn: string } | undefined): string {
  return e ? `${norm(e.title)}|${e.endsOn}` : ''
}
