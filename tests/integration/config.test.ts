// tests/integration/config.test.ts
// La configuración es TypeScript VALIDADO AL CARGAR, no YAML (§3.5): un
// `trust: "1.0"` con comillas o un `tier: 'D'` inexistente se detectan en
// `pnpm typecheck` Y al arrancar, en vez de producir un consenso mal calculado
// que nadie nota.
import { describe, expect, it } from 'vitest'
import { loadConfig, VERIFICATION_MAX_AGE_DAYS } from '../../config/index'
import { SourcesSchema } from '../../config/schema'
import { MUSEUMS } from '../../config/museums'
import { SOURCES } from '../../config/sources'
import { BBOX } from '../../src/normalize/geo'

// Poco después de la fecha de verificación declarada en config/sources.ts.
const NOW = new Date('2026-09-03T02:30:00Z')

describe('LA PUERTA DE SEGURIDAD `verifiedAt` (§3.5)', () => {
  it('una fuente SIN verifiedAt se salta en silencio, pero avisa', () => {
    const config = loadConfig(NOW)
    const sinVerificar = SOURCES.filter((s) => !s.verifiedAt).map((s) => s.id)
    expect(sinVerificar.length).toBeGreaterThan(0)

    for (const id of sinVerificar) {
      expect(config.activeSources.some((s) => s.id === id)).toBe(false)
      expect(config.warnings.some((w) => w.id === id && w.message.includes('sin verificar'))).toBe(
        true,
      )
    }
  })

  it('solo se rastrea lo verificado', () => {
    const config = loadConfig(NOW)
    expect(config.activeSources.every((s) => s.verifiedAt !== undefined)).toBe(true)
    expect(config.activeSources.length).toBeLessThan(config.allSources.length)
  })

  it('avisa cuando la revisión legal caduca a los 180 días', () => {
    const muchoDespues = new Date('2027-06-01T00:00:00Z')
    const config = loadConfig(muchoDespues)
    expect(config.warnings.some((w) => w.message.includes('días'))).toBe(true)
    // Caducada se rastrea pero avisa; sin verificar NO se rastrea. No es lo mismo.
    expect(config.activeSources.length).toBeGreaterThan(0)
    expect(VERIFICATION_MAX_AGE_DAYS).toBe(180)
  })
})

describe('esquema de fuentes', () => {
  it('rechaza un tier inexistente', () => {
    const malo = [{ ...SOURCES[0]!, tier: 'D' }]
    expect(SourcesSchema.safeParse(malo).success).toBe(false)
  })

  it('rechaza un trust escrito como cadena', () => {
    const malo = [{ ...SOURCES[0]!, trust: '1.0' }]
    expect(SourcesSchema.safeParse(malo).success).toBe(false)
  })

  it('rechaza un crawlDelayMs por debajo de 1 s', () => {
    const malo = [{ ...SOURCES[0]!, crawlDelayMs: 500 }]
    expect(SourcesSchema.safeParse(malo).success).toBe(false)
  })

  it('rechaza una fuente de nivel C con trust > 0', () => {
    // Sería un museo avalándose a sí mismo (§4.1).
    const malo = [{ ...SOURCES[0]!, id: 'nivel-c-tramposo', tier: 'C', trust: 0.9 }]
    expect(SourcesSchema.safeParse(malo).success).toBe(false)
  })

  it('rechaza ids duplicados', () => {
    expect(SourcesSchema.safeParse([SOURCES[0]!, SOURCES[0]!]).success).toBe(false)
  })
})

describe('config/sources.ts, tal y como está', () => {
  const config = loadConfig(NOW)

  it('respeta el Crawl-delay declarado por teatrebarcelona.com', () => {
    const teatre = config.allSources.find((s) => s.id === 'teatre-barcelona')
    expect(teatre?.crawlDelayMs).toBe(10_000)
    expect(teatre?.verifiedNote).toContain('Crawl-delay: 10')
  })

  it('las fuentes verificadas documentan su revisión', () => {
    for (const source of config.activeSources) {
      expect(source.verifiedNote, `${source.id} sin nota de revisión`).toBeTruthy()
    }
  })

  it('ninguna fuente de nivel C cuenta para el consenso', () => {
    for (const source of config.allSources.filter((s) => s.tier === 'C')) {
      expect(source.trust).toBe(0)
    }
  })
})

describe('config/museums.ts', () => {
  const config = loadConfig(NOW)

  it('el catálogo tiene el tamaño que anuncia el plan (40–60)', () => {
    expect(config.museums.length).toBeGreaterThanOrEqual(40)
    expect(config.museums.length).toBeLessThanOrEqual(60)
  })

  it('todas las coordenadas caen dentro del recuadro metropolitano', () => {
    for (const m of config.museums) {
      expect(m.lat, m.slug).toBeGreaterThanOrEqual(BBOX.minLat)
      expect(m.lat, m.slug).toBeLessThanOrEqual(BBOX.maxLat)
      expect(m.lng, m.slug).toBeGreaterThanOrEqual(BBOX.minLng)
      expect(m.lng, m.slug).toBeLessThanOrEqual(BBOX.maxLng)
    }
  })

  it('todos los slugs cumplen el patrón del contrato y son únicos', () => {
    const slugs = MUSEUMS.map((m) => m.slug)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]{3,60}$/)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('un museo deshabilitado no entra en el catálogo activo', () => {
    const disabled = MUSEUMS.filter((m) => m.enabled === false)
    expect(disabled.length).toBeGreaterThan(0)
    for (const m of disabled) {
      expect(config.museums.some((c) => c.slug === m.slug)).toBe(false)
    }
  })

  it('cubre varios municipios del área metropolitana', () => {
    const municipios = new Set(config.museums.map((m) => m.municipality))
    expect(municipios.size).toBeGreaterThan(1)
    expect(municipios.has('barcelona')).toBe(true)
  })
})

describe('presupuesto', () => {
  it('conoce el precio de los tres modelos que puede llegar a usar', () => {
    const config = loadConfig(NOW)
    for (const model of [
      config.budget.screenModel,
      config.budget.writerModel,
      config.budget.writerFallbackModel,
    ]) {
      expect(config.budget.pricing[model], model).toBeDefined()
    }
  })

  it('el tope por defecto son 5 € y el aviso llega al 70 %', () => {
    const config = loadConfig(NOW)
    expect(config.budget.monthlyBudgetEur).toBeLessThanOrEqual(5)
    expect(config.budget.warnAtFraction).toBe(0.7)
  })

  it('max_output_tokens del cribado deja margen al razonamiento (defecto nº 16)', () => {
    // Ese tope INCLUYE los tokens de razonamiento: con 1.200 la respuesta se
    // cortaría a mitad de JSON de forma intermitente.
    const config = loadConfig(NOW)
    expect(config.budget.screenMaxOutputTokens).toBeGreaterThanOrEqual(3000)
  })
})
