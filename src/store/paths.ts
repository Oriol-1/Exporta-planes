// src/store/paths.ts
// TODAS las rutas del proyecto, en un solo sitio. Mover `.cache/` a otro lado
// algún día es cambiar este archivo y nada más.
import { join } from 'node:path'
import type { CuratedCollection } from '../../contracts/curated'

/** Raíz del repositorio. Los CLI se ejecutan desde ahí. */
export const ROOT = process.cwd()

// ── Zona PRODUCTO · el pipeline propone, la persona aprueba. No se pierde ────
export const CONTENT_DIR = join(ROOT, 'content')
export const CARDS_DIR = join(CONTENT_DIR, 'cards')
export const ARCHIVE_DIR = join(CONTENT_DIR, 'archive')
export const PROPOSALS_DIR = join(CONTENT_DIR, 'proposals')
export const VETOED_FILE = join(CONTENT_DIR, 'vetoed.json')

export function cardsDir(collection: CuratedCollection): string {
  return join(CARDS_DIR, collection)
}

export function cardFile(collection: CuratedCollection, slug: string): string {
  return join(cardsDir(collection), `${slug}.json`)
}

export function archiveFile(slug: string): string {
  return join(ARCHIVE_DIR, `${slug}.json`)
}

export function proposalFile(date: string): string {
  return join(PROPOSALS_DIR, `${date}.json`)
}

// ── Zona CONTRATO · solo cambia al versionar ────────────────────────────────
export const CONTRACTS_DIR = join(ROOT, 'contracts')
export const GOLDEN_FIXTURE = join(CONTRACTS_DIR, 'golden', 'curated-golden.json')

// ── Zona CACHÉ · solo la escribe la máquina. Borrarla no pierde nada ────────
export const CACHE_DIR = join(ROOT, '.cache')
export const INDEX_DIR = join(CACHE_DIR, 'index')
export const DECISIONS_DIR = join(CACHE_DIR, 'decisions')
export const CLUSTERS_DIR = join(CACHE_DIR, 'clusters')
export const SPEND_DIR = join(CACHE_DIR, 'spend')
export const GEOCODE_FILE = join(CACHE_DIR, 'geocode.json')
export const TRANSIT_FILE = join(CACHE_DIR, 'transit.json')
export const ROBOTS_FILE = join(CACHE_DIR, 'robots.json')
export const PENDING_BATCHES_FILE = join(CACHE_DIR, 'pending-batches.json')
export const SOURCES_HEALTH_FILE = join(CACHE_DIR, 'sources-health.json')
export const QUEUE_FILE = join(CACHE_DIR, 'queue.json')
export const RUN_SUMMARY_FILE = join(CACHE_DIR, 'last-run-summary.md')
export const WEEKLY_REPORT_FILE = join(CACHE_DIR, 'weekly-report.md')

export function indexFile(sourceId: string): string {
  return join(INDEX_DIR, `${sourceId}.ndjson`)
}

export function decisionsFile(month: string): string {
  return join(DECISIONS_DIR, `${month}.ndjson`)
}

export function clusterFile(clusterId: string): string {
  return join(CLUSTERS_DIR, `${clusterId}.json`)
}

export function spendFile(month: string): string {
  return join(SPEND_DIR, `${month}.json`)
}

// ── SALIDA · derivada de content/. NO se versiona (§9.2) ────────────────────
export const DIST_DIR = join(ROOT, 'dist')
export const DIST_V1_DIR = join(DIST_DIR, 'v1')

export function distCollectionFile(collection: CuratedCollection): string {
  return join(DIST_V1_DIR, `${collection}.json`)
}

export const DIST_INDEX_FILE = join(DIST_V1_DIR, 'index.json')

// ── EVALUACIONES ────────────────────────────────────────────────────────────
export const EVALS_DIR = join(ROOT, 'evals')
export const EVAL_SCREEN_GOLDEN = join(EVALS_DIR, 'screen', 'golden.jsonl')
export const EVAL_WRITE_GOLDEN = join(EVALS_DIR, 'write', 'golden.jsonl')

export function evalReportFile(task: 'screen' | 'write'): string {
  return join(EVALS_DIR, task, 'report.md')
}

export const ALL_COLLECTIONS: readonly CuratedCollection[] = ['plans', 'shows', 'museums']
