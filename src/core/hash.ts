// src/core/hash.ts
// LA CLAVE DE CACHÉ: sobre el SIGNIFICADO, nunca sobre los bytes (§5.2).
//
// Es lo que decide si el proyecto cuesta tres euros o treinta. La tentación es
// cachear por el hash del HTML descargado, y sería un error caro: casi todas
// estas webs cambian bytes a diario sin cambiar nada relevante —un contador de
// comentarios, un «últimas entradas», un carrusel de relacionados, un token
// anti-CSRF—. Con un hash del HTML, el descarte del paso 1 se desplomaría del
// 84 % a casi cero y se pagaría por reanalizar lo mismo un día tras otro.
import { createHash } from 'node:crypto'
import type { Price } from '../../contracts/event'
import type { Candidate, Cluster } from '../types'
import { norm } from './text'

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Versión de cada prompt. Subirla invalida la caché A PROPÓSITO — que es lo que
 * se quiere— pero invalidar 200 fichas de golpe cuesta dinero, así que exige
 * `--reprocess` explícito y muestra el coste estimado antes de empezar.
 */
export const PROMPT_VERSION = {
  screen: 'screen-v1',
  write: 'write-v1',
} as const

export type Task = keyof typeof PROMPT_VERSION

/** Huella de un precio: lo que de verdad cambia, no su representación. */
export function priceFingerprint(price: Price): string {
  switch (price.type) {
    case 'paid':
      return price.amountMax !== undefined
        ? `paid:${price.amount}-${price.amountMax}`
        : `paid:${price.amount}`
    default:
      return price.type
  }
}

interface HashableCandidate {
  readonly title: string
  readonly startDate?: string | undefined
  readonly endDate?: string | undefined
  readonly price: Price
  readonly venue: { readonly name: string; readonly lat: number; readonly lng: number }
  readonly schedule: readonly { readonly days: string; readonly hours: string }[]
  readonly description: string
}

/**
 * Hash sobre los campos YA EXTRAÍDOS Y NORMALIZADOS. Tres detalles que no son
 * cosméticos:
 *
 * - `norm()` colapsa espacios, quita acentos y pasa a minúsculas: un cambio de
 *   tipografía no cuesta dinero.
 * - La descripción entra RECORTADA a 600 caracteres normalizados. Un medio que
 *   añade un párrafo promocional al final no dispara una reescritura.
 * - Las coordenadas van a 4 decimales (~11 m): más precisión sería ruido de
 *   geocodificación disfrazado de cambio real.
 */
export function semanticHash(c: HashableCandidate): string {
  const material = [
    norm(c.title),
    c.startDate?.slice(0, 10) ?? '',
    c.endDate?.slice(0, 10) ?? '',
    priceFingerprint(c.price),
    norm(c.venue.name),
    c.venue.lat.toFixed(4),
    c.venue.lng.toFixed(4),
    c.schedule
      .map((s) => norm(s.days) + '@' + norm(s.hours))
      .sort()
      .join(';'),
    norm(c.description).slice(0, 600),
  ].join('')
  return sha256(material)
}

export function candidateHash(c: Candidate): string {
  return semanticHash(c)
}

export function clusterHash(c: Cluster): string {
  return semanticHash(c)
}

/**
 * Lo que de verdad decide si hay que volver a pagar. Incluye PROMPT_VERSION y
 * MODEL: cambiar cualquiera de los dos invalida, y debe hacerlo.
 */
export function cacheKey(
  c: HashableCandidate,
  task: Task,
  model: string,
): string {
  return sha256([task, PROMPT_VERSION[task], model, semanticHash(c)].join('|'))
}

/** La misma clave, cuando ya se tiene el semanticHash calculado. */
export function cacheKeyFromHash(hash: string, task: Task, model: string): string {
  return sha256([task, PROMPT_VERSION[task], model, hash].join('|'))
}

/**
 * Hash de bytes. SÍ se usa, pero para otra cosa y antes: como ETag propio para
 * saltarse el parseo de una página cuyo servidor no manda ETag. Ahorra CPU, no
 * dinero. Son dos capas distintas y conviene no confundirlas.
 */
export function bytesHash(body: string): string {
  return sha256(body)
}

/**
 * Hash de los campos volátiles de un museo: horarios, precios, gratuidades y
 * exposición vigente. Si no cambia, no se llama a ningún modelo — coste 0 €
 * (§6.6). Es la razón de que la colección C cueste 0,12 €/mes en régimen.
 */
export function changeHash(volatile: {
  readonly openingHours: readonly { days: string; hours: string }[]
  readonly price: Price
  readonly freeAdmission: readonly string[]
  readonly currentExhibition?: { title: string; endsOn: string } | undefined
}): string {
  return sha256(
    JSON.stringify({
      h: volatile.openingHours.map((s) => `${norm(s.days)}@${norm(s.hours)}`).sort(),
      p: priceFingerprint(volatile.price),
      f: volatile.freeAdmission.map(norm).sort(),
      e: volatile.currentExhibition
        ? `${norm(volatile.currentExhibition.title)}|${volatile.currentExhibition.endsOn}`
        : '',
    }),
  )
}

/**
 * Qué cambió entre dos hashes de museo. Distingue el caso barato (solo horarios
 * o precios → se actualizan los campos estructurados, sin modelo) del caro (la
 * exposición temporal cambió → el texto sí la menciona, hay que reescribir).
 */
export type MuseumChangeKind = 'none' | 'structured-only' | 'needs-rewrite'
