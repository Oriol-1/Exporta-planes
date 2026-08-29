// tests/integration/publish.test.ts
// La publicación y sus guardas (§9.2).
//
// La regla heredada de planonmap y que es innegociable: UN REFRESCO POBRE NUNCA
// DEGRADA LO PUBLICADO.
import { describe, expect, it } from 'vitest'
import { build, MAX_INVALID_FRACTION } from '../../src/publish/build'
import { serialize, verifyChecksum } from '../../src/publish/checksums'
import { CollectionFileSchema, IndexFileSchema } from '../../contracts/output'
import { readCards } from '../../src/store/content'

const NOW = new Date('2026-09-03T02:30:00Z')
const NOW_ISO = '2026-09-03T04:30:00.000+02:00'
const BASE = 'https://oriol-1.github.io/Exporta-planes'

async function buildDry() {
  return await build({
    now: NOW,
    nowIso: NOW_ISO,
    baseUrl: BASE,
    producerVersion: '0.1.0',
    dryRun: true,
  })
}

describe('build', () => {
  it('publica las fichas de museos de la Fase 0', async () => {
    const report = await buildDry()
    const museums = report.collections.find((c) => c.collection === 'museums')
    expect(museums?.published).toBeGreaterThanOrEqual(5)
    expect(museums?.heldBack).toBe(false)
  })

  it('una colección sin fichas NO se publica: ausente ≠ vacía (§A.3)', async () => {
    const report = await buildDry()
    const plans = report.collections.find((c) => c.collection === 'plans')
    expect(plans?.published).toBe(0)
    expect(report.index?.collections.some((c) => c.name === 'plans')).toBe(false)
  })

  it('el índice acepta entre una y tres colecciones, sin duplicados', async () => {
    const report = await buildDry()
    expect(report.index).not.toBeNull()
    expect(IndexFileSchema.safeParse(report.index).success).toBe(true)
    const names = report.index?.collections.map((c) => c.name) ?? []
    expect(new Set(names).size).toBe(names.length)
  })

  it('la URL de cada colección apunta a /v1/<colección>.json', async () => {
    const report = await buildDry()
    for (const c of report.index?.collections ?? []) {
      expect(c.url).toBe(`${BASE}/v1/${c.name}.json`)
    }
  })

  it('el umbral de degradación está donde dice el plan', () => {
    expect(MAX_INVALID_FRACTION).toBe(0.2)
  })
})

describe('sumas de verificación (§8.2)', () => {
  it('la sha256 se calcula sobre el archivo TAL CUAL se sirve', async () => {
    const { cards } = await readCards('museums')
    const file = CollectionFileSchema.parse({
      schemaVersion: 1,
      collection: 'museums',
      generatedAt: NOW_ISO,
      count: cards.length,
      license: 'CC-BY-4.0',
      items: cards.map((c) => c.event),
    })
    const serialized = serialize(file)
    expect(verifyChecksum(serialized.text, serialized.sha256)).toBe(true)
    // Un byte alterado en tránsito hace que planonmap lo descarte y conserve el
    // archivo que ya tenía.
    expect(verifyChecksum(serialized.text + ' ', serialized.sha256)).toBe(false)
  })

  it('la salida es estable: dos builds seguidos dan la misma suma', async () => {
    const a = await buildDry()
    const b = await buildDry()
    const shaA = a.collections.find((c) => c.collection === 'museums')?.sha256
    const shaB = b.collections.find((c) => c.collection === 'museums')?.sha256
    expect(shaA).toBe(shaB)
    // Sin orden estable por slug, cada build reordenaría el archivo y la suma
    // cambiaría sin que hubiera cambiado nada.
  })
})

describe('lo publicado sigue siendo válido para el consumidor', () => {
  it('cada elemento publicado valida contra el esquema completo', async () => {
    const { cards, invalid } = await readCards('museums')
    expect(invalid).toEqual([])
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.event.source).toBe('curated')
      expect(card.event.id).toBe(`curated|museums|${card.slug}`)
      expect(card.event.venue.lat).toBeGreaterThan(41.2)
      expect(card.event.venue.lat).toBeLessThan(41.6)
      expect(card.event.venue.lng).toBeGreaterThan(1.9)
      expect(card.event.venue.lng).toBeLessThan(2.35)
    }
  })

  it('ninguna ficha de la Fase 0 afirma un precio sin evidencia', async () => {
    // Se escribieron a mano para validar el CONTRATO, sin extracción. La regla
    // del §1.7 se aplica igual: sin prueba, `unknown`.
    const { cards } = await readCards('museums')
    for (const card of cards) {
      if (card.event.curated.verified.price === false) {
        expect(card.event.price.type).toBe('unknown')
      }
    }
  })

  it('las fichas bilingües llevan el español en los campos planos (§6.5)', async () => {
    const { cards } = await readCards('museums')
    for (const card of cards) {
      expect(card.event.contentLang).toBe('es')
      expect(card.event.title).toBe(card.event.i18n?.title?.es)
      expect(card.event.description).toBe(card.event.i18n?.description?.es)
      expect(card.event.i18n?.description?.en).toBeTruthy()
      // El catalán se deja ausente a propósito: la interfaz cae al español.
      expect(card.event.i18n?.description?.ca).toBeUndefined()
    }
  })
})
