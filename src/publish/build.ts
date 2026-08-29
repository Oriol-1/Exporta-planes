// src/publish/build.ts
// Lee `content/cards/`, aplica los vetos, archiva lo caducado, valida CADA
// elemento contra el esquema Zod completo y escribe `dist/v1/*.json` más el
// `index.json` con las sumas (§9.2).
//
// La guarda que hereda de planonmap y que es innegociable: UN REFRESCO POBRE
// NUNCA DEGRADA LO PUBLICADO. Si un solo elemento no valida, se excluye ese
// elemento y el resto se publica; si fallan más del 20 % de una colección, NO se
// publica esa colección y se conserva la anterior.
import { CollectionFileSchema, IndexFileSchema, assertCoherent, type CollectionFile, type IndexFile } from '../../contracts/output'
import type { CuratedCollection, CuratedEvent } from '../../contracts/curated'
import { ALL_COLLECTIONS, DIST_INDEX_FILE, DIST_V1_DIR, distCollectionFile } from '../store/paths'
import { ensureDir, writeText } from '../store/fs'
import { archiveCard, readCards, readVetoes, type InvalidCard } from '../store/content'
import { isActive } from '../normalize/dates'
import { serialize } from './checksums'

export const LICENSE = 'CC-BY-4.0'
export const SCHEMA_VERSION = 1

/** Umbral de degradación: por encima, la colección entera se conserva (§9.2). */
export const MAX_INVALID_FRACTION = 0.2

export interface CollectionReport {
  readonly collection: CuratedCollection
  readonly published: number
  readonly excluded: readonly InvalidCard[]
  readonly archived: readonly string[]
  readonly vetoed: readonly string[]
  /** `true` si se conservó lo anterior por exceso de inválidos. */
  readonly heldBack: boolean
  readonly sha256?: string | undefined
  readonly bytes?: number | undefined
}

export interface BuildReport {
  readonly generatedAt: string
  readonly baseUrl: string
  readonly collections: readonly CollectionReport[]
  readonly index: IndexFile | null
  readonly totalItems: number
}

export interface BuildOptions {
  readonly now: Date
  readonly nowIso: string
  readonly baseUrl: string
  readonly producerVersion: string
  /** En seco no se escribe nada: solo se informa de qué se publicaría. */
  readonly dryRun?: boolean | undefined
  /** Archivar lo caducado modifica `content/`: solo lo hace el ciclo de curación. */
  readonly archiveExpired?: boolean | undefined
}

function collectionUrl(baseUrl: string, collection: CuratedCollection): string {
  return `${baseUrl.replace(/\/$/, '')}/v1/${collection}.json`
}

/**
 * Construye las tres colecciones y el índice.
 *
 * `dist/` NO se commitea: se sube como artefacto de Pages (§9.2). `content/` es
 * el producto; `dist/` es una proyección. Tener las dos versionadas invitaría a
 * que divergieran.
 */
export async function build(opts: BuildOptions): Promise<BuildReport> {
  const vetoedSlugs = new Set((await readVetoes()).map((v) => v.slug))
  const reports: CollectionReport[] = []
  const indexEntries: IndexFile['collections'][number][] = []
  let totalItems = 0

  if (!opts.dryRun) await ensureDir(DIST_V1_DIR)

  for (const collection of ALL_COLLECTIONS) {
    const { cards, invalid } = await readCards(collection)

    const vetoed: string[] = []
    const archived: string[] = []
    const items: CuratedEvent[] = []

    for (const card of cards) {
      if (vetoedSlugs.has(card.slug)) {
        vetoed.push(card.slug)
        continue
      }

      // Retirada automática de lo caducado por fecha. Los museos no caducan:
      // su ventana rueda en cada refresco (§8.5).
      const expired =
        collection !== 'museums' &&
        !isActive(card.event.startDate, card.event.endDate, opts.now)

      if (expired) {
        archived.push(card.slug)
        if (opts.archiveExpired && !opts.dryRun) {
          await archiveCard(collection, card.slug)
        }
        continue
      }

      items.push(card.event)
    }

    const considered = cards.length
    const invalidFraction = considered === 0 ? 0 : invalid.length / (considered + invalid.length)
    const heldBack = invalid.length > 0 && invalidFraction > MAX_INVALID_FRACTION

    // Una colección sin fichas todavía no se publica. «Ausente» significa
    // «todavía no se publica», no «está vacía» (§A.3).
    if (items.length === 0 || heldBack) {
      reports.push({
        collection,
        published: 0,
        excluded: invalid,
        archived,
        vetoed,
        heldBack,
      })
      continue
    }

    // Orden estable por slug: sin esto, cada build reordena el archivo y la
    // sha256 cambia sin que haya cambiado nada.
    items.sort((a, b) => a.curated.slug.localeCompare(b.curated.slug))

    const file: CollectionFile = CollectionFileSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      collection,
      generatedAt: opts.nowIso,
      count: items.length,
      license: LICENSE,
      items,
    })
    assertCoherent(file)

    const serialized = serialize(file)
    if (!opts.dryRun) {
      await writeText(distCollectionFile(collection), serialized.text)
    }

    totalItems += items.length
    indexEntries.push({
      name: collection,
      url: collectionUrl(opts.baseUrl, collection),
      count: items.length,
      generatedAt: opts.nowIso,
      sha256: serialized.sha256,
    })

    reports.push({
      collection,
      published: items.length,
      excluded: invalid,
      archived,
      vetoed,
      heldBack: false,
      sha256: serialized.sha256,
      bytes: serialized.bytes,
    })
  }

  let index: IndexFile | null = null
  if (indexEntries.length > 0) {
    index = IndexFileSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      producer: 'bcn-curator',
      producerVersion: opts.producerVersion,
      generatedAt: opts.nowIso,
      collections: indexEntries,
    })
    if (!opts.dryRun) {
      await writeText(DIST_INDEX_FILE, serialize(index).text)
    }
  }

  return {
    generatedAt: opts.nowIso,
    baseUrl: opts.baseUrl,
    collections: reports,
    index,
    totalItems,
  }
}

export function formatBuildReport(report: BuildReport): string {
  const lines = [`Publicación generada el ${report.generatedAt}`, '']
  for (const c of report.collections) {
    if (c.heldBack) {
      lines.push(
        `  ${c.collection.padEnd(8)} NO PUBLICADA · ${c.excluded.length} fichas inválidas ` +
          `(> ${MAX_INVALID_FRACTION * 100} %). Se conserva la versión anterior.`,
      )
      continue
    }
    if (c.published === 0) {
      lines.push(`  ${c.collection.padEnd(8)} sin fichas todavía: no se publica`)
      continue
    }
    lines.push(
      `  ${c.collection.padEnd(8)} ${String(c.published).padStart(3)} fichas · ` +
        `${((c.bytes ?? 0) / 1024).toFixed(0)} KB · sha256 ${c.sha256?.slice(0, 12)}…`,
    )
    if (c.vetoed.length > 0) lines.push(`             vetadas: ${c.vetoed.join(', ')}`)
    if (c.archived.length > 0) lines.push(`             archivadas: ${c.archived.join(', ')}`)
    for (const e of c.excluded) {
      lines.push(`             EXCLUIDA ${e.slug}: ${e.problem}`)
    }
  }
  lines.push('', `Total publicado: ${report.totalItems} fichas`)
  return lines.join('\n')
}
