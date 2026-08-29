// src/store/cache.ts
// La zona CACHÉ: índice de URL, decisiones, geocodificación, salud y lotes.
// Es DERIVADA: borrarla cuesta dinero y tiempo, pero se regenera sola. Se
// versiona en git a propósito —así sobrevive a los runners efímeros y se puede
// auditar y revertir— y `.gitattributes` la colapsa en el diff del PR (§3.3).
import type {
  Decision,
  IndexEntry,
  PendingBatch,
  SourceHealth,
  SpendLedger,
} from '../types'
import {
  decisionsFile,
  GEOCODE_FILE,
  indexFile,
  PENDING_BATCHES_FILE,
  QUEUE_FILE,
  ROBOTS_FILE,
  RUN_SUMMARY_FILE,
  SOURCES_HEALTH_FILE,
  spendFile,
  TRANSIT_FILE,
  clusterFile,
} from './paths'
import { appendNdjson, readJson, readNdjson, writeJson, writeNdjson, writeText } from './fs'

// ── Índice de URL vistas ────────────────────────────────────────────────────

export async function readIndex(sourceId: string): Promise<Map<string, IndexEntry>> {
  const rows = await readNdjson<IndexEntry>(indexFile(sourceId))
  return new Map(rows.map((r) => [r.url, r]))
}

/** Se reescribe ordenado por URL: cambian solo las líneas que cambian (§3.4). */
export async function writeIndex(
  sourceId: string,
  entries: ReadonlyMap<string, IndexEntry>,
): Promise<void> {
  await writeNdjson(indexFile(sourceId), [...entries.values()], (e) => e.url)
}

/** Páginas descargadas hoy de esta fuente, para respetar `maxPagesPerDay`. */
export function pagesFetchedOn(index: ReadonlyMap<string, IndexEntry>, day: string): number {
  let n = 0
  for (const e of index.values()) {
    if (e.lastSeen.slice(0, 10) === day && e.lastStatus !== 304) n++
  }
  return n
}

// ── Decisiones (la etiqueta de entrenamiento es gratis: §5.5) ───────────────

export async function appendDecisions(month: string, rows: readonly Decision[]): Promise<void> {
  await appendNdjson(decisionsFile(month), rows)
}

export async function readDecisions(month: string): Promise<Decision[]> {
  return await readNdjson<Decision>(decisionsFile(month))
}

// ── Geocodificación · caché PERMANENTE ──────────────────────────────────────
// Una dirección se resuelve una vez en la vida. Nominatim no es un plan
// gratuito con un contrato detrás: es un servicio comunitario con una política
// de uso razonable, y si se abusa bloquean por IP con todo el derecho (§7.1).

export interface GeoPoint {
  readonly lat: number
  readonly lng: number
  readonly resolvedAt: string
  readonly displayName?: string | undefined
}

export type GeocodeCache = Record<string, GeoPoint>

export async function readGeocodeCache(): Promise<GeocodeCache> {
  return (await readJson<GeocodeCache>(GEOCODE_FILE)) ?? {}
}

export async function writeGeocodeCache(cache: GeocodeCache): Promise<void> {
  await writeJson(GEOCODE_FILE, sortedKeys(cache))
}

// ── Paradas de transporte por coordenada ────────────────────────────────────

export type TransitCache = Record<string, readonly string[]>

export async function readTransitCache(): Promise<TransitCache> {
  return (await readJson<TransitCache>(TRANSIT_FILE)) ?? {}
}

export async function writeTransitCache(cache: TransitCache): Promise<void> {
  await writeJson(TRANSIT_FILE, sortedKeys(cache))
}

// ── robots.txt · una lectura por host, cacheada 24 h ────────────────────────

export interface RobotsEntry {
  readonly host: string
  readonly body: string
  readonly fetchedAt: string
  readonly status: number
}

export type RobotsCache = Record<string, RobotsEntry>

export async function readRobotsCache(): Promise<RobotsCache> {
  return (await readJson<RobotsCache>(ROBOTS_FILE)) ?? {}
}

export async function writeRobotsCache(cache: RobotsCache): Promise<void> {
  await writeJson(ROBOTS_FILE, sortedKeys(cache))
}

// ── Lotes pendientes · lo que une las dos fases del día (§7.2 ter) ──────────

export async function readPendingBatches(): Promise<PendingBatch[]> {
  return (await readJson<PendingBatch[]>(PENDING_BATCHES_FILE)) ?? []
}

export async function writePendingBatches(batches: readonly PendingBatch[]): Promise<void> {
  await writeJson(PENDING_BATCHES_FILE, batches)
}

export async function addPendingBatch(batch: PendingBatch): Promise<void> {
  const all = await readPendingBatches()
  await writePendingBatches([...all.filter((b) => b.id !== batch.id), batch])
}

export async function removePendingBatch(id: string): Promise<void> {
  const all = await readPendingBatches()
  await writePendingBatches(all.filter((b) => b.id !== id))
}

// ── Salud por fuente · lo escribe la máquina, NO es configuración (§3.5) ────

export type HealthCache = Record<string, SourceHealth>

export async function readHealth(): Promise<HealthCache> {
  return (await readJson<HealthCache>(SOURCES_HEALTH_FILE)) ?? {}
}

export async function writeHealth(health: HealthCache): Promise<void> {
  await writeJson(SOURCES_HEALTH_FILE, sortedKeys(health))
}

// ── Libro de gasto ──────────────────────────────────────────────────────────

export async function readLedger(month: string): Promise<SpendLedger | null> {
  return await readJson<SpendLedger>(spendFile(month))
}

export async function writeLedger(ledger: SpendLedger): Promise<void> {
  await writeJson(spendFile(ledger.month), ledger)
}

// ── Cola de lo que esperaba a la IA cuando se agotó el presupuesto (§7.6) ───

export interface QueuedItem {
  readonly clusterId: string
  readonly collection: string
  readonly slug: string
  readonly material: string
  readonly queuedAt: string
  readonly reason: string
}

export async function readQueue(): Promise<QueuedItem[]> {
  return (await readJson<QueuedItem[]>(QUEUE_FILE)) ?? []
}

export async function writeQueue(items: readonly QueuedItem[]): Promise<void> {
  await writeJson(QUEUE_FILE, items)
}

// ── Clusters ────────────────────────────────────────────────────────────────

export async function writeCluster(clusterId: string, cluster: unknown): Promise<void> {
  await writeJson(clusterFile(clusterId), cluster)
}

export async function readCluster<T>(clusterId: string): Promise<T | null> {
  return await readJson<T>(clusterFile(clusterId))
}

// ── Resumen de la ejecución · se lee en la pestaña del workflow ─────────────

export async function writeRunSummary(markdown: string): Promise<void> {
  await writeText(RUN_SUMMARY_FILE, markdown)
}

/** Claves ordenadas: sin esto, cada escritura reordena el JSON y ensucia el diff. */
function sortedKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {}
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k]
    if (v !== undefined) out[k] = v
  }
  return out
}
