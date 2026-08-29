// El prefiltro determinista, antes de gastar un céntimo (§5.2). Es la pieza que
// hace que la factura sea de céntimos: de ~250 URL al día llegan al modelo ~20.
import { describe, expect, it } from 'vitest'
import { SCORING } from '../../config/scoring'
import { prefilter, freshnessPoints, type PrefilterContext } from '../../src/screen/prefilter'
import { makeCluster, NOW } from '../fixtures/clusters'

function ctx(overrides: Partial<PrefilterContext> = {}): PrefilterContext {
  return {
    now: NOW,
    scoring: SCORING,
    knownHashes: new Set(),
    vetoedSlugs: new Set(),
    wellCoveredKeys: new Set(),
    deterministicScore: 30,
    ...overrides,
  }
}

describe('prefiltro · el orden importa y corta en cuanto uno acierta', () => {
  it('deja pasar un candidato normal', () => {
    expect(prefilter(makeCluster(), ctx())).toEqual({ pass: true })
  })

  it('1 · sin cambios de significado → fuera (el paso que ahorra el 84 %)', () => {
    const cluster = makeCluster()
    const outcome = prefilter(cluster, ctx({ knownHashes: new Set([cluster.semanticHash]) }))
    expect(outcome).toEqual({ pass: false, reason: 'sin-cambios' })
  })

  it('2 · el veto gana a todo lo demás', () => {
    const cluster = makeCluster({ clusterId: 'plan-vetado' })
    expect(prefilter(cluster, ctx({ vetoedSlugs: new Set(['plan-vetado']) }))).toEqual({
      pass: false,
      reason: 'vetado',
    })
  })

  it('3 · sin fecha y no es museo → fuera', () => {
    expect(prefilter(makeCluster({ startDate: undefined }), ctx())).toEqual({
      pass: false,
      reason: 'sin-fecha',
    })
  })

  it('3 bis · un museo SIN fecha sí pasa: su ventana es un convenio (§8.5)', () => {
    const museo = makeCluster({
      collection: 'museums',
      category: 'museums',
      startDate: undefined,
      seedSlug: 'museu-picasso',
    })
    expect(prefilter(museo, ctx())).toEqual({ pass: true })
  })

  it('4 · fuera de la ventana de ayer a +60 días → fuera', () => {
    const lejano = makeCluster({ startDate: '2027-06-01T19:00:00.000+02:00' })
    expect(prefilter(lejano, ctx())).toEqual({ pass: false, reason: 'fuera-de-ventana' })

    const pasado = makeCluster({ startDate: '2026-01-01T19:00:00.000+01:00' })
    expect(prefilter(pasado, ctx())).toEqual({ pass: false, reason: 'fuera-de-ventana' })
  })

  it('4 bis · una exposición larga que ya empezó SIGUE dentro', () => {
    // Sin esta excepción, una exposición de tres meses se caería por haber
    // abierto hace cinco semanas, que sería absurdo.
    const enCurso = makeCluster({
      startDate: '2026-07-01T10:00:00.000+02:00',
      endDate: '2026-11-30T20:00:00.000+01:00',
    })
    expect(prefilter(enCurso, ctx())).toEqual({ pass: true })
  })

  it('5 · fuera del recuadro metropolitano → fuera', () => {
    // Madrid.
    expect(prefilter(makeCluster({ lat: 40.4168, lng: -3.7038 }), ctx())).toEqual({
      pass: false,
      reason: 'fuera-de-barcelona',
    })
  })

  it('6 · la lista negra de rutas caza el contenido comercial', () => {
    const patrocinado = makeCluster()
    const conUrlMala = {
      ...patrocinado,
      sources: [{ ...patrocinado.sources[0]!, url: 'https://medio.test/publirreportaje/algo' }],
    }
    expect(prefilter(conUrlMala, ctx())).toEqual({ pass: false, reason: 'url-en-lista-negra' })
  })

  it('7 · los marcadores publicitarios en el texto también', () => {
    const marcado = makeCluster({
      description: 'Contenido patrocinado por una marca de bebidas. Ven a probarlo.',
    })
    expect(prefilter(marcado, ctx())).toEqual({
      pass: false,
      reason: 'marcadores-publicitarios',
    })
  })

  it('8 · sin material no hay ficha honesta que escribir', () => {
    const pobre = makeCluster({ description: 'Concierto.', extractText: 'Hoy.' })
    expect(prefilter(pobre, ctx())).toEqual({ pass: false, reason: 'material-insuficiente' })
  })

  it('9 · una sola fuente A/B con puntuación baja no tiene caso', () => {
    const solo = makeCluster()
    expect(prefilter(solo, ctx({ deterministicScore: 12 }))).toEqual({
      pass: false,
      reason: 'sin-consenso-ni-ficha',
    })
  })

  it('9 bis · ese paso NO se aplica a los museos', () => {
    const museo = makeCluster({
      collection: 'museums',
      category: 'museums',
      seedSlug: 'museu-picasso',
    })
    expect(prefilter(museo, ctx({ deterministicScore: 0 }))).toEqual({ pass: true })
  })

  it('10 · si planonmap ya lo cubre bien, no aportamos nada', () => {
    const cluster = makeCluster()
    expect(
      prefilter(cluster, ctx({ wellCoveredKeys: new Set([cluster.planonmapDedupeKey]) })),
    ).toEqual({ pass: false, reason: 'ya-cubierto-por-planonmap' })
  })
})

describe('vigencia', () => {
  it('da 5 si empieza en 14 días o menos, y baja por tramos', () => {
    expect(freshnessPoints(makeCluster({ startDate: '2026-09-10T19:00:00.000+02:00' }), NOW, SCORING)).toBe(5)
    expect(freshnessPoints(makeCluster({ startDate: '2026-09-25T19:00:00.000+02:00' }), NOW, SCORING)).toBe(3)
    expect(freshnessPoints(makeCluster({ startDate: '2026-10-20T19:00:00.000+02:00' }), NOW, SCORING)).toBe(1)
    expect(freshnessPoints(makeCluster({ startDate: '2027-06-01T19:00:00.000+02:00' }), NOW, SCORING)).toBe(0)
  })
})
