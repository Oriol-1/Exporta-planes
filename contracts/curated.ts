// contracts/curated.ts
import { z } from 'zod'
import { EventSchema, ScheduleSlotSchema } from './event'

export const CuratedCollectionSchema = z.enum(['plans', 'shows', 'museums'])
export type CuratedCollection = z.infer<typeof CuratedCollectionSchema>

/** Texto bilingüe. El español es obligatorio; el inglés, muy recomendable. */
const BilingualSchema = z.object({
  es: z.string().min(1),
  en: z.string().min(1).optional(),
})

export const ProvenanceSchema = z.object({
  url: z.string().url(),
  publisher: z.string().min(1).max(120),
  tier: z.enum(['A', 'B', 'C']),
  retrievedAt: z.string().datetime({ offset: true }),
})
export type Provenance = z.infer<typeof ProvenanceSchema>

export const CuratedSchema = z.object({
  collection: CuratedCollectionSchema,
  /** Identificador estable de por vida. Clave de caché, de veto y de identidad. */
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  schemaVersion: z.literal(1),
  curatedAt: z.string().datetime({ offset: true }),
  promptVersion: z.string().min(1).max(40),
  score: z.number().min(0).max(100),
  temporality: z.enum(['atemporal', 'temporada']),

  consensus: z.object({
    sourceCount: z.number().int().min(1),
    sources: z.array(z.string().min(1)).min(1),
  }),

  whyWorthIt: z.object({
    es: z.string().min(1).max(160),
    en: z.string().min(1).max(160).optional(),
  }),

  practical: z.object({
    durationMinutes: z.number().int().min(15).max(600).optional(),
    booking: z.enum(['ninguna', 'recomendada', 'obligatoria']).optional(),
    bookingLeadDays: z.number().int().min(0).max(90).optional(),
    activityLang: z.array(z.enum(['ca', 'es', 'en', 'sin-idioma'])).optional(),
    transit: BilingualSchema.optional(),
    priceIncludes: BilingualSchema.optional(),
  }),

  show: z
    .object({
      artistOrCompany: z.string().max(120).optional(),
      room: z.string().max(120).optional(),
      surtitles: z.array(z.enum(['ca', 'es', 'en'])).optional(),
    })
    .optional(),

  museum: z
    .object({
      openingHours: z.array(ScheduleSlotSchema).optional(),
      freeAdmission: z.array(z.string().max(120)).optional(),
      currentExhibition: z
        .object({
          title: z.string().min(1).max(200),
          endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .optional(),
      visitMinutes: z.number().int().min(20).max(300).optional(),
      bookAhead: z.boolean().optional(),
    })
    .optional(),

  provenance: z.array(ProvenanceSchema).min(1),

  verified: z.object({
    price: z.boolean(),
    schedule: z.boolean(),
    dates: z.boolean(),
    location: z.boolean(),
    method: z.string().min(1).max(60),   // 'evidence-substring'
  }),

  planonmap: z.object({
    /**
     * Clave de emparejamiento con el feed abierto. OJO: para temporality
     * 'atemporal' es INESTABLE por construcción (§4.9). La identidad es el slug.
     */
    dedupeKey: z.string().min(1),
    mergeHint: z.enum(['new', 'merge']),
  }),

  /** Una ficha bloqueada no se regenera jamás, aunque cambie el prompt (§3.7). */
  locked: z.boolean().optional(),
})
export type Curated = z.infer<typeof CuratedSchema>

/** Lo que de verdad se publica: un Event de planonmap + el bloque curated. */
export const CuratedEventSchema = EventSchema.extend({
  source: z.literal('curated'),
  curated: CuratedSchema,
})
export type CuratedEvent = z.infer<typeof CuratedEventSchema>
