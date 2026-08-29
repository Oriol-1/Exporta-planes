// REGRESIÓN: el catálogo de museos tiene que llegar al rastreo.
//
// `toCandidate` aceptaba un `seed` pero `crawl.ts` nunca se lo pasaba, así que
// `config/museums.ts` estaba desconectado del pipeline. Consecuencias reales:
// un museo perdía su slug estable —la identidad de por vida del §4.9— y sus
// coordenadas verificadas a mano, y habría que geocodificarlo a ciegas desde su
// dirección en cada refresco.
import { describe, expect, it } from 'vitest'
import { museumSeedFor } from '../../src/pipeline/crawl'
import { MUSEUMS } from '../../config/museums'
import { toCandidate } from '../../src/normalize/toCandidate'
import { SOURCES } from '../../config/sources'

const venueOfficial = SOURCES.find((s) => s.id === 'venue-official')!
const NOW = new Date('2026-09-03T02:30:00Z')

describe('museumSeedFor', () => {
  it('encuentra el museo por su web oficial', () => {
    expect(museumSeedFor('https://www.museupicasso.bcn.cat/')?.slug).toBe('museu-picasso')
    expect(museumSeedFor('https://www.macba.cat/')?.slug).toBe('macba')
  })

  it('encuentra el museo también por su página de horarios', () => {
    // `discover` usa `hoursUrl ?? officialUrl`: las dos tienen que resolver.
    expect(museumSeedFor('https://www.museupicasso.bcn.cat/es/horarios-y-precios')?.slug).toBe(
      'museu-picasso',
    )
  })

  it('da igual la barra final y las mayúsculas del host', () => {
    expect(museumSeedFor('https://www.macba.cat')?.slug).toBe('macba')
    expect(museumSeedFor('https://WWW.MACBA.CAT/')?.slug).toBe('macba')
  })

  it('no inventa museos que no están en el catálogo', () => {
    expect(museumSeedFor('https://ejemplo.test/museo-inventado')).toBeUndefined()
  })

  it('un museo deshabilitado NO se rastrea', () => {
    const disabled = MUSEUMS.find((m) => m.enabled === false)!
    expect(museumSeedFor(disabled.officialUrl)).toBeUndefined()
  })

  it('todos los museos activos del catálogo son alcanzables', () => {
    for (const m of MUSEUMS.filter((m) => m.enabled !== false)) {
      const found = museumSeedFor(m.hoursUrl ?? m.officialUrl)
      expect(found?.slug, `${m.slug} no se encuentra por su URL`).toBe(m.slug)
    }
  })
})

describe('el catálogo manda sobre lo extraído', () => {
  const seed = museumSeedFor('https://www.museupicasso.bcn.cat/')!

  it('conserva el slug del catálogo, no uno derivado del título de la web', () => {
    const result = toCandidate({
      // La web publica un título de marketing distinto cada temporada…
      extract: { via: 'jsonld', title: 'Visita el Museu Picasso este otoño', bodyText: 'texto' },
      url: 'https://www.museupicasso.bcn.cat/',
      source: venueOfficial,
      collection: 'museums',
      retrievedAt: '2026-09-03T04:30:00.000+02:00',
      now: NOW,
      coords: { lat: seed.lat, lng: seed.lng },
      seed: {
        slug: seed.slug,
        name: seed.name,
        address: seed.address,
        neighborhood: seed.neighborhood,
        district: seed.district,
        municipality: seed.municipality,
        zipCode: seed.zipCode,
        officialUrl: seed.officialUrl,
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // …pero la identidad no se mueve: es lo que hace que los favoritos y los
    // enlaces compartidos sobrevivan al refresco semanal (§8.5).
    expect(result.candidate.seedSlug).toBe('museu-picasso')
    expect(result.candidate.title).toBe('Museu Picasso')
    expect(result.candidate.venue.lat).toBe(seed.lat)
    expect(result.candidate.venue.lng).toBe(seed.lng)
    expect(result.candidate.venue.locationPrecision).toBe('exact')
    expect(result.candidate.venue.district).toBe('Ciutat Vella')
  })

  it('SIN catálogo y sin coordenadas, el candidato se descarta', () => {
    // Nunca se inventa una posición (§4.7).
    const result = toCandidate({
      extract: { via: 'jsonld', title: 'Algo sin sitio', bodyText: 'texto' },
      url: 'https://ejemplo.test/x',
      source: venueOfficial,
      collection: 'museums',
      retrievedAt: '2026-09-03T04:30:00.000+02:00',
      now: NOW,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('sin-coordenadas')
  })
})
