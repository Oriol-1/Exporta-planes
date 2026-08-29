// El precio es un tipo discriminado, no un número (§1.7). Equivocarlo invalida
// la ficha, y mentir sobre él es el peor error posible de esta guía: un turista
// actúa sobre ese dato.
import { describe, expect, it } from 'vitest'
import { bestPrice, isCheap, parsePrice, priceAmount, priceLabel } from '../../src/normalize/price'

describe('parsePrice', () => {
  it('NUNCA marca gratis sin confirmación explícita', () => {
    // La regla más importante del apartado: sin prueba, `unknown`, y la interfaz
    // de planonmap ya sabe no decir "Gratis".
    expect(parsePrice(undefined)).toEqual({ type: 'unknown' })
    expect(parsePrice('')).toEqual({ type: 'unknown' })
    expect(parsePrice('consultar en taquilla')).toEqual({ type: 'unknown' })
    expect(parsePrice('sin especificar')).toEqual({ type: 'unknown' })
  })

  it('reconoce gratuito en catalán, castellano e inglés', () => {
    expect(parsePrice('Entrada gratuïta')).toEqual({ type: 'free' })
    expect(parsePrice('Actividad gratuita')).toEqual({ type: 'free' })
    expect(parsePrice('entrada lliure')).toEqual({ type: 'free' })
    expect(parsePrice('Free admission')).toEqual({ type: 'free' })
  })

  it('distingue gratis de gratis-con-reserva', () => {
    expect(parsePrice('Gratuït amb reserva prèvia')).toEqual({ type: 'free-with-booking' })
    expect(parsePrice('Gratis con reserva')).toEqual({ type: 'free-with-booking' })
  })

  it('reconoce invitación e incluido con la entrada', () => {
    expect(parsePrice('Amb invitació')).toEqual({ type: 'invitation' })
    expect(parsePrice('Inclòs amb l entrada del museu')).toEqual({
      type: 'included-with-admission',
    })
  })

  it('parsea un importe simple', () => {
    expect(parsePrice('15 €')).toEqual({ type: 'paid', amount: 15, currency: 'EUR' })
    expect(parsePrice('Entrada general 12,50 euros')).toEqual({
      type: 'paid',
      amount: 12.5,
      currency: 'EUR',
    })
    expect(parsePrice('€18')).toEqual({ type: 'paid', amount: 18, currency: 'EUR' })
  })

  it('parsea un rango a amount + amountMax', () => {
    expect(parsePrice('de 29,99 a 49,99 €')).toEqual({
      type: 'paid',
      amount: 29.99,
      amountMax: 49.99,
      currency: 'EUR',
    })
    expect(parsePrice('Entrades de 20 a 32 €')).toEqual({
      type: 'paid',
      amount: 20,
      amountMax: 32,
      currency: 'EUR',
    })
  })

  it('detecta el suplemento: el importe anunciado no es el total', () => {
    expect(parsePrice('de 29,99 a 49,99 € (+ despeses de gestió)')).toEqual({
      type: 'paid',
      amount: 29.99,
      amountMax: 49.99,
      currency: 'EUR',
      hasSurcharge: true,
    })
  })

  it('se paga pero no se puede leer el importe', () => {
    expect(parsePrice('Consulta el precio de las entradas en la web')).toEqual({
      type: 'paid-unknown',
    })
  })

  it('un 0 suelto no es gratis salvo que el texto lo diga', () => {
    expect(parsePrice('0 €')).toEqual({ type: 'unknown' })
    expect(parsePrice('0 € · entrada gratuita')).toEqual({ type: 'free' })
  })
})

describe('bestPrice', () => {
  it('se queda con el más informativo y nunca degrada a unknown', () => {
    expect(bestPrice([undefined, 'consultar', '15 €'])).toEqual({
      type: 'paid',
      amount: 15,
      currency: 'EUR',
    })
    expect(bestPrice(['consultar precios de las entradas', undefined])).toEqual({
      type: 'paid-unknown',
    })
    expect(bestPrice([undefined, undefined])).toEqual({ type: 'unknown' })
  })
})

describe('ayudantes de cuota', () => {
  it('priceAmount solo devuelve número cuando lo hay de verdad', () => {
    expect(priceAmount({ type: 'free' })).toBe(0)
    expect(priceAmount({ type: 'paid', amount: 15, currency: 'EUR' })).toBe(15)
    expect(priceAmount({ type: 'unknown' })).toBeNull()
    expect(priceAmount({ type: 'paid-unknown' })).toBeNull()
  })

  it('un precio desconocido NO cuenta como barato', () => {
    // Si contara, la cuota `minGratuitos` se rellenaría con fichas cuyo precio
    // nadie ha confirmado, que es exactamente lo que no se quiere (§5.6).
    expect(isCheap({ type: 'unknown' }, 10)).toBe(false)
    expect(isCheap({ type: 'free' }, 10)).toBe(true)
    expect(isCheap({ type: 'paid', amount: 8, currency: 'EUR' }, 10)).toBe(true)
    expect(isCheap({ type: 'paid', amount: 15, currency: 'EUR' }, 10)).toBe(false)
  })

  it('la insignia nunca dice Gratis cuando no se sabe', () => {
    expect(priceLabel({ type: 'unknown' })).toBe('precio sin confirmar')
  })
})
