// El algoritmo de deduplicación de planonmap, reproducido CARÁCTER POR CARÁCTER
// (§1.9). Si esto diverge, dejamos de poder decir «este plan ya está en el feed».
import { describe, expect, it } from 'vitest'
import { normalizeTitleForDedupe, titleSimilarity } from '../../src/core/text'
import { dedupeKey, matchesByProximity, mergeHint } from '../../src/cluster/planonmapKey'

describe('normalizeTitleForDedupe', () => {
  it('quita tildes, signos, espacios y emojis, y recorta a 40', () => {
    expect(normalizeTitleForDedupe('Concert "Sina Bathaie"')).toBe('concertsinabathaie')
    expect(normalizeTitleForDedupe('Sagrada Família 🏛 amb accés')).toBe('sagradafamiliaambacces')
    expect(normalizeTitleForDedupe('x'.repeat(100)).length).toBe(40)
  })
})

describe('dedupeKey', () => {
  it('reproduce el ejemplo real del plan', () => {
    expect(
      dedupeKey({
        title: 'Concert "Sina Bathaie"',
        startDate: '2026-09-10T19:30:00+02:00',
        venue: { lat: 41.39462416093732, lng: 2.1490629497204705 },
      }),
    ).toBe('concertsinabathaie|2026-09-10|41.39|2.15')
  })

  it('redondea las coordenadas a 2 decimales, ~1,1 km', () => {
    const a = dedupeKey({
      title: 'Museu Picasso',
      startDate: '2026-08-31T00:00:00+02:00',
      venue: { lat: 41.385228, lng: 2.180968 },
    })
    const b = dedupeKey({
      title: 'Museu Picasso',
      startDate: '2026-08-31T00:00:00+02:00',
      venue: { lat: 41.3859, lng: 2.1801 },
    })
    expect(a).toBe(b)
  })

  it('para lo ATEMPORAL es inestable por construcción (§4.9)', () => {
    // El startDate de un museo rueda cada semana, así que su dedupeKey cambia.
    // Por eso la identidad SIEMPRE es el slug, y lo atemporal se empareja por
    // proximidad. Este test fija esa propiedad para que nadie la olvide.
    const venue = { lat: 41.385228, lng: 2.180968 }
    const semana1 = dedupeKey({
      title: 'Museu Picasso',
      startDate: '2026-08-31T00:00:00+02:00',
      venue,
    })
    const semana2 = dedupeKey({
      title: 'Museu Picasso',
      startDate: '2026-09-07T00:00:00+02:00',
      venue,
    })
    expect(semana1).not.toBe(semana2)
  })
})

describe('emparejamiento por proximidad, la vía correcta para lo atemporal', () => {
  it('empareja el mismo museo escrito con y sin acentos, a menos de 150 m', () => {
    expect(
      matchesByProximity(
        { title: 'Fundació Joan Miró', venue: { lat: 41.368611, lng: 2.16 } },
        { title: 'Fundacio Joan Miro', venue: { lat: 41.3687, lng: 2.1601 } },
      ),
    ).toBe(true)
  })

  it('NO empareja «Museu Picasso» con «Museu Picasso de Barcelona»', () => {
    // 0,82 por trigramas es estricto a propósito: un falso emparejamiento
    // fusionaría dos fichas distintas, que es peor que dejar una sin emparejar.
    expect(
      matchesByProximity(
        { title: 'Museu Picasso de Barcelona', venue: { lat: 41.385228, lng: 2.180968 } },
        { title: 'Museu Picasso', venue: { lat: 41.3853, lng: 2.181 } },
      ),
    ).toBe(false)
  })

  it('no empareja dos sitios distintos aunque el título sea idéntico', () => {
    expect(
      matchesByProximity(
        { title: 'Museu Picasso', venue: { lat: 41.385228, lng: 2.180968 } },
        { title: 'Museu Picasso', venue: { lat: 41.4036, lng: 2.1744 } },
      ),
    ).toBe(false)
  })

  it('no empareja dos cosas distintas en el mismo edificio', () => {
    expect(
      matchesByProximity(
        { title: 'Exposicion de Picasso', venue: { lat: 41.385228, lng: 2.180968 } },
        { title: 'Taller infantil de ceramica', venue: { lat: 41.38523, lng: 2.18097 } },
      ),
    ).toBe(false)
  })
})

describe('similitud de títulos', () => {
  it('el umbral de 0,82 separa variantes de cosas distintas', () => {
    expect(titleSimilarity('El rei Lear', 'El Rei Lear')).toBeGreaterThanOrEqual(0.82)
    expect(titleSimilarity('El rei Lear', 'Hamlet')).toBeLessThan(0.82)
  })
})

describe('mergeHint', () => {
  it('sugiere fusión cuando un recinto institucional publica en la agenda abierta', () => {
    expect(mergeHint('temporada', [{ id: 'teatre-barcelona' }, { id: 'timeout-bcn' }])).toBe(
      'merge',
    )
  })

  it('lo atemporal se propone como nuevo', () => {
    expect(mergeHint('atemporal', [{ id: 'bcn-cultura' }])).toBe('new')
  })
})
