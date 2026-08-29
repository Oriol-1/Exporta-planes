// src/store/content.ts
// La zona PRODUCTO: fichas, archivo, vetos y propuestas. Es lo caro y lo
// revisado; perderlo es volver a pagar y a revisar (§3.3).
import { basename } from 'node:path'
import { CuratedEventSchema, type CuratedEvent, type CuratedCollection } from '../../contracts/curated'
import type { ProposalManifest, VetoEntry } from '../types'
import {
  ARCHIVE_DIR,
  archiveFile,
  cardFile,
  cardsDir,
  proposalFile,
  VETOED_FILE,
  ALL_COLLECTIONS,
} from './paths'
import {
  ensureDir,
  exists,
  listJsonFiles,
  moveFile,
  readJson,
  removeFile,
  writeJson,
} from './fs'

export interface LoadedCard {
  readonly collection: CuratedCollection
  readonly slug: string
  readonly event: CuratedEvent
}

export interface InvalidCard {
  readonly collection: CuratedCollection
  readonly slug: string
  readonly problem: string
}

export interface CardLoadResult {
  readonly cards: readonly LoadedCard[]
  readonly invalid: readonly InvalidCard[]
}

/**
 * Lee todas las fichas de una colección. Una ficha inválida NO tumba la lectura:
 * se registra y se excluye (§9.2, paso 3). El resto se publica.
 */
export async function readCards(collection: CuratedCollection): Promise<CardLoadResult> {
  const cards: LoadedCard[] = []
  const invalid: InvalidCard[] = []

  for (const name of await listJsonFiles(cardsDir(collection))) {
    const slug = basename(name, '.json')
    const raw = await readJson<unknown>(cardFile(collection, slug))
    if (raw === null) {
      invalid.push({ collection, slug, problem: 'JSON ilegible o vacío' })
      continue
    }
    const parsed = CuratedEventSchema.safeParse(raw)
    if (!parsed.success) {
      invalid.push({
        collection,
        slug,
        problem: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' · '),
      })
      continue
    }
    if (parsed.data.curated.slug !== slug) {
      invalid.push({
        collection,
        slug,
        problem: `el slug del archivo (${slug}) no coincide con curated.slug (${parsed.data.curated.slug})`,
      })
      continue
    }
    cards.push({ collection, slug, event: parsed.data })
  }

  return { cards, invalid }
}

export async function readAllCards(): Promise<CardLoadResult> {
  const cards: LoadedCard[] = []
  const invalid: InvalidCard[] = []
  for (const collection of ALL_COLLECTIONS) {
    const r = await readCards(collection)
    cards.push(...r.cards)
    invalid.push(...r.invalid)
  }
  return { cards, invalid }
}

export async function readCard(
  collection: CuratedCollection,
  slug: string,
): Promise<CuratedEvent | null> {
  const raw = await readJson<unknown>(cardFile(collection, slug))
  if (raw === null) return null
  const parsed = CuratedEventSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function cardExists(collection: CuratedCollection, slug: string): Promise<boolean> {
  return Promise.resolve(exists(cardFile(collection, slug)))
}

/** Escribe una ficha. Valida ANTES de tocar el disco: fallar pronto es barato. */
export async function writeCard(event: CuratedEvent): Promise<void> {
  const parsed = CuratedEventSchema.parse(event)
  await ensureDir(cardsDir(parsed.curated.collection))
  await writeJson(cardFile(parsed.curated.collection, parsed.curated.slug), parsed)
}

/**
 * Archivado, NO borrado (§3.7). Si el montaje vuelve la temporada siguiente se
 * reactiva sin volver a pagar la redacción: solo se actualizan fechas y precio,
 * que es extracción determinista.
 */
export async function archiveCard(
  collection: CuratedCollection,
  slug: string,
): Promise<boolean> {
  const from = cardFile(collection, slug)
  if (!exists(from)) return false
  await moveFile(from, archiveFile(slug))
  return true
}

export async function readArchived(slug: string): Promise<CuratedEvent | null> {
  const raw = await readJson<unknown>(archiveFile(slug))
  if (raw === null) return null
  const parsed = CuratedEventSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Devuelve una ficha archivada a su colección, sin volver a pagar la redacción. */
export async function restoreCard(slug: string, collection: CuratedCollection): Promise<boolean> {
  const from = archiveFile(slug)
  if (!exists(from)) return false
  await moveFile(from, cardFile(collection, slug))
  return true
}

export async function listArchivedSlugs(): Promise<string[]> {
  return (await listJsonFiles(ARCHIVE_DIR)).map((n) => basename(n, '.json'))
}

export async function deleteCard(collection: CuratedCollection, slug: string): Promise<void> {
  await removeFile(cardFile(collection, slug))
}

// ── Vetos ───────────────────────────────────────────────────────────────────

export async function readVetoes(): Promise<VetoEntry[]> {
  return (await readJson<VetoEntry[]>(VETOED_FILE)) ?? []
}

export async function isVetoed(slug: string): Promise<boolean> {
  return (await readVetoes()).some((v) => v.slug === slug)
}

/**
 * Añade un veto. Es para siempre, salvo que se borre la entrada a mano. Guarda
 * el motivo para que dentro de seis meses se sepa por qué (§3.7).
 */
export async function addVeto(entry: VetoEntry): Promise<void> {
  const vetoes = await readVetoes()
  if (vetoes.some((v) => v.slug === entry.slug)) return
  vetoes.push(entry)
  vetoes.sort((a, b) => a.slug.localeCompare(b.slug))
  await writeJson(VETOED_FILE, vetoes)
}

export async function removeVeto(slug: string): Promise<boolean> {
  const vetoes = await readVetoes()
  const next = vetoes.filter((v) => v.slug !== slug)
  if (next.length === vetoes.length) return false
  await writeJson(VETOED_FILE, next)
  return true
}

// ── Manifiesto de propuestas (§10.1) ────────────────────────────────────────

/**
 * El manifiesto es la corrección clave respecto al primer diseño, que deducía lo
 * vetado leyendo el cuerpo del PR. Un archivo versionado no se puede editar por
 * accidente ni interpretar mal: la reconciliación es una resta trivial.
 */
export async function writeManifest(manifest: ProposalManifest): Promise<void> {
  await writeJson(proposalFile(manifest.date), manifest)
}

export async function readManifest(date: string): Promise<ProposalManifest | null> {
  return await readJson<ProposalManifest>(proposalFile(date))
}
