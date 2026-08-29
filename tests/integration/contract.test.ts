// tests/integration/contract.test.ts
// EL FIXTURE DORADO COMPARTIDO (§5.8, salvaguarda 2).
//
// `contracts/golden/curated-golden.json` existe BYTE A BYTE en los dos
// repositorios. Lo produce ESTE proyecto y se entrega a planonmap; la dirección
// importa, porque el productor es quien decide qué emite. bcn-curator comprueba
// que su esquema lo valida; planonmap comprueba lo mismo con el suyo.
//
// Si alguien cambia un campo obligatorio en cualquiera de los dos lados, UNO DE
// LOS DOS TESTS SE PONE EN ROJO EL MISMO DÍA — no seis meses después con
// doscientas fichas escritas.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CuratedEventSchema } from '../../contracts/curated'
import { EventSchema } from '../../contracts/event'
import { GOLDEN_FIXTURE } from '../../src/store/paths'

const golden = JSON.parse(readFileSync(GOLDEN_FIXTURE, 'utf8')) as unknown[]

describe('fixture dorado', () => {
  it('contiene un elemento de cada colección', () => {
    const parsed = golden.map((g) => CuratedEventSchema.parse(g))
    expect(parsed.map((p) => p.curated.collection).sort()).toEqual(['museums', 'plans', 'shows'])
  })

  it('cada elemento valida contra CuratedEventSchema', () => {
    for (const item of golden) {
      const result = CuratedEventSchema.safeParse(item)
      if (!result.success) {
        throw new Error(
          `elemento inválido: ${result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(' · ')}`,
        )
      }
    }
  })

  it('cada elemento valida también como Event puro de planonmap', () => {
    // Lo que de verdad garantiza la interoperabilidad: si le quitamos el bloque
    // `curated`, sigue siendo un evento que planonmap sabe pintar.
    for (const item of golden) {
      const event = { ...(item as Record<string, unknown>) }
      delete event['curated']
      expect(EventSchema.safeParse(event).success).toBe(true)
    }
  })

  it('la ÚNICA modificación que planonmap necesita es añadir `curated` a su enum `source`', () => {
    // Se comprueba al revés: con `source: "custom"` —un valor que su esquema YA
    // acepta— el elemento valida sin ningún otro cambio. Eso confirma que no le
    // pedimos nada más (§A.1).
    for (const item of golden) {
      const event = { ...(item as Record<string, unknown>) }
      delete event['curated']
      expect(EventSchema.safeParse({ ...event, source: 'custom' }).success).toBe(true)
    }
  })
})

describe('las tres trampas del esquema (§A.1)', () => {
  it('startDate EXIGE offset', () => {
    const base = { ...(golden[0] as Record<string, unknown>) }
    expect(CuratedEventSchema.safeParse({ ...base, startDate: '2026-09-10T19:30:00' }).success).toBe(
      false,
    )
    expect(
      CuratedEventSchema.safeParse({ ...base, startDate: '2026-09-10T19:30:00+02:00' }).success,
    ).toBe(true)
  })

  it('tags es obligatorio, aunque pueda ir vacío', () => {
    const base = { ...(golden[0] as Record<string, unknown>) }
    delete base['tags']
    expect(CuratedEventSchema.safeParse(base).success).toBe(false)
    expect(CuratedEventSchema.safeParse({ ...base, tags: [] }).success).toBe(true)
  })

  it('price es una unión discriminada, nunca un número', () => {
    const base = { ...(golden[0] as Record<string, unknown>) }
    expect(CuratedEventSchema.safeParse({ ...base, price: 15 }).success).toBe(false)
    expect(
      CuratedEventSchema.safeParse({
        ...base,
        price: { type: 'paid', amount: 15, currency: 'USD' },
      }).success,
    ).toBe(false)
    expect(
      CuratedEventSchema.safeParse({
        ...base,
        price: { type: 'paid', amount: 15, currency: 'EUR' },
      }).success,
    ).toBe(true)
  })
})

describe('invariantes del bloque curated', () => {
  it('el slug cumple ^[a-z0-9-]{3,60}$ y coincide con el id', () => {
    for (const item of golden) {
      const parsed = CuratedEventSchema.parse(item)
      expect(parsed.curated.slug).toMatch(/^[a-z0-9-]{3,60}$/)
      expect(parsed.id).toBe(`curated|${parsed.curated.collection}|${parsed.curated.slug}`)
    }
  })

  it('toda ficha declara al menos una fuente en provenance', () => {
    for (const item of golden) {
      expect(CuratedEventSchema.parse(item).curated.provenance.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('el español es obligatorio en whyWorthIt; el inglés es opcional', () => {
    const base = JSON.parse(JSON.stringify(golden[0])) as Record<string, any>
    delete base['curated']['whyWorthIt']['en']
    expect(CuratedEventSchema.safeParse(base).success).toBe(true)
    delete base['curated']['whyWorthIt']['es']
    expect(CuratedEventSchema.safeParse(base).success).toBe(false)
  })

  it('el ejemplo con verified.schedule false NO trae schedule inventado', () => {
    // §8.7: no se encontró evidencia literal de un horario, así que `schedule`
    // se OMITIÓ en lugar de inventarse. La ficha se publica igual.
    const plan = golden
      .map((g) => CuratedEventSchema.parse(g))
      .find((p) => p.curated.collection === 'plans')
    expect(plan?.curated.verified.schedule).toBe(false)
    expect(plan?.schedule).toBeUndefined()
  })
})
