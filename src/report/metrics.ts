// src/report/metrics.ts
// Cómo se mide si el sistema acierta, y cómo se afina (§5.5).
//
// LA ETIQUETA DE VERDAD ES GRATIS: es lo que hace el propietario en el PR de
// revisión — mergear es «acierto», borrar el archivo es «fallo». Ningún
// etiquetado aparte, ningún panel, ningún coste.
import type { SourceConfig } from '../../config/schema'
import type { CuratedCollection } from '../../contracts/curated'
import { TRUST_ADJUSTMENT } from '../../config/scoring'
import { madridMonthString } from '../core/clock'
import { readDecisions, readLedger } from '../store/cache'
import { readAllCards, readVetoes } from '../store/content'
import { listJsonFiles, readJson } from '../store/fs'
import { PROPOSALS_DIR, proposalFile } from '../store/paths'
import type { ProposalManifest } from '../types'
import { basename } from 'node:path'

export interface Metrics {
  readonly month: string
  /** fichas aprobadas / fichas propuestas. Objetivo ≥ 0,80. */
  readonly editorialPrecision: number
  readonly proposed: number
  readonly approved: number
  /** euros del mes / fichas aprobadas. Objetivo ≤ 0,10 €. */
  readonly costPerPublishedCard: number
  readonly spentEur: number
  /** campos omitidos por falta de evidencia / campos totales. Objetivo ≤ 0,15. */
  readonly omissionRate: number
  readonly bySource: Readonly<Record<string, { proposed: number; approved: number; precision: number }>>
  readonly byCollection: Readonly<Record<string, number>>
  readonly neighborhoods: number
}

const VERIFIABLE_FIELDS = 4 // price, schedule, dates, location

export async function computeMetrics(now: Date, monthsBack = 1): Promise<Metrics> {
  const month = madridMonthString(now)
  const ledger = await readLedger(month)
  const vetoed = new Set((await readVetoes()).map((v) => v.slug))
  const { cards } = await readAllCards()
  const publishedSlugs = new Set(cards.map((c) => c.slug))

  // Las propuestas del periodo salen de los manifiestos, que son la fuente de
  // verdad de qué se propuso: `content/cards/` solo tiene lo que sobrevivió.
  const manifests: ProposalManifest[] = []
  for (const file of await listJsonFiles(PROPOSALS_DIR)) {
    const date = basename(file, '.json')
    if (!isWithin(date, now, monthsBack * 31)) continue
    const manifest = await readJson<ProposalManifest>(proposalFile(date))
    if (manifest) manifests.push(manifest)
  }

  const proposedSlugs = new Set(manifests.flatMap((m) => m.proposed.map((p) => p.slug)))
  const approved = [...proposedSlugs].filter((s) => publishedSlugs.has(s) && !vetoed.has(s))

  // Precisión POR FUENTE: se atribuye a las fuentes que aportaron el candidato.
  const bySource: Record<string, { proposed: number; approved: number; precision: number }> = {}
  for (const card of cards) {
    for (const sourceId of card.event.curated.consensus.sources) {
      const entry = bySource[sourceId] ?? { proposed: 0, approved: 0, precision: 0 }
      entry.proposed++
      if (!vetoed.has(card.slug)) entry.approved++
      entry.precision = entry.proposed === 0 ? 0 : entry.approved / entry.proposed
      bySource[sourceId] = entry
    }
  }

  // Tasa de omisión: campos que se cayeron por falta de evidencia literal.
  let omitted = 0
  let total = 0
  for (const card of cards) {
    const v = card.event.curated.verified
    total += VERIFIABLE_FIELDS
    omitted += [v.price, v.schedule, v.dates, v.location].filter((ok) => !ok).length
  }

  const byCollection: Record<string, number> = {}
  const neighborhoods = new Set<string>()
  for (const card of cards) {
    const c: CuratedCollection = card.collection
    byCollection[c] = (byCollection[c] ?? 0) + 1
    const n = card.event.venue.neighborhood ?? card.event.venue.district
    if (n) neighborhoods.add(n)
  }

  const spentEur = ledger?.spentEur ?? 0

  return {
    month,
    proposed: proposedSlugs.size,
    approved: approved.length,
    editorialPrecision: proposedSlugs.size === 0 ? 0 : approved.length / proposedSlugs.size,
    spentEur,
    costPerPublishedCard: approved.length === 0 ? 0 : spentEur / approved.length,
    omissionRate: total === 0 ? 0 : omitted / total,
    bySource,
    byCollection,
    neighborhoods: neighborhoods.size,
  }
}

export interface TrustProposal {
  readonly sourceId: string
  readonly currentTrust: number
  readonly proposedTrust: number
  readonly approvalRate: number
  readonly sampleSize: number
  readonly rationale: string
}

/**
 * Ajuste automático de la reputación de fuente. EL CAMBIO SE PROPONE EN UN PR,
 * NO SE APLICA SOLO: es una decisión editorial y el propietario la ve (§5.5).
 */
export function proposeTrustAdjustments(
  metrics: Metrics,
  sources: readonly SourceConfig[],
): TrustProposal[] {
  const out: TrustProposal[] = []

  for (const source of sources) {
    const stats = metrics.bySource[source.id]
    if (!stats || stats.proposed < TRUST_ADJUSTMENT.minProposals) continue

    const rate = stats.precision
    let proposed = source.trust
    let rationale = ''

    if (rate < TRUST_ADJUSTMENT.dropToZeroBelow) {
      proposed = 0
      rationale = `aprobación ${(rate * 100).toFixed(0)} %: deja de contar para el consenso`
    } else if (rate < TRUST_ADJUSTMENT.halveBelow) {
      proposed = round2(source.trust * 0.5)
      rationale = `aprobación ${(rate * 100).toFixed(0)} %: se degrada a la mitad`
    } else if (rate > TRUST_ADJUSTMENT.boostAbove) {
      proposed = round2(Math.min(1, source.trust * TRUST_ADJUSTMENT.boostFactor))
      rationale = `aprobación ${(rate * 100).toFixed(0)} %: se sube un 10 %`
    } else {
      continue
    }

    if (proposed !== source.trust) {
      out.push({
        sourceId: source.id,
        currentTrust: source.trust,
        proposedTrust: proposed,
        approvalRate: rate,
        sampleSize: stats.proposed,
        rationale,
      })
    }
  }

  return out
}

export function formatMetrics(metrics: Metrics, proposals: readonly TrustProposal[]): string {
  const target = (value: number, goal: number, higherIsBetter = true): string => {
    const ok = higherIsBetter ? value >= goal : value <= goal
    return ok ? '✅' : '⚠️'
  }

  const lines = [
    `# Métricas · ${metrics.month}`,
    '',
    '| Métrica | Valor | Objetivo | |',
    '|---|---|---|---|',
    `| Precisión editorial | ${(metrics.editorialPrecision * 100).toFixed(0)} % | ≥ 80 % | ${target(metrics.editorialPrecision, 0.8)} |`,
    `| Coste por ficha publicada | ${metrics.costPerPublishedCard.toFixed(3)} € | ≤ 0,10 € | ${target(metrics.costPerPublishedCard, 0.1, false)} |`,
    `| Tasa de omisión | ${(metrics.omissionRate * 100).toFixed(0)} % | ≤ 15 % | ${target(metrics.omissionRate, 0.15, false)} |`,
    `| Gasto del mes | ${metrics.spentEur.toFixed(2)} € | ≤ 5,00 € | ${target(metrics.spentEur, 5, false)} |`,
    '',
    `Propuestas: ${metrics.proposed} · aprobadas: ${metrics.approved} · barrios cubiertos: ${metrics.neighborhoods}`,
    '',
    '## Por colección',
    '',
    ...Object.entries(metrics.byCollection)
      .sort()
      .map(([c, n]) => `- **${c}**: ${n} fichas`),
    '',
    '## Precisión por fuente',
    '',
    '| Fuente | Propuestas | Aprobadas | Precisión |',
    '|---|---|---|---|',
    ...Object.entries(metrics.bySource)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([id, s]) =>
          `| ${id} | ${s.proposed} | ${s.approved} | ${(s.precision * 100).toFixed(0)} % |`,
      ),
  ]

  if (proposals.length > 0) {
    lines.push(
      '',
      '## Ajustes de `trust` propuestos',
      '',
      'Estos cambios **no se aplican solos**: edítalos en `config/sources.ts` si estás de acuerdo.',
      '',
      ...proposals.map(
        (p) =>
          `- \`${p.sourceId}\`: ${p.currentTrust} → **${p.proposedTrust}** — ${p.rationale} (n=${p.sampleSize})`,
      ),
    )
  }

  return lines.join('\n')
}

function isWithin(date: string, now: Date, days: number): boolean {
  const at = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return false
  return now.getTime() - at.getTime() <= days * 86_400_000
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Cuántas decisiones se tomaron este mes y en qué etapa. Para el embudo. */
export async function funnelCounts(now: Date): Promise<Record<string, number>> {
  const decisions = await readDecisions(madridMonthString(now))
  const counts: Record<string, number> = {}
  for (const d of decisions) {
    const key = `${d.stage}:${d.outcome}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
