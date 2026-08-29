// contracts/event.ts
// TRANSCRIPCIÓN del esquema de eventos de planonmap. Ver contracts/UPSTREAM.md.
// NO EDITAR A MANO salvo para versionar el contrato (§9.4 del plan).
import { z } from 'zod'

// ── Categorías normalizadas ──────────────────────────────────────────────────
export const CategorySchema = z.enum([
  'music',
  'family',
  'arts',
  'museums',
  'exhibitions',
  'sports',
  'food',
  'culture',
  'outdoors',
  'other',
])
export type Category = z.infer<typeof CategorySchema>

// ── Precio ───────────────────────────────────────────────────────────────────
// Solo se marca 'free' cuando la fuente lo confirma explícitamente.
// 'unknown' = sin información fiable → la interfaz NO debe mostrar "Gratis".
export const PriceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('free') }),
  z.object({ type: z.literal('free-with-booking') }),
  z.object({ type: z.literal('included-with-admission') }),
  z.object({ type: z.literal('invitation') }),
  z.object({
    type: z.literal('paid'),
    amount: z.number().nonnegative(),
    amountMax: z.number().nonnegative().optional(),
    currency: z.literal('EUR'),
    hasSurcharge: z.boolean().optional(),
  }),
  z.object({ type: z.literal('paid-unknown') }),
  z.object({ type: z.literal('unknown') }),
])
export type Price = z.infer<typeof PriceSchema>

export const PRICE_TYPES = [
  'free',
  'free-with-booking',
  'included-with-admission',
  'invitation',
  'paid',
  'paid-unknown',
  'unknown',
] as const
export type PriceType = (typeof PRICE_TYPES)[number]

// ── Contacto ─────────────────────────────────────────────────────────────────
export const ContactSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  instagram: z.string().url().optional(),
  facebook: z.string().url().optional(),
  youtube: z.string().url().optional(),
})
export type Contact = z.infer<typeof ContactSchema>

// ── Galería y documentos ─────────────────────────────────────────────────────
export const GalleryImageSchema = z.object({
  url: z.string().url(),
  thumb: z.string().url().optional(),
  alt: z.string().optional(),
})
export type GalleryImage = z.infer<typeof GalleryImageSchema>

export const EventDocumentSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
  type: z.literal('pdf').default('pdf'),
})
export type EventDocument = z.infer<typeof EventDocumentSchema>

// ── Tramo de horario ─────────────────────────────────────────────────────────
export const ScheduleSlotSchema = z.object({
  days: z.string(),                  // "Martes a domingo"
  hours: z.string(),                 // "de 10.00 h a 19.00 h"
  price: z.string().optional(),      // texto literal del precio en esa franja
})
export type ScheduleSlot = z.infer<typeof ScheduleSlotSchema>

// ── Lugar ────────────────────────────────────────────────────────────────────
export const VenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  neighborhood: z.string().optional(),
  district: z.string().optional(),
  /** Slug estable de municipio: 'barcelona', 'lhospitalet', 'santacoloma'… */
  municipality: z.string().optional(),
  zipCode: z.string().optional(),
  /**
   * Precisión de lat/lng. Ausente se interpreta como 'exact'. Si NO es 'exact',
   * la interfaz avisa de "ubicación aproximada".
   */
  locationPrecision: z.enum(['exact', 'neighborhood', 'district']).optional(),
})
export type Venue = z.infer<typeof VenueSchema>

// ── Marca de fiesta de barrio (la calcula planonmap; NO la envíes) ───────────
export const EventFestivalRefSchema = z.object({
  id: z.string().min(1),
  highlightKind: z.string().optional(),
  intensity: z.enum(['alta', 'media']).optional(),
  auto: z.boolean().optional(),
})
export type EventFestivalRef = z.infer<typeof EventFestivalRefSchema>

// ── Señales derivadas (las calcula planonmap; NO las envíes) ─────────────────
export const SignalsSchema = z.object({
  quality: z.number().min(0).max(1),
  popularity: z.number().min(0).max(1),
  touristVsLocal: z.number().min(-1).max(1),
  effectiveStartHour: z.number().min(0).max(24).nullable(),
})
export type Signals = z.infer<typeof SignalsSchema>

// ── Contenido localizado ─────────────────────────────────────────────────────
export const LocalizedStringSchema = z.object({
  ca: z.string().optional(),
  es: z.string().optional(),
  en: z.string().optional(),
})
export type LocalizedString = z.infer<typeof LocalizedStringSchema>

export const EventI18nSchema = z.object({
  title: LocalizedStringSchema.optional(),
  description: LocalizedStringSchema.optional(),
})
export type EventI18n = z.infer<typeof EventI18nSchema>

// ── Procedencia oficial verificada ───────────────────────────────────────────
export const OfficialSourceSchema = z.object({
  urlStatus: z.enum(['verified', 'candidate', 'unverified', 'broken']).optional(),
  urlCheckedAt: z.string().datetime({ offset: true }).optional(),
  imageStatus: z.enum(['verified', 'candidate', 'fallback', 'broken']).optional(),
  imageCheckedAt: z.string().datetime({ offset: true }).optional(),
  verifiedBy: z.enum(['auto', 'admin']).optional(),
  matchReason: z.string().max(200).optional(),
})
export type OfficialSource = z.infer<typeof OfficialSourceSchema>

// ── Evento ───────────────────────────────────────────────────────────────────
export const EventSchema = z.object({
  id: z.string().min(1),
  source: z.enum([
    'opendatabcn',
    'agendadiaria',
    'diputaciobcn',
    'districteagenda',
    'lhospitalet',
    'agendacultura',
    'cornella',
    'mercatsfires',
    'custom',
    'curated',            // ← lo añade planonmap al conectar la fuente externa
  ]),
  contentLang: z.enum(['ca', 'es', 'en']).optional(),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  officialUrl: z.string().url().optional(),
  ticketsUrl: z.string().url().optional(),
  registrationUrl: z.string().url().optional(),
  icalUrl: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string(),
  image: z.string().url().optional(),
  imageSource: z.enum(['event', 'venue', 'festival']).optional(),
  imageCredit: z.string().optional(),
  gallery: z.array(GalleryImageSchema).optional(),
  documents: z.array(EventDocumentSchema).optional(),
  audience: z.string().max(20).optional(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).optional(),
  schedule: z.array(ScheduleSlotSchema).optional(),
  venue: VenueSchema,
  category: CategorySchema,
  categories: z.array(CategorySchema).optional(),
  price: PriceSchema,
  contact: ContactSchema.optional(),
  tags: z.array(z.string()),
  signals: SignalsSchema.optional(),
  festival: EventFestivalRefSchema.optional(),
  i18n: EventI18nSchema.optional(),
  officialSource: OfficialSourceSchema.optional(),
})
export type Event = z.infer<typeof EventSchema>
