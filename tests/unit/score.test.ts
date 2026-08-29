// Los 100 puntos: 45 deterministas y 55 del modelo (§5.1).
//
// El defecto nº 19 de la v1.0 fue que el consenso se definía a la vez como
// «suma de trust» y como «tabla por número de fuentes». Son cosas distintas y el
// código tiene que elegir una: base por número × media de trust. Estos tests
// fijan los dos ejemplos trabajados del plan.
import { describe, expect, it } from 'vitest'
import { SCORING } from '../../config/scoring'
import {
  deterministicScore,
  hardVeto,
  llmPoints,
  passesThreshold,
  puntuarCompletitud,
  puntuarConsenso,
  scoreCluster,
} from '../../src/screen/score'
import { makeCluster, makeVerdict, sourceRef, NOW } from '../fixtures/clusters'

describe('puntuarConsenso', () => {
  it('dos fuentes de nivel A dan 18 (18 × 0,975)', () => {
    // El ejemplo literal del §5.1.
    expect(
      puntuarConsenso([sourceRef('timeout-bcn', 'A', 1), sourceRef('barcelona-secreta', 'A', 0.95)], SCORING),
    ).toBe(18)
  })

  it('dos fuentes de nivel B dan 14 (18 × 0,80)', () => {
    // La diferencia que se busca: el aval de dos medios con criterio propio pesa
    // más que el de dos agendas institucionales.
    expect(
      puntuarConsenso([sourceRef('visit-barcelona', 'B', 0.8), sourceRef('bcn-cultura', 'B', 0.8)], SCORING),
    ).toBe(14)
  })

  it('las fuentes de nivel C NO cuentan para el consenso', () => {
    // Un museo siempre habla bien de sí mismo.
    expect(puntuarConsenso([sourceRef('venue-official', 'C', 0)], SCORING)).toBe(0)
    expect(
      puntuarConsenso([sourceRef('timeout-bcn', 'A', 1), sourceRef('venue-official', 'C', 0)], SCORING),
    ).toBe(10)
  })

  it('cuatro o más fuentes topan en 25', () => {
    const cuatro = [
      sourceRef('a', 'A', 1),
      sourceRef('b', 'A', 1),
      sourceRef('c', 'A', 1),
      sourceRef('d', 'A', 1),
    ]
    expect(puntuarConsenso(cuatro, SCORING)).toBe(25)
    expect(puntuarConsenso([...cuatro, sourceRef('e', 'A', 1)], SCORING)).toBe(25)
  })
})

describe('puntuarCompletitud', () => {
  it('da 2 puntos por campo y topa en 10', () => {
    const completo = makeCluster()
    // precio + horario + dirección exacta + web oficial = 8; sin imagen.
    expect(puntuarCompletitud(completo, SCORING)).toBe(8)
  })

  it('un precio desconocido resta completitud', () => {
    const sinPrecio = makeCluster({ price: { type: 'unknown' } })
    expect(puntuarCompletitud(sinPrecio, SCORING)).toBe(6)
  })
})

describe('llmPoints y vetos duros', () => {
  it('suma las cuatro señales, con techo 55', () => {
    expect(
      llmPoints(
        makeVerdict({
          vale_el_viaje: 15,
          caracteristico_bcn: 15,
          sin_barrera_idioma: 10,
          no_trampa_turistica: 15,
        }),
      ),
    ).toBe(55)
  })

  it('un veto duro se detecta sea cual sea la puntuación', () => {
    const excelente = makeVerdict({
      vale_el_viaje: 15,
      caracteristico_bcn: 15,
      sin_barrera_idioma: 10,
      no_trampa_turistica: 15,
      requiere_ser_local: true,
    })
    expect(llmPoints(excelente)).toBe(55)
    expect(hardVeto(excelente)).toBe('requiere_ser_local')
  })
})

describe('umbral de 62', () => {
  it('deja pasar el caso que el plan usó para elegirlo', () => {
    // Dos fuentes (18) + ficha completa (10) + vigente (5) + fuente sólida (4)
    // + juicio editorial decente (25 de 55) = 62.
    const cluster = makeCluster({
      sources: [sourceRef('timeout-bcn', 'A', 1), sourceRef('barcelona-secreta', 'A', 0.95)],
      startDate: '2026-09-10T19:30:00.000+02:00',
      image: 'https://upload.wikimedia.org/ejemplo.jpg',
    })
    const scored = scoreCluster(
      cluster,
      NOW,
      SCORING,
      makeVerdict({
        vale_el_viaje: 8,
        caracteristico_bcn: 7,
        sin_barrera_idioma: 5,
        no_trampa_turistica: 5,
      }),
    )
    // 18 de consenso + 10 de completitud + 5 de vigencia + 5 de reputación = 38,
    // más 25 de juicio editorial. La aritmética exacta del plan (que apuntaba 62)
    // depende de la media de trust; lo que fija este test es que este perfil
    // —dos medios de nivel A, ficha completa, vigente y juicio decente— pasa.
    expect(scored.deterministic.consensus).toBe(18)
    expect(scored.deterministic.completeness).toBe(10)
    expect(scored.llmPoints).toBe(25)
    expect(scored.total).toBeGreaterThanOrEqual(SCORING.threshold)
    expect(passesThreshold(scored, SCORING)).toBe(true)
  })

  it('detiene a una sola fuente con juicio mediocre', () => {
    const cluster = makeCluster({ sources: [sourceRef('lecool-bcn', 'A', 0.9)] })
    const scored = scoreCluster(
      cluster,
      NOW,
      SCORING,
      makeVerdict({
        vale_el_viaje: 5,
        caracteristico_bcn: 5,
        sin_barrera_idioma: 5,
        no_trampa_turistica: 5,
      }),
    )
    expect(passesThreshold(scored, SCORING)).toBe(false)
  })

  it('un veto duro descarta aunque la nota sea altísima', () => {
    const cluster = makeCluster({
      sources: [sourceRef('timeout-bcn', 'A', 1), sourceRef('barcelona-secreta', 'A', 0.95)],
    })
    const scored = scoreCluster(
      cluster,
      NOW,
      SCORING,
      makeVerdict({
        vale_el_viaje: 15,
        caracteristico_bcn: 15,
        sin_barrera_idioma: 10,
        no_trampa_turistica: 15,
        es_trampa_turistica: true,
      }),
    )
    expect(scored.total).toBeGreaterThan(SCORING.threshold)
    expect(passesThreshold(scored, SCORING)).toBe(false)
  })
})

describe('LA EXCEPCIÓN DE LOS MUSEOS (§5.1)', () => {
  it('un museo pasa aunque su única fuente sea de nivel C y puntúe 0 en consenso', () => {
    // Los museos entran porque están en config/museums.ts. Aplicarles el corte
    // de 62 los dejaría fuera a casi todos, y el Museu Picasso no necesita que
    // dos medios lo avalen para merecer una ficha.
    const museo = makeCluster({
      collection: 'museums',
      category: 'museums',
      sources: [sourceRef('venue-official', 'C', 0)],
      seedSlug: 'museu-picasso',
    })
    const scored = scoreCluster(museo, NOW, SCORING, undefined)
    expect(scored.deterministic.consensus).toBe(0)
    expect(scored.total).toBeLessThan(SCORING.threshold)
    expect(passesThreshold(scored, SCORING)).toBe(true)
  })

  it('un museo puntúa 5 de vigencia siempre', () => {
    const museo = makeCluster({ collection: 'museums', startDate: undefined })
    expect(deterministicScore(museo, NOW, SCORING).freshness).toBe(5)
  })
})
