// src/normalize/price.ts
// Un tipo discriminado, no un número (§1.7). Es una de las cosas mejor pensadas
// de planonmap y hay que respetarla al pie de la letra:
//
//   NUNCA se marca «gratis» sin confirmación explícita de la fuente.
//
// Mentir sobre el precio es el peor error posible de esta guía: un turista actúa
// sobre ese dato. Si nada casa, `unknown`, y la interfaz de planonmap ya sabe no
// decir nada.
import type { Price } from '../../contracts/event'
import { norm } from '../core/text'

const FREE = /\b(gratu[ai]t\w*|gratis|entrada lliure|entrada libre|free entry|free admission|acces lliure)\b/
const FREE_WITH_BOOKING = /\b(gratu[ai]t\w*|gratis|free)\b[^.]{0,40}\b(amb reserva|con reserva|reserva previa|previa reserva|inscripcio|inscripcion|booking required)\b/
const INVITATION = /\b(amb invitacio|con invitacion|invitation only|nomes convidats|solo invitados)\b/
const INCLUDED = /\b(inclos amb l entrada|incluido con la entrada|inclos en l entrada|included with admission|amb l entrada del museu)\b/
const SURCHARGE = /\b(despeses de gestio|gastos de gestion|booking fee|mes despeses|\+ despeses|\+ gastos)\b/
const PAID_HINT = /\b(preu|precio|price|entrada|entrades|entradas|tarifa|ticket|venda|venta)\b/

/** «de 12 a 25 €», «12-25 €», «entre 12 y 25 euros». */
const RANGE =
  /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|euros?)?\s*(?:a|-|–|—|fins a|hasta|to|y|i)\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|euros?)/
/** «15 €», «15,50 euros», «€15». */
const SINGLE = /(?:€\s*(\d{1,4}(?:[.,]\d{1,2})?))|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)/

function toNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n < 10_000 ? n : undefined
}

/**
 * Traduce un texto de precio al tipo discriminado. El orden de las reglas
 * importa: «gratis con reserva» tiene que ganar a «gratis» a secas, y
 * «incluido con la entrada» no es ni gratis ni de pago.
 */
export function parsePrice(rawText: string | undefined | null): Price {
  if (!rawText) return { type: 'unknown' }
  const t = norm(rawText)
  if (t.length === 0) return { type: 'unknown' }

  if (INCLUDED.test(t)) return { type: 'included-with-admission' }
  if (INVITATION.test(t)) return { type: 'invitation' }
  if (FREE_WITH_BOOKING.test(t)) return { type: 'free-with-booking' }

  const hasSurcharge = SURCHARGE.test(t)

  const range = RANGE.exec(t)
  if (range) {
    const min = toNumber(range[1])
    const max = toNumber(range[2])
    if (min !== undefined && max !== undefined && max >= min) {
      return {
        type: 'paid',
        amount: min,
        amountMax: max,
        currency: 'EUR',
        ...(hasSurcharge ? { hasSurcharge: true } : {}),
      }
    }
  }

  const single = SINGLE.exec(t)
  if (single) {
    const amount = toNumber(single[1] ?? single[2])
    if (amount !== undefined) {
      // «0 €» es gratis solo si el texto lo dice; un 0 suelto es sospechoso.
      if (amount === 0) return FREE.test(t) ? { type: 'free' } : { type: 'unknown' }
      return {
        type: 'paid',
        amount,
        currency: 'EUR',
        ...(hasSurcharge ? { hasSurcharge: true } : {}),
      }
    }
  }

  // «Gratis» a secas, y solo si NO hay además un importe: «entrada gratuita para
  // menores; general 15 €» ya se resolvió arriba como `paid`.
  if (FREE.test(t)) return { type: 'free' }

  // Se paga, pero el importe no es parseable. Es distinto de no saber nada.
  if (PAID_HINT.test(t)) return { type: 'paid-unknown' }

  return { type: 'unknown' }
}

/** El precio más informativo de varios textos. Nunca degrada a `unknown`. */
export function bestPrice(texts: readonly (string | undefined)[]): Price {
  const parsed = texts.map(parsePrice)
  const rank: Record<Price['type'], number> = {
    paid: 6,
    free: 5,
    'free-with-booking': 5,
    'included-with-admission': 4,
    invitation: 4,
    'paid-unknown': 2,
    unknown: 0,
  }
  let best: Price = { type: 'unknown' }
  for (const p of parsed) {
    if (rank[p.type] > rank[best.type]) best = p
  }
  return best
}

/** Importe representativo para las cuotas de variedad (§5.6). */
export function priceAmount(price: Price): number | null {
  switch (price.type) {
    case 'free':
    case 'free-with-booking':
      return 0
    case 'paid':
      return price.amount
    default:
      return null
  }
}

export function isCheap(price: Price, thresholdEur: number): boolean {
  const amount = priceAmount(price)
  return amount !== null && amount < thresholdEur
}

/** Insignia legible para el cuerpo del PR. */
export function priceLabel(price: Price): string {
  switch (price.type) {
    case 'free':
      return 'gratis'
    case 'free-with-booking':
      return 'gratis con reserva'
    case 'included-with-admission':
      return 'incluido con la entrada'
    case 'invitation':
      return 'con invitación'
    case 'paid':
      return price.amountMax !== undefined
        ? `${price.amount}–${price.amountMax} €`
        : `${price.amount} €`
    case 'paid-unknown':
      return 'de pago'
    case 'unknown':
      return 'precio sin confirmar'
  }
}
