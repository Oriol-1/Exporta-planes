// Por qué los museos casi no cuestan (§6.6).
//
// «La segunda ejecución del workflow cuesta 0,00 €» es el criterio MÁS
// IMPORTANTE de toda la Fase 1: si no se cumple, hay un error en la clave de
// caché y hay que pararse a arreglarlo antes de seguir, porque es el defecto que
// multiplica la factura. Esto lo comprueba.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyStructuredUpdate, diffMuseum, volatileOfCard, type VolatileFields } from '../../src/enrich/museumDiff'
import { CuratedEventSchema, type CuratedEvent } from '../../contracts/curated'
import { cardFile } from '../../src/store/paths'

const picasso: CuratedEvent = CuratedEventSchema.parse(
  JSON.parse(readFileSync(cardFile('museums', 'museu-picasso'), 'utf8')),
)

const FRESH: VolatileFields = {
  openingHours: [{ days: 'Martes a domingo', hours: '10:00-19:00' }],
  price: { type: 'paid', amount: 15, currency: 'EUR' },
  freeAdmission: ['Jueves de 16 a 19 h'],
  currentExhibition: { title: 'Picasso i el circ', endsOn: '2027-01-18' },
}

function publicado(volatile: VolatileFields): CuratedEvent {
  return CuratedEventSchema.parse({
    ...picasso,
    price: volatile.price,
    schedule: volatile.openingHours,
    curated: {
      ...picasso.curated,
      museum: {
        openingHours: volatile.openingHours,
        freeAdmission: volatile.freeAdmission,
        ...(volatile.currentExhibition
          ? {
              currentExhibition: {
                title: volatile.currentExhibition.title,
                endsOn: volatile.currentExhibition.endsOn,
              },
            }
          : {}),
      },
    },
  })
}

describe('diffMuseum', () => {
  it('sin cambios → NO se llama a ningún modelo. Coste: 0 €', () => {
    const diff = diffMuseum(publicado(FRESH), FRESH)
    expect(diff.kind).toBe('none')
    expect(diff.changed).toEqual([])
    expect(diff.previousHash).toBe(diff.currentHash)
  })

  it('una ficha nueva sí hay que escribirla', () => {
    expect(diffMuseum(null, FRESH).kind).toBe('needs-rewrite')
  })

  it('solo cambia el precio → se actualiza el campo, SIN modelo', () => {
    // El texto narrativo no hablaba del precio, así que reescribirlo sería tirar
    // el dinero.
    const diff = diffMuseum(publicado(FRESH), {
      ...FRESH,
      price: { type: 'paid', amount: 16, currency: 'EUR' },
    })
    expect(diff.kind).toBe('structured-only')
    expect(diff.changed).toContain('precio')
  })

  it('solo cambian los horarios → tampoco se llama al modelo', () => {
    const diff = diffMuseum(publicado(FRESH), {
      ...FRESH,
      openingHours: [{ days: 'Martes a domingo', hours: '10:00-20:00' }],
    })
    expect(diff.kind).toBe('structured-only')
    expect(diff.changed).toContain('horarios')
  })

  it('cambia la exposición temporal → AHÍ SÍ se reescribe', () => {
    // Porque el texto sí la menciona. Se estima en unas 4 fichas al mes.
    const diff = diffMuseum(publicado(FRESH), {
      ...FRESH,
      currentExhibition: { title: 'Otra exposicion', endsOn: '2027-05-01' },
    })
    expect(diff.kind).toBe('needs-rewrite')
    expect(diff.changed).toContain('exposición temporal')
  })
})

describe('applyStructuredUpdate', () => {
  it('actualiza los datos y conserva el texto tal cual', () => {
    const card = publicado(FRESH)
    const actualizada = applyStructuredUpdate(
      card,
      { ...FRESH, price: { type: 'paid', amount: 16, currency: 'EUR' } },
      '2026-09-07T04:30:00.000+02:00',
    )

    expect(actualizada.price).toEqual({ type: 'paid', amount: 16, currency: 'EUR' })
    expect(actualizada.curated.curatedAt).toBe('2026-09-07T04:30:00.000+02:00')
    // El texto NO se toca: es lo caro.
    expect(actualizada.description).toBe(card.description)
    expect(actualizada.i18n?.description?.en).toBe(card.i18n?.description?.en)
    // Y el slug y el id no cambian nunca, así que los favoritos y los enlaces
    // compartidos sobreviven al refresco (§8.5).
    expect(actualizada.id).toBe(card.id)
    expect(actualizada.curated.slug).toBe(card.curated.slug)
    expect(CuratedEventSchema.safeParse(actualizada).success).toBe(true)
  })
})

describe('volatileOfCard', () => {
  it('lee los campos volátiles de una ficha publicada', () => {
    const volatile = volatileOfCard(publicado(FRESH))
    expect(volatile.price).toEqual(FRESH.price)
    expect(volatile.currentExhibition?.title).toBe('Picasso i el circ')
  })
})
