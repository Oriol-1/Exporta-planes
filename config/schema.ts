// config/schema.ts
// Esquemas Zod de TODO lo que vive en config/. La configuración es TypeScript
// validado al cargar, no YAML: un `trust: "1.0"` con comillas o un `tier: 'D'`
// inexistente se detectan en `pnpm typecheck` Y al arrancar (§3.5).
import { z } from 'zod'

export const TierSchema = z.enum(['A', 'B', 'C'])
export type Tier = z.infer<typeof TierSchema>

export const CollectionSchema = z.enum(['plans', 'shows', 'museums'])
export type Collection = z.infer<typeof CollectionSchema>

export const DiscoverySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('sitemap'),
    url: z.string().url().optional(),
    /** Filtra las URL finales: solo se quedan las que contengan alguno. */
    pathIncludes: z.array(z.string()).optional(),
    /**
     * Filtra los SUB-SITEMAPS de un índice, que es distinto y suele importar
     * más. Un índice de WordPress mezcla taxonomías, páginas y varios archivos
     * históricos: sin este filtro se leen los ocho primeros, que casi nunca son
     * los que traen el contenido. Ejemplo real: en teatrebarcelona.com las obras
     * están en `espectacle-sitemap*.xml`, y los ocho primeros del índice son
     * artículos de revista y páginas estáticas.
     */
    sitemapIncludes: z.array(z.string()).optional(),
  }),
  z.object({ kind: z.literal('rss'), url: z.string().url() }),
  z.object({ kind: z.literal('perEntity') }),
  z.object({ kind: z.literal('manual') }),
])
export type Discovery = z.infer<typeof DiscoverySchema>

export const SourceConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  tier: TierSchema,
  trust: z.number().min(0).max(1),
  collections: z.array(CollectionSchema).min(1),
  home: z.string().url().nullable(),
  discovery: DiscoverySchema,
  crawlDelayMs: z.number().int().min(1000),        // nunca por debajo de 1 s
  maxPagesPerDay: z.number().int().min(1).max(100),
  /** Fecha de la última revisión legal y técnica. SIN ESTO, LA FUENTE NO SE RASTREA. */
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Nota de esa revisión: qué dice su robots.txt y sus condiciones de uso. */
  verifiedNote: z.string().max(300).optional(),
})
export type SourceConfig = z.infer<typeof SourceConfigSchema>

/** Nivel C con trust > 0 sería un museo avalándose a sí mismo (§4.1). */
export const SourcesSchema = z
  .array(SourceConfigSchema)
  .min(1)
  .refine((ss) => new Set(ss.map((s) => s.id)).size === ss.length, {
    message: 'hay ids de fuente duplicados',
  })
  .refine((ss) => ss.every((s) => s.tier !== 'C' || s.trust === 0), {
    message: 'una fuente de nivel C no puede tener trust > 0: no cuenta para el consenso',
  })

// ── Catálogo semilla de museos (§5.1, la excepción de los museos) ────────────
export const MuseumSeedSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().min(1),
  officialUrl: z.string().url(),
  /** Página concreta de horarios y precios, si difiere de la home. */
  hoursUrl: z.string().url().optional(),
  ticketsUrl: z.string().url().optional(),
  address: z.string().min(1),
  lat: z.number().min(41.2).max(41.6),
  lng: z.number().min(1.9).max(2.35),
  neighborhood: z.string().optional(),
  district: z.string().optional(),
  municipality: z.string().default('barcelona'),
  zipCode: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Museos que no se proponen (cerrados por obras, fuera de alcance…). */
  enabled: z.boolean().default(true),
})
export type MuseumSeed = z.infer<typeof MuseumSeedSchema>

export const MuseumsSchema = z
  .array(MuseumSeedSchema)
  .min(1)
  .refine((ms) => new Set(ms.map((m) => m.slug)).size === ms.length, {
    message: 'hay slugs de museo duplicados',
  })

// ── Puntuación (§5.1) ────────────────────────────────────────────────────────
export const ScoringSchema = z.object({
  /** Base de consenso por número de fuentes A/B. 4 o más → el valor de `4`. */
  consensusBase: z.object({
    1: z.number().int().min(0).max(25),
    2: z.number().int().min(0).max(25),
    3: z.number().int().min(0).max(25),
    4: z.number().int().min(0).max(25),
  }),
  completenessPointsPerField: z.number().int().min(0).max(10),
  freshness: z.object({ d14: z.number(), d30: z.number(), d60: z.number() }),
  maxReputation: z.number().int().min(0).max(10),
  /** Umbral de paso al enriquecimiento. El número más ajustable del proyecto. */
  threshold: z.number().int().min(0).max(100),
  /** Umbral rebajado para rellenar una cuota que quedó sin cubrir (§5.6). */
  quotaFallbackThreshold: z.number().int().min(0).max(100),
  /** Puntuación determinista mínima para una sola fuente A/B (prefiltro, paso 9). */
  singleSourceMinDeterministic: z.number().int().min(0).max(45),
})
export type Scoring = z.infer<typeof ScoringSchema>

// ── Cuotas de variedad (§5.6) ────────────────────────────────────────────────
export const QuotasSchema = z.object({
  maxPorCategoria: z.number().int().min(1),
  maxPorBarrio: z.number().int().min(1),
  maxPorRecinto: z.number().int().min(1),
  minGratuitos: z.number().int().min(0),
  minAtemporales: z.number().int().min(0),
  minTemporada: z.number().int().min(0),
  /** Precio en euros por debajo del cual una ficha cuenta como "barata". */
  umbralGratuitoEur: z.number().min(0),
})
export type Quotas = z.infer<typeof QuotasSchema>

// ── Presupuesto y precios por millón de tokens (§7.2, §7.6) ─────────────────
export const ModelPricingSchema = z.object({
  inputPerMTokUsd: z.number().nonnegative(),
  outputPerMTokUsd: z.number().nonnegative(),
  /** Descuento del Batch API, ya aplicado a los dos precios de arriba si `batch`. */
  batch: z.boolean().default(false),
})
export type ModelPricing = z.infer<typeof ModelPricingSchema>

export const BudgetSchema = z.object({
  monthlyBudgetEur: z.number().positive(),
  usdToEur: z.number().positive(),
  /** Aviso en la incidencia del mes al superar esta fracción del tope. */
  warnAtFraction: z.number().min(0).max(1),
  pricing: z.record(z.string(), ModelPricingSchema),
  screenModel: z.string().min(1),
  writerModel: z.string().min(1),
  writerFallbackModel: z.string().min(1),
  /** Tamaños de lote (§5.3, §7.3). */
  screenBatchSize: z.number().int().min(1).max(20),
  writeBatchSize: z.number().int().min(1).max(50),
  screenMaxOutputTokens: z.number().int().min(1000),
  writeMaxTokens: z.number().int().min(1000),
  /** Horas tras las que un lote sin resolver se cancela (§7.2 ter). */
  batchExpiryHours: z.number().int().min(1),
})
export type Budget = z.infer<typeof BudgetSchema>
