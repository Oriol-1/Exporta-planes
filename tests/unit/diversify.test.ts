// Variedad forzada (§5.6). La puntuación sola produce listas monótonas: seis
// museos de arte, todos en Ciutat Vella, todos de 15 €.
import { describe, expect, it } from 'vitest'
import { QUOTAS } from '../../config/quotas'
import { SCORING } from '../../config/scoring'
import { coverage, diversify } from '../../src/screen/diversify'
import { makeCluster, makeScored } from '../fixtures/clusters'

describe('cuotas duras', () => {
  it('no deja pasar más de dos de la misma categoría', () => {
    const candidatos = [90, 88, 86, 84].map((total, i) =>
      makeScored(
        makeCluster({
          clusterId: `plan-${i}`,
          category: 'museums',
          neighborhood: `Barrio ${i}`,
          venueName: `Recinto ${i}`,
        }),
        total,
      ),
    )
    const result = diversify(candidatos, QUOTAS, SCORING, 10)
    expect(result.selected.length).toBe(QUOTAS.maxPorCategoria)
    expect(result.rejected.some((r) => r.reason.includes('categoría'))).toBe(true)
  })

  it('no deja pasar dos cosas del mismo recinto', () => {
    const candidatos = [90, 88].map((total, i) =>
      makeScored(
        makeCluster({
          clusterId: `plan-${i}`,
          category: i === 0 ? 'music' : 'arts',
          neighborhood: `Barrio ${i}`,
          venueName: 'Teatre Lliure',
        }),
        total,
      ),
    )
    const result = diversify(candidatos, QUOTAS, SCORING, 10)
    expect(result.selected.length).toBe(1)
    expect(result.rejected[0]?.reason).toContain('recinto')
  })

  it('respeta el orden por puntuación', () => {
    const candidatos = [70, 95, 80].map((total, i) =>
      makeScored(
        makeCluster({
          clusterId: `plan-${i}`,
          category: (['music', 'arts', 'food'] as const)[i] ?? 'culture',
          neighborhood: `Barrio ${i}`,
          venueName: `Recinto ${i}`,
        }),
        total,
      ),
    )
    const result = diversify(candidatos, QUOTAS, SCORING, 10)
    expect(result.selected.map((s) => s.total)).toEqual([95, 80, 70])
  })
})

describe('mínimos', () => {
  it('rebaja el umbral a 55 SOLO para cubrir un hueco', () => {
    const caro = makeScored(
      makeCluster({ clusterId: 'caro', category: 'arts', venueName: 'A', neighborhood: 'X' }),
      90,
      'temporada',
    )
    const baratoJusto = makeScored(
      makeCluster({
        clusterId: 'barato',
        category: 'outdoors',
        venueName: 'B',
        neighborhood: 'Y',
        price: { type: 'free' },
      }),
      58, // por debajo de 62, pero por encima de 55
      'atemporal',
    )
    const result = diversify([caro, baratoJusto], QUOTAS, SCORING, 10)
    expect(result.selected.map((s) => s.cluster.clusterId)).toContain('barato')
  })

  it('NUNCA publica algo malo por rellenar una cuota', () => {
    // Si el único candidato que cubriría el hueco está por debajo de 55, el
    // hueco se queda vacío y se informa.
    const caro = makeScored(
      makeCluster({ clusterId: 'caro', category: 'arts', venueName: 'A', neighborhood: 'X' }),
      90,
      'temporada',
    )
    const baratoMalo = makeScored(
      makeCluster({
        clusterId: 'barato-malo',
        category: 'outdoors',
        venueName: 'B',
        neighborhood: 'Y',
        price: { type: 'free' },
      }),
      40,
      'atemporal',
    )
    const result = diversify([caro, baratoMalo], QUOTAS, SCORING, 10)
    expect(result.selected.map((s) => s.cluster.clusterId)).not.toContain('barato-malo')
    expect(result.unmetMinimums.some((u) => u.startsWith('minGratuitos'))).toBe(true)
  })

  it('un precio sin confirmar no cuenta como gratuito', () => {
    const sinPrecio = makeScored(
      makeCluster({
        clusterId: 'sin-precio',
        category: 'outdoors',
        venueName: 'B',
        neighborhood: 'Y',
        price: { type: 'unknown' },
      }),
      80,
      'atemporal',
    )
    const result = diversify([sinPrecio], QUOTAS, SCORING, 10)
    expect(result.unmetMinimums.some((u) => u.startsWith('minGratuitos'))).toBe(true)
  })
})

describe('cobertura', () => {
  it('cuenta el reparto por categoría y por barrio', () => {
    const selected = [
      makeScored(makeCluster({ category: 'music', neighborhood: 'El Raval' }), 80),
      makeScored(makeCluster({ category: 'arts', neighborhood: 'El Raval' }), 78),
    ]
    const c = coverage(selected)
    expect(c.byCategory['music']).toBe(1)
    expect(c.byNeighborhood['el raval']).toBe(2)
  })
})
