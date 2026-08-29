// src/enrich/assemble.ts
// De ficha verificada a `CuratedEvent` publicable (§8).
//
// La decisión de diseño central: NO inventamos un formato, extendemos el de
// planonmap. Si algún día bcn-curator desaparece, los datos siguen siendo
// legibles por cualquier consumidor del esquema `Event`.
import type { Curated, CuratedCollection, CuratedEvent, Provenance } from '../../contracts/curated'
import type { Cluster, ScoredCluster, VerificationResult } from '../types'
import { CuratedEventSchema } from '../../contracts/curated'
import { curatedId } from '../core/ids'
import { deriveTags } from '../normalize/category'
import { dedupeKey, mergeHint } from '../cluster/planonmapKey'
import { PROMPT_VERSION } from '../core/hash'
import { museumWindow } from '../normalize/dates'
import { clip } from '../core/text'

export interface AssembleInput {
  readonly scored: ScoredCluster
  readonly verification: VerificationResult
  readonly slug: string
  readonly now: Date
  readonly nowIso: string
  readonly image?: { readonly url: string; readonly credit: string } | undefined
  /** Se conserva de la ficha anterior al refrescar un museo. */
  readonly locked?: boolean | undefined
}

function provenanceOf(cluster: Cluster): Provenance[] {
  return cluster.sources.map((s) => ({
    url: s.url,
    publisher: publisherName(s.id),
    tier: s.tier,
    retrievedAt: s.retrievedAt,
  }))
}

const PUBLISHERS: Readonly<Record<string, string>> = {
  'timeout-bcn': 'Time Out Barcelona',
  'barcelona-secreta': 'Barcelona Secreta',
  'lecool-bcn': 'Le Cool Barcelona',
  'beteve-agenda': 'betevé',
  'lavanguardia-quehacer': 'La Vanguardia',
  'teatre-barcelona': 'Teatre Barcelona',
  'enderrock-agenda': 'Enderrock',
  'visit-barcelona': 'Barcelona Turisme',
  'bcn-cultura': 'Barcelona Cultura',
  articket: 'Articket BCN',
  'museus-bcn': 'Museus de Barcelona',
  'venue-official': 'Web oficial del recinto',
}

function publisherName(sourceId: string): string {
  return PUBLISHERS[sourceId] ?? sourceId
}

/**
 * Construye el bloque `curated`. Los campos sin evidencia NO llegan aquí: el
 * verificador ya los eliminó (§6.4), y `exactOptionalPropertyTypes` hace que el
 * compilador vigile que se omitan en vez de emitirse vacíos.
 */
function buildCurated(input: AssembleInput): Curated {
  const { scored, verification, slug } = input
  const cluster = scored.cluster
  const card = verification.card
  const startDate = cluster.startDate ?? museumWindow(input.now).startDate

  const good = cluster.sources.filter((s) => s.tier === 'A' || s.tier === 'B')
  // Un museo entra por catálogo, así que su aval es su propia ficha oficial: el
  // consenso mínimo del contrato es 1, y ahí se declara lo que de verdad hay.
  const consensusSources = good.length > 0 ? good : cluster.sources.slice(0, 1)

  const practical: Curated['practical'] = {
    ...(card.duracionMin !== undefined ? { durationMinutes: card.duracionMin } : {}),
    ...(card.reserva !== undefined ? { booking: card.reserva } : {}),
    ...(card.reservaDiasAntelacion !== undefined
      ? { bookingLeadDays: card.reservaDiasAntelacion }
      : {}),
    ...(card.idiomaActividad !== undefined ? { activityLang: [...card.idiomaActividad] } : {}),
    ...(card.comoLlegar?.es
      ? {
          transit: {
            es: clip(card.comoLlegar.es, 200),
            ...(card.comoLlegar.en ? { en: clip(card.comoLlegar.en, 200) } : {}),
          },
        }
      : {}),
    ...(card.queIncluye?.es
      ? {
          priceIncludes: {
            es: clip(card.queIncluye.es, 200),
            ...(card.queIncluye.en ? { en: clip(card.queIncluye.en, 200) } : {}),
          },
        }
      : {}),
  }

  const museum =
    cluster.collection === 'museums' && card.museo
      ? {
          ...(card.museo.horarios?.length
            ? { openingHours: card.museo.horarios.map((h) => ({ days: h.dias, hours: h.horas })) }
            : {}),
          ...(card.museo.gratuidades?.length
            ? { freeAdmission: card.museo.gratuidades.map((g) => clip(g, 120)) }
            : {}),
          ...(card.museo.exposicionVigente
            ? { currentExhibition: {
                title: clip(card.museo.exposicionVigente.titulo, 200),
                endsOn: card.museo.exposicionVigente.hasta,
              } }
            : {}),
          ...(card.museo.minutosVisita !== undefined
            ? { visitMinutes: card.museo.minutosVisita }
            : {}),
          ...(card.museo.entradaAnticipada !== undefined
            ? { bookAhead: card.museo.entradaAnticipada }
            : {}),
        }
      : undefined

  const show =
    cluster.collection === 'shows' && card.espectaculo
      ? {
          ...(card.espectaculo.artistaCompania
            ? { artistOrCompany: clip(card.espectaculo.artistaCompania, 120) }
            : {}),
          ...(card.espectaculo.sala ? { room: clip(card.espectaculo.sala, 120) } : {}),
          ...(card.espectaculo.sobretitulos?.length
            ? { surtitles: [...card.espectaculo.sobretitulos] }
            : {}),
        }
      : undefined

  return {
    collection: cluster.collection,
    slug,
    schemaVersion: 1,
    curatedAt: input.nowIso,
    promptVersion: PROMPT_VERSION.write,
    score: Math.round(scored.total),
    temporality: scored.temporality,
    consensus: {
      sourceCount: consensusSources.length,
      sources: consensusSources.map((s) => s.id),
    },
    whyWorthIt: {
      es: clip(card.porQueMerecePena.es, 160),
      ...(card.porQueMerecePena.en ? { en: clip(card.porQueMerecePena.en, 160) } : {}),
    },
    practical,
    ...(show && Object.keys(show).length > 0 ? { show } : {}),
    ...(museum && Object.keys(museum).length > 0 ? { museum } : {}),
    provenance: provenanceOf(cluster),
    verified: verification.verified,
    planonmap: {
      dedupeKey: dedupeKey({ title: card.titulo.es, startDate, venue: cluster.venue }),
      mergeHint: mergeHint(scored.temporality, cluster.sources),
    },
    ...(input.locked ? { locked: true } : {}),
  }
}

/**
 * Ensambla el `CuratedEvent` completo y lo VALIDA. Fallar aquí es barato; fallar
 * en la publicación, no.
 *
 * El convenio bilingüe (§6.5): los campos planos llevan el ESPAÑOL,
 * `contentLang: 'es'`, y `i18n` lleva `es` y `en`. El catalán se deja ausente a
 * propósito: la interfaz de planonmap cae al español, que es su idioma por
 * defecto, y añadir una tercera versión subiría el coste un 40 % para un público
 * que no es el destinatario de esta guía.
 */
export function assembleCuratedEvent(input: AssembleInput): CuratedEvent {
  const { scored, verification, slug } = input
  const cluster = scored.cluster
  const card = verification.card
  const collection: CuratedCollection = cluster.collection

  const window = collection === 'museums' ? museumWindow(input.now) : null
  const startDate = window?.startDate ?? cluster.startDate
  if (!startDate) throw new Error(`assemble: ${slug} sin startDate`)
  const endDate = window?.endDate ?? cluster.endDate

  const event: CuratedEvent = {
    id: curatedId(collection, slug),
    source: 'curated',
    sourceId: slug,
    sourceUrl: cluster.officialUrl ?? cluster.sources[0]?.url ?? '',
    ...(cluster.officialUrl ? { officialUrl: cluster.officialUrl } : {}),
    ...(cluster.ticketsUrl ? { ticketsUrl: cluster.ticketsUrl } : {}),
    contentLang: 'es',
    title: card.titulo.es,
    description: card.resumen.es,
    ...(input.image
      ? { image: input.image.url, imageSource: 'venue' as const, imageCredit: input.image.credit }
      : {}),
    ...(card.publico ? { audience: card.publico.slice(0, 20) } : {}),
    startDate,
    ...(endDate ? { endDate } : {}),
    // El horario solo se publica si pasó la verificación: sin evidencia, se
    // omite en lugar de inventarse.
    ...(verification.verified.schedule && cluster.schedule.length > 0
      ? { schedule: [...cluster.schedule] }
      : {}),
    venue: cluster.venue,
    category: cluster.category,
    price: cluster.price,
    tags: deriveTags(card.titulo.es, cluster.category, cluster.venue.neighborhood),
    i18n: {
      title: { es: card.titulo.es, ...(card.titulo.en ? { en: card.titulo.en } : {}) },
      description: {
        es: card.resumen.es,
        ...(card.resumen.en ? { en: card.resumen.en } : {}),
      },
    },
    curated: buildCurated(input),
  }

  return CuratedEventSchema.parse(event)
}
