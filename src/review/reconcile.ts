// src/review/reconcile.ts
// Tras el merge: manifiesto contra lo publicado → vetos (§10.1).
//
// Convierte «esta ficha no está en el merge» en un veto registrado. Es lo que
// hace que borrar un archivo desde la interfaz web del PR sea un acto editorial
// con memoria, y no un gesto que se olvida al día siguiente —y que se vuelve a
// pagar.
import type { ProposalManifest, VetoEntry } from '../types'
import { addVeto, cardExists, readManifest } from '../store/content'
import { computeVetoes } from './manifest'
import { listJsonFiles } from '../store/fs'
import { PROPOSALS_DIR } from '../store/paths'
import { basename } from 'node:path'

export interface ReconcileInput {
  readonly date: string
  readonly merged: boolean
  readonly today: string
}

export interface ReconcileReport {
  readonly manifestFound: boolean
  readonly proposed: number
  readonly kept: readonly string[]
  readonly vetoed: readonly VetoEntry[]
}

/**
 * Compara el manifiesto de una fecha con lo que realmente quedó en
 * `content/cards/`.
 *
 * Si el PR se CERRÓ SIN MERGEAR, todos los slugs del manifiesto quedan vetados:
 * el propietario dijo que no a todo, y esa decisión también hay que recordarla.
 */
export async function reconcile(input: ReconcileInput): Promise<ReconcileReport> {
  const manifest = await readManifest(input.date)
  if (!manifest) {
    return { manifestFound: false, proposed: 0, kept: [], vetoed: [] }
  }

  if (!input.merged) {
    const vetoed = await vetoAll(manifest, input.today, 'pr-cerrado-sin-mergear')
    return { manifestFound: true, proposed: manifest.proposed.length, kept: [], vetoed }
  }

  const present = new Set<string>()
  for (const p of manifest.proposed) {
    if (await cardExists(p.collection, p.slug)) present.add(p.slug)
  }

  const missing = computeVetoes(manifest, present)
  const vetoed: VetoEntry[] = []

  for (const m of missing) {
    const entry: VetoEntry = {
      slug: m.slug,
      collection: m.collection,
      date: input.today,
      reason: 'veto-manual',
    }
    await addVeto(entry)
    vetoed.push(entry)
  }

  return {
    manifestFound: true,
    proposed: manifest.proposed.length,
    kept: [...present],
    vetoed,
  }
}

async function vetoAll(
  manifest: ProposalManifest,
  today: string,
  reason: string,
): Promise<VetoEntry[]> {
  const out: VetoEntry[] = []
  for (const p of manifest.proposed) {
    const entry: VetoEntry = {
      slug: p.slug,
      collection: p.collection,
      date: today,
      reason,
    }
    await addVeto(entry)
    out.push(entry)
  }
  return out
}

/**
 * Manifiestos sin reconciliar: los que proponen slugs que no están ni
 * publicados ni vetados. Sirve para no perder una propuesta si `reconcile.yml`
 * no llegó a correr.
 */
export async function pendingManifests(): Promise<string[]> {
  const files = await listJsonFiles(PROPOSALS_DIR)
  return files.map((f) => basename(f, '.json')).sort()
}

/** El manifiesto más reciente. Es el que reconcilia el workflow tras el merge. */
export async function latestManifestDate(): Promise<string | null> {
  const all = await pendingManifests()
  return all[all.length - 1] ?? null
}

export function formatReconcileReport(report: ReconcileReport): string {
  if (!report.manifestFound) return 'Sin manifiesto para esa fecha: nada que reconciliar.'
  const lines = [
    `Propuestas: ${report.proposed}`,
    `Aprobadas:  ${report.kept.length}${report.kept.length > 0 ? ` (${report.kept.join(', ')})` : ''}`,
    `Vetadas:    ${report.vetoed.length}`,
  ]
  for (const v of report.vetoed) {
    lines.push(`  · ${v.slug} (${v.collection}) — ${v.reason}`)
  }
  return lines.join('\n')
}
