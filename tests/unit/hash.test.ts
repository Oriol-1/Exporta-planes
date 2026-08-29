// LA CLAVE DE CACHÉ (§5.2). Es lo que decide si el proyecto cuesta tres euros o
// treinta, y el defecto nº 1 de la v1.0 del plan fue precisamente indexarla por
// el hash del HTML. Estos tests fijan el comportamiento correcto para que ese
// error no pueda volver sin que algo se ponga en rojo.
import { describe, expect, it } from 'vitest'
import { bytesHash, cacheKey, changeHash, priceFingerprint, semanticHash } from '../../src/core/hash'
import type { Price } from '../../contracts/event'

const BASE = {
  title: 'Museu Picasso',
  startDate: '2026-08-31T00:00:00+02:00',
  endDate: '2027-08-31T00:00:00+02:00',
  price: { type: 'paid', amount: 15, currency: 'EUR' } as Price,
  venue: { name: 'Museu Picasso', lat: 41.385228, lng: 2.180968 },
  schedule: [{ days: 'Martes a domingo', hours: '10:00-19:00' }],
  description: 'Cinco palacios goticos en la calle Montcada.',
}

describe('semanticHash · sobre el significado, nunca sobre los bytes', () => {
  it('es estable ante un cambio de espacios, acentos o mayúsculas', () => {
    // Un cambio de tipografía o un espacio de más no puede costar dinero.
    const variante = {
      ...BASE,
      title: '  MUSEU  PICASSÓ ',
      venue: { ...BASE.venue, name: 'Museu Picassó' },
      description: 'Cinco palacios góticos   en la calle Montcada.',
    }
    expect(semanticHash(variante)).toBe(semanticHash(BASE))
  })

  it('ignora un párrafo promocional añadido tras los primeros 600 caracteres', () => {
    // La descripción entra recortada a 600 caracteres normalizados: un medio que
    // añade un cierre publicitario al final no dispara una reescritura.
    const cuerpo = 'texto real de la ficha. '.repeat(30) // > 600 caracteres
    const conCola = { ...BASE, description: cuerpo + ' Patrocinado por una marca.' }
    const conOtraCola = { ...BASE, description: cuerpo + ' Ahora con un sorteo distinto.' }
    expect(conCola.description.length).toBeGreaterThan(600)
    expect(semanticHash(conCola)).toBe(semanticHash(conOtraCola))
  })

  it('ignora ruido de geocodificación por debajo de ~11 m', () => {
    const movido = { ...BASE, venue: { ...BASE.venue, lat: 41.38522801, lng: 2.18096799 } }
    expect(semanticHash(movido)).toBe(semanticHash(BASE))
  })

  it('el orden de los tramos de horario no cuenta', () => {
    const reordenado = {
      ...BASE,
      schedule: [
        { days: 'Jueves', hours: '10:00-21:30' },
        { days: 'Martes a domingo', hours: '10:00-19:00' },
      ],
    }
    const original = {
      ...BASE,
      schedule: [
        { days: 'Martes a domingo', hours: '10:00-19:00' },
        { days: 'Jueves', hours: '10:00-21:30' },
      ],
    }
    expect(semanticHash(reordenado)).toBe(semanticHash(original))
  })

  it('SÍ cambia cuando cambia el precio', () => {
    const subida = { ...BASE, price: { type: 'paid', amount: 16, currency: 'EUR' } as Price }
    expect(semanticHash(subida)).not.toBe(semanticHash(BASE))
  })

  it('SÍ cambia cuando cambia el horario', () => {
    const nuevo = { ...BASE, schedule: [{ days: 'Martes a domingo', hours: '10:00-20:00' }] }
    expect(semanticHash(nuevo)).not.toBe(semanticHash(BASE))
  })

  it('SÍ cambia cuando cambia la fecha', () => {
    const nuevo = { ...BASE, startDate: '2026-09-07T00:00:00+02:00' }
    expect(semanticHash(nuevo)).not.toBe(semanticHash(BASE))
  })
})

describe('bytesHash · otra capa, y no hay que confundirla', () => {
  it('cambia con cualquier byte, por eso NO sirve como clave de caché de pago', () => {
    const html = '<html><body>Museu Picasso</body></html>'
    const conContador = '<html><body>Museu Picasso<!-- 412 comentarios --></body></html>'
    expect(bytesHash(html)).not.toBe(bytesHash(conContador))
    // El semanticHash de los mismos datos, en cambio, no se habría movido.
  })
})

describe('cacheKey', () => {
  it('cambia al cambiar de modelo', () => {
    expect(cacheKey(BASE, 'write', 'claude-opus-5')).not.toBe(
      cacheKey(BASE, 'write', 'claude-sonnet-5'),
    )
  })

  it('cambia al cambiar de tarea', () => {
    expect(cacheKey(BASE, 'screen', 'gpt-5-mini')).not.toBe(cacheKey(BASE, 'write', 'gpt-5-mini'))
  })

  it('es determinista', () => {
    expect(cacheKey(BASE, 'write', 'claude-opus-5')).toBe(cacheKey(BASE, 'write', 'claude-opus-5'))
  })
})

describe('priceFingerprint', () => {
  it('resume lo que de verdad cambia de un precio', () => {
    expect(priceFingerprint({ type: 'free' })).toBe('free')
    expect(priceFingerprint({ type: 'unknown' })).toBe('unknown')
    expect(priceFingerprint({ type: 'paid', amount: 15, currency: 'EUR' })).toBe('paid:15')
    expect(
      priceFingerprint({ type: 'paid', amount: 20, amountMax: 32, currency: 'EUR' }),
    ).toBe('paid:20-32')
  })
})

describe('changeHash · el que hace que los museos casi no cuesten (§6.6)', () => {
  const volatil = {
    openingHours: [{ days: 'Martes a domingo', hours: '10:00-19:00' }],
    price: { type: 'paid', amount: 15, currency: 'EUR' } as Price,
    freeAdmission: ['Jueves de 16 a 19 h'],
    currentExhibition: { title: 'Picasso i el circ', endsOn: '2027-01-18' },
  }

  it('no cambia si no cambió nada relevante: coste 0 €', () => {
    expect(changeHash({ ...volatil })).toBe(changeHash(volatil))
  })

  it('cambia al subir el precio', () => {
    expect(
      changeHash({ ...volatil, price: { type: 'paid', amount: 16, currency: 'EUR' } }),
    ).not.toBe(changeHash(volatil))
  })

  it('cambia al cambiar la exposición temporal', () => {
    expect(
      changeHash({
        ...volatil,
        currentExhibition: { title: 'Otra exposicion', endsOn: '2027-03-01' },
      }),
    ).not.toBe(changeHash(volatil))
  })
})
