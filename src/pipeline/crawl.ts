// src/pipeline/crawl.ts
// Orquesta la etapa 1 del embudo: de 12 fuentes a ~40 candidatos (§3.9).
//
// (`src/pipeline/` no aparece en el árbol del §3.4 porque el plan define el
// contrato de cada módulo, no cómo se cosen. Aquí se cosen, y en ningún otro
// sitio: `crawl/`, `normalize/` y `cluster/` siguen sin conocerse entre sí.)
import type { LoadedConfig, SourceConfig } from '../../config/index'
import type { CuratedCollection } from '../../contracts/curated'
import type { Candidate, IndexEntry } from '../types'
import { Fetcher } from '../crawl/fetcher'
import { discover } from '../crawl/discover'
import { adapterFor } from '../crawl/adapters'
import { emptyFieldRate, extractAll } from '../crawl/extract'
import { toCandidate } from '../normalize/toCandidate'
import { geocode } from '../normalize/geo'
import { readIndex, writeIndex } from '../store/cache'
import { madridDayString, addDays } from '../core/clock'
import { bytesHash } from '../core/hash'
import type { RunObservation } from '../report/health'

export interface CrawlOptions {
  readonly config: LoadedConfig
  readonly fetcher: Fetcher
  readonly now: Date
  readonly collections: readonly CuratedCollection[]
  /** Fuentes marcadas `blocked`, `paused` o `disabled` en la salud. */
  readonly skipSources: ReadonlySet<string>
  readonly limit?: number | undefined
}

export interface CrawlResult {
  readonly candidates: readonly Candidate[]
  readonly observations: readonly RunObservation[]
  readonly discovered: number
  readonly fetched: number
  readonly notModified: number
  readonly skipped: readonly string[]
  readonly notes: readonly string[]
}

/** Cuándo se rastreó esta fuente por última vez. Sin dato: los últimos 30 días. */
function lastSeenOf(index: ReadonlyMap<string, IndexEntry>, now: Date): Date {
  let latest: string | null = null
  for (const entry of index.values()) {
    if (latest === null || entry.lastSeen > latest) latest = entry.lastSeen
  }
  return latest ? new Date(latest) : addDays(now, -30)
}

/**
 * Rastrea una fuente. Ninguna situación de error puede empeorar lo ya publicado
 * (§4.4): si algo falla, se anota y se sigue con la siguiente URL.
 */
async function crawlSource(
  source: SourceConfig,
  opts: CrawlOptions,
): Promise<{
  candidates: Candidate[]
  observation: RunObservation
  discovered: number
  fetched: number
  notModified: number
  notes: string[]
}> {
  const notes: string[] = []
  const candidates: Candidate[] = []
  const adapter = adapterFor(source.id)
  const index = await readIndex(source.id)
  const since = lastSeenOf(index, opts.now)
  const today = madridDayString(opts.now)

  const discovery = await discover(opts.fetcher, source, since)
  notes.push(...discovery.notes.map((n) => `[${source.id}] ${n}`))

  let fetched = 0
  let notModified = 0
  let extracted = 0
  let emptyRateSum = 0
  let emptyRateCount = 0
  let lastError: string | undefined

  for (const found of discovery.urls) {
    if (opts.limit !== undefined && candidates.length >= opts.limit) break
    if (adapter && !adapter.isDetailUrl(found.url)) continue

    const collection = adapter?.collectionOf(found.url) ?? null
    if (!collection || !opts.collections.includes(collection)) continue

    const known = index.get(found.url)
    const result = await opts.fetcher.get(found.url, source, {
      etag: known?.etag,
      lastModified: known?.lastModified,
    })

    if (!result.ok) {
      if (result.error.kind === 'dead') {
        // La ficha está muerta: se marca y se retira de la próxima publicación.
        index.set(found.url, {
          ...(known ?? {
            url: found.url,
            sourceId: source.id,
            firstSeen: opts.now.toISOString(),
          }),
          url: found.url,
          sourceId: source.id,
          lastSeen: opts.now.toISOString(),
          lastStatus: result.error.status,
          verdict: 'dead',
        })
      } else if (result.error.kind === 'quota-exceeded') {
        notes.push(`[${source.id}] tope diario de ${source.maxPagesPerDay} páginas alcanzado`)
        break
      } else if (result.error.kind === 'blocked' || result.error.kind === 'rate-limited') {
        lastError = result.error.kind
        notes.push(`[${source.id}] ${result.error.kind}: se deja de rastrear esta ejecución`)
        break
      } else if (result.error.kind !== 'offline') {
        lastError = 'message' in result.error ? result.error.message : result.error.kind
      }
      continue
    }

    const outcome = result.value

    if (outcome.notModified || outcome.body === null) {
      notModified++
      if (known) {
        index.set(found.url, { ...known, lastSeen: outcome.fetchedAt, lastStatus: 304 })
      }
      continue
    }

    fetched++

    // Hash de bytes: ETag propio para saltarse el PARSEO cuando el servidor no
    // manda ETag. Ahorra CPU, no dinero — no confundir con el semanticHash.
    const bodyHash = bytesHash(outcome.body)
    if (known?.etag === bodyHash) {
      notModified++
      index.set(found.url, { ...known, lastSeen: outcome.fetchedAt, lastStatus: 200 })
      continue
    }

    let extraction
    try {
      extraction = extractAll(outcome.body, adapter?.selectors)
    } catch (e) {
      // Una excepción al parsear descarta esa página y el resto continúa.
      notes.push(`[${source.id}] parseo fallido en ${found.url}: ${String(e)}`)
      continue
    }

    if (!extraction.extract) {
      index.set(found.url, {
        url: found.url,
        sourceId: source.id,
        etag: outcome.etag ?? bodyHash,
        lastModified: outcome.lastModified,
        firstSeen: known?.firstSeen ?? outcome.fetchedAt,
        lastSeen: outcome.fetchedAt,
        lastStatus: outcome.status,
        verdict: 'rejected',
        rejectReason: 'sin datos extraíbles',
      })
      continue
    }

    extracted++
    emptyRateSum += emptyFieldRate(extraction.extract)
    emptyRateCount++

    // Geocodificación solo si hace falta: una dirección se resuelve una vez en
    // la vida, y Nominatim es cortesía de la comunidad, no un derecho (§7.1).
    let coords: { lat: number; lng: number } | undefined
    if (extraction.extract.lat === undefined && extraction.extract.address) {
      const point = await geocode(opts.fetcher, extraction.extract.address, opts.now)
      if (point) coords = { lat: point.lat, lng: point.lng }
    }

    const normalized = toCandidate({
      extract: extraction.extract,
      url: found.url,
      source,
      collection,
      retrievedAt: outcome.fetchedAt,
      now: opts.now,
      coords,
    })

    index.set(found.url, {
      url: found.url,
      sourceId: source.id,
      etag: outcome.etag ?? bodyHash,
      lastModified: outcome.lastModified,
      firstSeen: known?.firstSeen ?? outcome.fetchedAt,
      lastSeen: outcome.fetchedAt,
      lastStatus: outcome.status,
      verdict: normalized.ok ? 'candidate' : 'rejected',
      ...(normalized.ok ? {} : { rejectReason: normalized.reason }),
    })

    if (normalized.ok) candidates.push(normalized.candidate)
  }

  await writeIndex(source.id, index)

  return {
    candidates,
    observation: {
      sourceId: source.id,
      extracted,
      emptyFieldRate: emptyRateCount === 0 ? 0 : emptyRateSum / emptyRateCount,
      ...(lastError ? { error: lastError } : {}),
    },
    discovered: discovery.urls.length,
    fetched,
    notModified,
    notes: [...notes, `[${source.id}] ${today}: ${fetched} descargadas, ${notModified} sin cambios`],
  }
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  const candidates: Candidate[] = []
  const observations: RunObservation[] = []
  const notes: string[] = []
  const skipped: string[] = []
  let discovered = 0
  let fetched = 0
  let notModified = 0

  for (const source of opts.config.activeSources) {
    if (opts.skipSources.has(source.id)) {
      skipped.push(source.id)
      continue
    }
    if (!source.collections.some((c) => opts.collections.includes(c))) continue

    const result = await crawlSource(source, opts)
    candidates.push(...result.candidates)
    observations.push(result.observation)
    notes.push(...result.notes)
    discovered += result.discovered
    fetched += result.fetched
    notModified += result.notModified
  }

  return { candidates, observations, discovered, fetched, notModified, skipped, notes }
}
