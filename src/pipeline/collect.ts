// src/pipeline/collect.ts
// La fase «collect» de las 06:30, 10:30 y 14:30 UTC (§7.2 ter): consulta el lote
// pendiente. Si está listo: verifica, escribe las fichas y abre o actualiza el
// PR. Si no, SALE SIN HACER NADA y con éxito — los reintentos lo recogen.
import type { LoadedConfig } from '../../config/index'
import type { CuratedEvent } from '../../contracts/curated'
import type { Cluster, Decision, ScoredCluster, VerificationResult } from '../types'
import type { Clock } from '../core/clock'
import { collectWriteBatch } from '../ai/batch'
import { BudgetGuard } from '../ai/budget'
import { writeDecision } from '../ai/cache'
import { assembleCuratedEvent } from '../enrich/assemble'
import { checkCopy, verifyCard } from '../enrich/verify'
import { appendDecisions, readCluster, readPendingBatches, removePendingBatch } from '../store/cache'
import { readCard, writeCard } from '../store/content'
import { madridMonthString } from '../core/clock'
import type { ProposalEntry } from '../review/manifest'

/** Lo que `submit` dejó guardado para que `collect` pueda reconstruir la ficha. */
export interface StoredJob {
  readonly customId: string
  readonly slug: string
  readonly material: string
  readonly scored: ScoredCluster
}

export interface CollectOptions {
  readonly config: LoadedConfig
  readonly clock: Clock
  readonly dryRun: boolean
}

export interface CollectReport {
  readonly ready: boolean
  readonly batchesChecked: number
  readonly proposals: readonly ProposalEntry[]
  readonly discarded: readonly { slug: string; title: string; reason: string }[]
  readonly needsHuman: readonly { slug: string; reason: string }[]
  readonly costEur: number
  readonly warnings: readonly string[]
}

/** Clave con la que `submit` guardó el cluster puntuado en `.cache/clusters/`. */
export function jobStateId(customId: string): string {
  return `job-${customId.slice(0, 32)}`
}

/**
 * Recoge todos los lotes pendientes. Es IDEMPOTENTE: si esta fase se ejecuta dos
 * veces, la segunda encuentra las fichas ya escritas y no hace nada, porque el
 * `custom_id` de cada elemento ES su clave de caché.
 */
export async function runCollect(opts: CollectOptions): Promise<CollectReport> {
  const now = opts.clock.now()
  const nowIso = opts.clock.nowIso()
  const month = madridMonthString(now)

  const pending = await readPendingBatches()
  if (pending.length === 0) {
    return {
      ready: false,
      batchesChecked: 0,
      proposals: [],
      discarded: [],
      needsHuman: [],
      costEur: 0,
      warnings: ['nada pendiente que recoger'],
    }
  }

  const guard = await BudgetGuard.load(opts.config.budget, now)
  const proposals: ProposalEntry[] = []
  const discarded: { slug: string; title: string; reason: string }[] = []
  const needsHuman: { slug: string; reason: string }[] = []
  const warnings: string[] = []
  const decisions: Decision[] = []
  let ready = false
  let costEur = 0

  for (const batch of pending) {
    const result = await collectWriteBatch(batch, now)

    if (result.expired) {
      // A las 26 h se cancela, se registra el incidente y los candidatos vuelven
      // a la cola del día siguiente. Nunca se queda colgado.
      await removePendingBatch(batch.id)
      warnings.push(`lote ${batch.id} caducado a las ${opts.config.budget.batchExpiryHours} h: cancelado`)
      continue
    }

    if (!result.ready) {
      warnings.push(`lote ${batch.id} todavía en proceso: se reintenta más tarde`)
      continue
    }

    ready = true
    let inputTokens = 0
    let outputTokens = 0

    for (const collected of result.cards) {
      inputTokens += collected.inputTokens
      outputTokens += collected.outputTokens

      const job = await readCluster<StoredJob>(jobStateId(collected.customId))
      if (!job) {
        warnings.push(`sin estado guardado para ${collected.customId}: se ignora`)
        continue
      }

      if (!collected.card) {
        // El modelo devolvió JSON inválido. No hay tercera (§6.4).
        discarded.push({
          slug: job.slug,
          title: job.scored.cluster.title,
          reason: `respuesta ilegible del modelo${collected.rawError ? ` (${collected.rawError})` : ''}`,
        })
        continue
      }

      const outcome = await processCard(job, collected.card, opts, nowIso, now)
      if (outcome.kind === 'discarded') {
        discarded.push({ slug: job.slug, title: job.scored.cluster.title, reason: outcome.reason })
        decisions.push(
          writeDecision(job.scored.cluster, batch.model, { input: 0, output: 0 }, nowIso, false),
        )
        continue
      }

      if (outcome.kind === 'needs-human') {
        needsHuman.push({ slug: job.slug, reason: outcome.reason })
        continue
      }

      if (!opts.dryRun) await writeCard(outcome.event)
      decisions.push(
        writeDecision(job.scored.cluster, batch.model, { input: 0, output: 0 }, nowIso, true),
      )
      proposals.push({
        event: outcome.event,
        kind: outcome.existed ? 'modified' : 'new',
        ...(outcome.warnings.length > 0 ? { warnings: outcome.warnings } : {}),
      })
    }

    // Al recoger, el apunte provisional se sustituye por el consumo REAL (§7.6).
    if (!opts.dryRun && (inputTokens > 0 || outputTokens > 0)) {
      const before = guard.spentEur
      await guard.settleBatch(batch.id, { model: batch.model, inputTokens, outputTokens })
      costEur += guard.spentEur - before + batch.estimatedEur
    }
    await removePendingBatch(batch.id)
  }

  if (!opts.dryRun) await appendDecisions(month, decisions)

  return {
    ready,
    batchesChecked: pending.length,
    proposals,
    discarded,
    needsHuman,
    costEur,
    warnings,
  }
}

type CardOutcome =
  | { kind: 'ok'; event: CuratedEvent; existed: boolean; warnings: string[] }
  | { kind: 'discarded'; reason: string }
  | { kind: 'needs-human'; reason: string }

/**
 * Verifica y ensambla una ficha recién escrita. El orden importa: primero la
 * comprobación de copia (§6.1), después las evidencias (§6.4). Una ficha que
 * copia no merece que se le verifiquen los datos.
 */
async function processCard(
  job: StoredJob,
  written: Parameters<typeof verifyCard>[0]['card'],
  opts: CollectOptions,
  nowIso: string,
  now: Date,
): Promise<CardOutcome> {
  const cluster: Cluster = job.scored.cluster
  const warnings: string[] = []

  const copy = checkCopy(written, job.material)
  if (!copy.clean) {
    // Al primer fallo se reintentaría con la instrucción adicional; al segundo,
    // `needs-human` y no se publica. En lote, el reintento va al día siguiente.
    return {
      kind: 'needs-human',
      reason: `solapamiento literal con el material: «${copy.shared[0] ?? ''}»`,
    }
  }

  const verification: VerificationResult = verifyCard({
    card: written,
    cluster,
    material: job.material,
  })

  if (verification.discarded) {
    return { kind: 'discarded', reason: verification.discardReason ?? 'verificación fallida' }
  }
  if (verification.needsHuman) {
    return { kind: 'needs-human', reason: verification.needsHumanReason ?? 'revisión manual' }
  }
  if (verification.droppedFields.length > 0) {
    warnings.push(`campos omitidos sin evidencia: ${verification.droppedFields.join(', ')}`)
  }

  const existing = await readCard(cluster.collection, job.slug)
  if (existing?.curated.locked === true) {
    return { kind: 'discarded', reason: 'la ficha está bloqueada (locked): no se regenera' }
  }

  const event = assembleCuratedEvent({
    scored: job.scored,
    verification,
    slug: job.slug,
    now,
    nowIso,
    // Sin imagen de terceros: se omite y planonmap aplica su cascada (§12.2).
  })

  return { kind: 'ok', event, existed: existing !== null, warnings }
}
