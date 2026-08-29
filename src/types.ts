// src/types.ts
// Los tipos internos del pipeline. NO son el contrato: el contrato vive en
// contracts/ y es lo que se publica. Estos son los estados intermedios entre
// «una URL» y «un CuratedEvent».
import type { Category, Price, ScheduleSlot, Venue } from '../contracts/event'
import type { CuratedCollection, Provenance } from '../contracts/curated'
import type { Tier } from '../config/schema'

// ── 1 · RASTREO ──────────────────────────────────────────────────────────────

/** Lo que devuelve el fetcher: cuerpo, cabeceras de caché y qué pasó. */
export interface FetchOutcome {
  readonly url: string
  readonly status: number
  readonly body: string | null
  readonly etag?: string | undefined
  readonly lastModified?: string | undefined
  /** `true` si el servidor respondió 304: no hay cuerpo y no hay que parsear. */
  readonly notModified: boolean
  readonly fetchedAt: string
}

/** Una línea de `.cache/index/<fuente>.ndjson`. Una URL vista alguna vez. */
export interface IndexEntry {
  readonly url: string
  readonly sourceId: string
  readonly etag?: string | undefined
  readonly lastModified?: string | undefined
  /** Hash sobre los campos extraídos, NUNCA sobre los bytes (§5.2). */
  readonly semanticHash?: string | undefined
  readonly firstSeen: string
  readonly lastSeen: string
  readonly lastStatus: number
  /** Veredicto de la última vez que se evaluó, para no repetirlo. */
  readonly verdict?: 'candidate' | 'rejected' | 'promoted' | 'dead' | undefined
  readonly rejectReason?: string | undefined
}

/** Lo que sale de un extractor, antes de normalizar. Todo opcional: es crudo. */
export interface RawExtract {
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly startDate?: string | undefined
  readonly endDate?: string | undefined
  readonly image?: string | undefined
  readonly url?: string | undefined
  readonly priceText?: string | undefined
  readonly offers?: unknown
  readonly location?: unknown
  readonly openingHours?: unknown
  readonly scheduleLines?: readonly string[] | undefined
  readonly officialUrl?: string | undefined
  readonly ticketsUrl?: string | undefined
  readonly venueName?: string | undefined
  readonly address?: string | undefined
  readonly lat?: number | undefined
  readonly lng?: number | undefined
  /** Texto útil de la página, ya sin etiquetas. Es el material de redacción. */
  readonly bodyText?: string | undefined
  /** Qué extractor lo produjo: jsonld > opengraph > selectors. */
  readonly via: 'jsonld' | 'opengraph' | 'selectors'
}

// ── 2 · CANDIDATOS ───────────────────────────────────────────────────────────

/** Confianza en la hora: 'exact' si la fuente la publicó, 'day' si es 00:00. */
export type TimeConfidence = 'exact' | 'day'

/** Un `Event` incompleto más metadatos de procedencia. */
export interface Candidate {
  readonly sourceId: string
  readonly tier: Tier
  readonly trust: number
  readonly url: string
  readonly collection: CuratedCollection
  readonly title: string
  readonly description: string
  readonly startDate?: string | undefined
  readonly endDate?: string | undefined
  readonly timeConfidence: TimeConfidence
  readonly schedule: readonly ScheduleSlot[]
  readonly venue: Venue
  readonly category: Category
  readonly price: Price
  readonly priceTexts: readonly string[]
  readonly officialUrl?: string | undefined
  readonly ticketsUrl?: string | undefined
  readonly image?: string | undefined
  readonly bodyText: string
  readonly retrievedAt: string
  /** Un museo del catálogo trae su slug ya decidido; el resto se derivan. */
  readonly seedSlug?: string | undefined
}

// ── 3 · AGRUPACIÓN ───────────────────────────────────────────────────────────

export interface SourceRef {
  readonly id: string
  readonly tier: Tier
  readonly trust: number
  readonly url: string
  readonly retrievedAt: string
}

/** El mismo plan visto en varias webs: un solo cluster (§4.8). */
export interface Cluster {
  readonly clusterId: string
  readonly collection: CuratedCollection
  readonly title: string
  readonly titles: readonly string[]
  readonly description: string
  readonly sources: readonly SourceRef[]
  readonly startDate?: string | undefined
  readonly endDate?: string | undefined
  readonly timeConfidence: TimeConfidence
  readonly dateSummary: string
  readonly schedule: readonly ScheduleSlot[]
  readonly scheduleLines: readonly string[]
  readonly venue: Venue
  readonly category: Category
  readonly price: Price
  readonly priceTexts: readonly string[]
  readonly officialUrl?: string | undefined
  readonly ticketsUrl?: string | undefined
  readonly image?: string | undefined
  /** Paradas de transporte a menos de 500 m, de OSM. Dato objetivo y gratis. */
  readonly transitHints: readonly string[]
  readonly extracts: readonly { readonly url: string; readonly text: string }[]
  readonly planonmapDedupeKey: string
  readonly semanticHash: string
  readonly firstSeen: string
  readonly seedSlug?: string | undefined
}

// ── 4 · CRIBADO ──────────────────────────────────────────────────────────────

export interface DeterministicScore {
  readonly consensus: number
  readonly completeness: number
  readonly freshness: number
  readonly reputation: number
  readonly total: number
}

/** Lo que devuelve el modelo de cribado, por candidato (§5.3). */
export interface ScreenVerdict {
  readonly id: string
  readonly vale_el_viaje: number
  readonly caracteristico_bcn: number
  readonly sin_barrera_idioma: number
  readonly no_trampa_turistica: number
  readonly es_trampa_turistica: boolean
  readonly es_generico_europeo: boolean
  readonly requiere_ser_local: boolean
  readonly es_marca_disfrazada: boolean
  readonly temporalidad: 'atemporal' | 'temporada'
  readonly motivo: string
}

export interface ScoredCluster {
  readonly cluster: Cluster
  readonly deterministic: DeterministicScore
  readonly verdict?: ScreenVerdict | undefined
  readonly llmPoints: number
  readonly total: number
  readonly vetoed: boolean
  readonly vetoReason?: string | undefined
  readonly temporality: 'atemporal' | 'temporada'
}

/** Una línea de `.cache/decisions/<año-mes>.ndjson` (§5.5). */
export interface Decision {
  readonly at: string
  readonly clusterId: string
  readonly collection: CuratedCollection
  readonly stage: 'prefilter' | 'screen' | 'select' | 'write'
  readonly outcome: 'passed' | 'rejected'
  readonly reason: string
  readonly score?: number | undefined
  readonly deterministic?: DeterministicScore | undefined
  readonly verdict?: ScreenVerdict | undefined
  readonly model?: string | undefined
  readonly promptVersion?: string | undefined
  readonly inputTokens?: number | undefined
  readonly outputTokens?: number | undefined
}

// ── 5 · REDACCIÓN ────────────────────────────────────────────────────────────

export interface Bilingual {
  readonly es: string
  readonly en: string
}

/** La salida cruda del redactor, antes de verificar evidencias (§6.3). */
export interface WrittenCard {
  readonly slug: string
  readonly titulo: Bilingual
  readonly resumen: Bilingual
  readonly porQueMerecePena: Bilingual
  readonly comoLlegar?: Partial<Bilingual> | undefined
  readonly queIncluye?: Partial<Bilingual> | undefined
  readonly duracionMin?: number | undefined
  readonly reserva?: 'ninguna' | 'recomendada' | 'obligatoria' | undefined
  readonly reservaDiasAntelacion?: number | undefined
  readonly publico?: 'todos' | 'familiar' | 'adultos' | 'mayores' | undefined
  readonly idiomaActividad?: readonly ('ca' | 'es' | 'en' | 'sin-idioma')[] | undefined
  readonly museo?:
    | {
        readonly horarios?: readonly { readonly dias: string; readonly horas: string }[] | undefined
        readonly gratuidades?: readonly string[] | undefined
        readonly exposicionVigente?:
          | { readonly titulo: string; readonly hasta: string }
          | undefined
        readonly minutosVisita?: number | undefined
        readonly entradaAnticipada?: boolean | undefined
      }
    | undefined
  readonly espectaculo?:
    | {
        readonly artistaCompania?: string | undefined
        readonly sala?: string | undefined
        readonly sobretitulos?: readonly ('ca' | 'es' | 'en')[] | undefined
      }
    | undefined
  readonly evidencias: readonly { readonly campo: string; readonly fragmento: string }[]
}

/** Resultado de la verificación mecánica. Sin IA, gratis y despiadada (§6.4). */
export interface VerificationResult {
  readonly card: WrittenCard
  readonly verified: {
    readonly price: boolean
    readonly schedule: boolean
    readonly dates: boolean
    readonly location: boolean
    readonly method: string
  }
  readonly droppedFields: readonly string[]
  /** `true` si falló uno de los cuatro campos que hacen útil la ficha. */
  readonly discarded: boolean
  readonly discardReason?: string | undefined
  readonly needsHuman: boolean
  readonly needsHumanReason?: string | undefined
}

// ── 6 · ESTADO Y SALUD ───────────────────────────────────────────────────────

export type SourceHealthStatus = 'ok' | 'degraded' | 'paused' | 'blocked' | 'disabled'

/** Lo escribe la máquina en `.cache/sources-health.json`. NO es configuración. */
export interface SourceHealth {
  readonly id: string
  readonly status: SourceHealthStatus
  /** Mediana de elementos válidos extraídos en los últimos 7 días (§4.6). */
  readonly medianExtracted: number
  readonly recentExtracted: readonly number[]
  readonly emptyFieldRate: number
  readonly consecutiveDegradedDays: number
  readonly pausedUntil?: string | undefined
  readonly lastRunAt?: string | undefined
  readonly lastError?: string | undefined
  /** `trust` efectivo tras el ajuste por aprobación editorial (§5.5). */
  readonly effectiveTrust?: number | undefined
  readonly issueNumber?: number | undefined
}

/** Un lote enviado y aún no recogido (§7.2 ter). */
export interface PendingBatch {
  readonly id: string
  readonly provider: 'anthropic' | 'openai'
  readonly task: 'write'
  readonly model: string
  readonly submittedAt: string
  readonly expiresAt: string
  readonly customIds: readonly string[]
  readonly estimatedEur: number
}

/** Una llamada apuntada en el libro de gasto. */
export interface SpendCall {
  readonly at: string
  readonly model: string
  readonly task: 'screen' | 'write'
  readonly inputTokens: number
  readonly outputTokens: number
  readonly eur: number
  readonly batchId?: string | undefined
  /** `true` mientras es una estimación de un lote en vuelo (§7.6). */
  readonly pending?: boolean | undefined
}

export interface SpendLedger {
  readonly month: string
  readonly budgetEur: number
  readonly spentEur: number
  readonly byModel: Readonly<Record<string, number>>
  readonly calls: readonly SpendCall[]
  readonly warnedAt70?: string | undefined
  readonly exhaustedAt?: string | undefined
}

/** Un slug vetado. Es para siempre, salvo que se borre a mano (§3.7). */
export interface VetoEntry {
  readonly slug: string
  readonly collection: CuratedCollection
  readonly date: string
  readonly reason: string
}

/** El manifiesto del día: propuesto menos presente = vetado (§10.1). */
export interface ProposalManifest {
  readonly date: string
  readonly promptVersion: string
  readonly runCostEur: number
  readonly proposed: readonly {
    readonly slug: string
    readonly collection: CuratedCollection
    readonly kind: 'new' | 'modified'
    readonly score: number
  }[]
  readonly discarded: readonly { readonly slug: string; readonly reason: string }[]
}

export type { Provenance }
