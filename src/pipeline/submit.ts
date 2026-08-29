// src/pipeline/submit.ts
// La fase «submit» de las 02:30 UTC (§7.2 ter): rastrea, prefiltra, agrupa,
// criba EN SÍNCRONO, selecciona y ENVÍA el lote de redacción.
//
// Las 02:30 están elegidas a propósito: media hora antes del refresco de
// planonmap (03:00 UTC), para que el dato curado ya esté publicado y fresco
// cuando planonmap venga a por él.
import type { LoadedConfig } from '../../config/index'
import type { CuratedCollection } from '../../contracts/curated'
import type { Candidate, Cluster, Decision, PendingBatch, ScoredCluster, ScreenVerdict } from '../types'
import type { Clock } from '../core/clock'
import { Fetcher } from '../crawl/fetcher'
import { crawl } from './crawl'
import { groupCandidates } from '../cluster/group'
import { prefilter, type PrefilterReason } from '../screen/prefilter'
import { deterministicScore, passesThreshold, scoreCluster } from '../screen/score'
import { screenAll, type ScreenOutcome } from '../screen/llmScreen'
import { diversify } from '../screen/diversify'
import { buildBoundedMaterial } from '../enrich/material'
import { buildJob, type WriteJob } from '../enrich/write'
import { BudgetGuard } from '../ai/budget'
import { jobKey, loadAiCache, screenDecision, shouldRewrite, stageDecision } from '../ai/cache'
import { submitWriteBatch } from '../ai/batch'
import { addPendingBatch, appendDecisions, readHealth, writeCluster, writeQueue } from '../store/cache'
import { jobStateId, type StoredJob } from './collect'
import { readVetoes } from '../store/content'
import { applyObservations, countsForConsensus } from '../report/health'
import { nearbyTransit } from '../normalize/transit'
import { madridMonthString } from '../core/clock'
import { MUSEUMS } from '../../config/museums'
import { slugify } from '../core/ids'

export interface SubmitOptions {
  readonly config: LoadedConfig
  readonly clock: Clock
  readonly fetcher: Fetcher
  readonly collections: readonly CuratedCollection[]
  readonly limit: number
  readonly dryRun: boolean
}

export interface SubmitResultReport {
  readonly discovered: number
  readonly fetched: number
  readonly notModified: number
  readonly candidates: number
  readonly clusters: number
  readonly prefilterReasons: Partial<Record<PrefilterReason, number>>
  readonly screened: number
  readonly cachedVerdicts: number
  readonly selected: readonly ScoredCluster[]
  readonly discarded: readonly { slug: string; title: string; reason: string }[]
  readonly jobs: readonly WriteJob[]
  readonly batch: PendingBatch | null
  readonly costEur: number
  readonly warnings: readonly string[]
  readonly notes: readonly string[]
}

/** Slug definitivo de un cluster: el del catálogo si lo hay, si no del título. */
export function slugOf(cluster: Cluster): string {
  return cluster.seedSlug ?? slugify(cluster.title)
}

/** Un museo del catálogo entra siempre; su temporalidad es `atemporal`. */
function temporalityOf(candidate: Candidate): 'atemporal' | 'temporada' {
  return candidate.collection === 'museums' ? 'atemporal' : 'temporada'
}

export async function runSubmit(opts: SubmitOptions): Promise<SubmitResultReport> {
  const now = opts.clock.now()
  const nowIso = opts.clock.nowIso()
  const month = madridMonthString(now)
  const warnings: string[] = [...opts.config.warnings.map((w) => `${w.scope} ${w.id}: ${w.message}`)]
  const decisions: Decision[] = []

  // ── 1 · RASTREO ───────────────────────────────────────────────────────────
  const health = await readHealth()
  const skipSources = new Set(
    Object.values(health)
      .filter((h) => h.status === 'blocked' || h.status === 'disabled' || h.status === 'paused')
      .map((h) => h.id),
  )

  const crawled = await crawl({
    config: opts.config,
    fetcher: opts.fetcher,
    now,
    collections: opts.collections,
    skipSources,
    ...(opts.limit > 0 ? { limit: opts.limit * 5 } : {}),
  })

  const { verdicts: healthVerdicts } = await applyObservations(crawled.observations, now)
  for (const v of healthVerdicts) {
    if (v.justDegraded) warnings.push(`fuente degradada: ${v.health.id} — ${v.explanation}`)
    if (v.justDisabled) warnings.push(`fuente DESACTIVADA: ${v.health.id} — ${v.explanation}`)
  }

  // Una fuente degradada NO participa en el consenso de esta ejecución: evita
  // que un cero técnico se lea como «este plan ya no está avalado» (§4.6).
  const degraded = new Set(
    healthVerdicts.filter((v) => !countsForConsensus(v.health)).map((v) => v.health.id),
  )
  const candidates = crawled.candidates.map((c) =>
    degraded.has(c.sourceId) ? { ...c, tier: 'C' as const, trust: 0 } : c,
  )

  // ── 2 · AGRUPACIÓN ────────────────────────────────────────────────────────
  const clusters = groupCandidates(candidates, temporalityOf)

  // Las paradas de transporte salen de OSM, fuera del modelo: es un dato
  // objetivo y gratis (§6.2).
  const withTransit: Cluster[] = []
  for (const cluster of clusters) {
    const hints = opts.dryRun
      ? []
      : await nearbyTransit(opts.fetcher, cluster.venue.lat, cluster.venue.lng)
    withTransit.push({ ...cluster, transitHints: hints })
  }

  // ── 3 · PREFILTRO (sin IA) ────────────────────────────────────────────────
  const vetoed = new Set((await readVetoes()).map((v) => v.slug))
  const aiCache = await loadAiCache(now)
  const knownHashes = new Set<string>()

  const prefilterReasons: Partial<Record<PrefilterReason, number>> = {}
  const survivors: Cluster[] = []

  for (const cluster of withTransit) {
    const deterministic = deterministicScore(cluster, now, opts.config.scoring, (id) =>
      health[id]?.effectiveTrust,
    )
    const outcome = prefilter(cluster, {
      now,
      scoring: opts.config.scoring,
      knownHashes,
      vetoedSlugs: vetoed,
      wellCoveredKeys: new Set(),
      deterministicScore: deterministic.total,
    })

    if (!outcome.pass) {
      prefilterReasons[outcome.reason] = (prefilterReasons[outcome.reason] ?? 0) + 1
      decisions.push(stageDecision(cluster, 'prefilter', false, outcome.reason, nowIso))
      continue
    }
    survivors.push(cluster)
  }

  // ── 4 · CRIBADO ───────────────────────────────────────────────────────────
  // Los museos NO se criban: entran por catálogo, no hay nada que filtrar (§5.1).
  const needScreening = survivors.filter((c) => c.collection !== 'museums')
  const museums = survivors.filter((c) => c.collection === 'museums')

  const fromCache = new Map<string, ReturnType<typeof aiCache.screenVerdict>>()
  const toScreen: Cluster[] = []
  for (const cluster of needScreening) {
    const cached = aiCache.screenVerdict(cluster, opts.config.budget.screenModel)
    if (cached) fromCache.set(cluster.clusterId, cached)
    else toScreen.push(cluster)
  }

  const guard = await BudgetGuard.load(opts.config.budget, now)
  let costEur = 0

  const screened: ScreenOutcome =
    opts.dryRun || toScreen.length === 0
      ? {
          verdicts: new Map<string, ScreenVerdict>(),
          inputTokens: 0,
          outputTokens: 0,
          eur: 0,
          missing: [],
          skippedForBudget: false,
        }
      : await screenAll(toScreen, opts.config.budget, guard, now)
  costEur += screened.eur

  if (screened.skippedForBudget) {
    warnings.push('presupuesto agotado durante el cribado: los candidatos quedan en cola')
  }
  if (screened.providerError) {
    // Modo degradado del §7.7: se sigue publicando lo ya escrito, y lo que
    // necesitaba cribado vuelve a la cola de mañana. No se rompe nada.
    warnings.push(
      `el proveedor de cribado falló${screened.providerDown ? ' y no admite reintento' : ''}: ` +
        `${screened.providerError}. Se sigue publicando lo ya escrito.`,
    )
  }
  if (screened.missing.length > 0) {
    warnings.push(`el modelo no devolvió veredicto para ${screened.missing.length} candidatos`)
  }

  // ── 5 · PUNTUACIÓN Y SELECCIÓN ────────────────────────────────────────────
  const scored: ScoredCluster[] = []
  const discarded: { slug: string; title: string; reason: string }[] = []

  for (const cluster of [...needScreening, ...museums]) {
    const verdict =
      cluster.collection === 'museums'
        ? undefined
        : (screened.verdicts.get(cluster.clusterId) ?? fromCache.get(cluster.clusterId))

    const result = scoreCluster(cluster, now, opts.config.scoring, verdict, (id) =>
      health[id]?.effectiveTrust,
    )

    if (verdict) {
      decisions.push(
        screenDecision(
          cluster,
          verdict,
          opts.config.budget.screenModel,
          { input: 0, output: 0 },
          nowIso,
          passesThreshold(result, opts.config.scoring),
        ),
      )
    }

    if (!passesThreshold(result, opts.config.scoring)) {
      const reason = result.vetoReason
        ? vetoLabel(result.vetoReason)
        : `${result.total} puntos, por debajo de ${opts.config.scoring.threshold}`
      discarded.push({ slug: slugOf(cluster), title: cluster.title, reason })
      decisions.push(stageDecision(cluster, 'select', false, reason, nowIso, result.total))
      continue
    }

    scored.push(result)
  }

  // Los museos entran enteros; planes y espectáculos pasan por las cuotas.
  const museumScored = scored.filter((s) => s.cluster.collection === 'museums')
  const rest = scored.filter((s) => s.cluster.collection !== 'museums')

  const limit = opts.limit > 0 ? opts.limit : rest.length
  const diversified = diversify(rest, opts.config.quotas, opts.config.scoring, limit)
  for (const r of diversified.rejected) {
    discarded.push({
      slug: slugOf(r.scored.cluster),
      title: r.scored.cluster.title,
      reason: r.reason,
    })
  }
  for (const unmet of diversified.unmetMinimums) {
    // El hueco se queda vacío: nunca se publica algo malo por rellenar una cuota.
    warnings.push(`cuota sin cubrir, se deja vacía: ${unmet}`)
  }

  const museumLimit = opts.limit > 0 ? opts.limit : museumScored.length
  const selected = [...museumScored.slice(0, museumLimit), ...diversified.selected]

  // ── 6 · LOTE DE REDACCIÓN ─────────────────────────────────────────────────
  const jobs: WriteJob[] = []
  for (const s of selected) {
    const slug = slugOf(s.cluster)
    const decision = await shouldRewrite(
      s.cluster.collection,
      slug,
      s.cluster,
      opts.config.budget.writerModel,
      aiCache,
    )
    if (!decision.rewrite) {
      decisions.push(stageDecision(s.cluster, 'select', false, decision.reason, nowIso, s.total))
      continue
    }
    const material = buildBoundedMaterial(s.cluster)
    const customId = jobKey(s.cluster, 'write', opts.config.budget.writerModel)
    jobs.push(buildJob(s.cluster, slug, material, customId))

    // La fase `collect` corre HORAS DESPUÉS, en otro runner y sin memoria: para
    // reconstruir la ficha necesita el cluster puntuado y el material EXACTO que
    // se envió — el verificador compara evidencias contra ese material, no
    // contra uno recalculado. Por eso se guarda aquí y viaja en la rama.
    if (!opts.dryRun) {
      const stored: StoredJob = { customId, slug, material, scored: s }
      await writeCluster(jobStateId(customId), stored)
    }
  }

  let batch: PendingBatch | null = null
  if (!opts.dryRun && jobs.length > 0) {
    const submitted = await submitWriteBatch(
      jobs.slice(0, opts.config.budget.writeBatchSize),
      opts.config.budget,
      guard,
      now,
    )
    batch = submitted.batch
    if (batch) await addPendingBatch(batch)
    if (submitted.reason) warnings.push(submitted.reason)

    if (submitted.skipped.length > 0) {
      // Los candidatos que necesitaban IA quedan en cola CON SU MATERIAL YA
      // PREPARADO, listos para el día 1 del mes siguiente SIN VOLVER A RASTREAR.
      await writeQueue(
        jobs
          .filter((j) => submitted.skipped.includes(j.customId))
          .map((j) => ({
            clusterId: j.cluster.clusterId,
            collection: j.cluster.collection,
            slug: j.slug,
            material: j.material,
            queuedAt: nowIso,
            reason: 'presupuesto agotado',
          })),
      )
    }
  }

  if (!opts.dryRun) {
    await appendDecisions(month, decisions)
  }
  if (guard.shouldWarn) {
    warnings.push(
      `gasto por encima del 70 % del tope: ${guard.spentEur.toFixed(2)} € de ${guard.budgetEur.toFixed(2)} €`,
    )
    if (!opts.dryRun) await guard.markWarned()
  }

  return {
    discovered: crawled.discovered,
    fetched: crawled.fetched,
    notModified: crawled.notModified,
    candidates: candidates.length,
    clusters: clusters.length,
    prefilterReasons,
    screened: toScreen.length,
    cachedVerdicts: fromCache.size,
    selected,
    discarded,
    jobs,
    batch,
    costEur,
    warnings,
    notes: crawled.notes,
  }
}

function vetoLabel(veto: string): string {
  switch (veto) {
    case 'es_trampa_turistica':
      return 'trampa turística'
    case 'es_generico_europeo':
      return 'genérico europeo'
    case 'requiere_ser_local':
      return 'requiere ser local'
    case 'es_marca_disfrazada':
      return 'evento de marca disfrazado'
    default:
      return veto
  }
}

/** El catálogo de museos, para la fase `submit` de los lunes. */
export function museumSeedCount(): number {
  return MUSEUMS.filter((m) => m.enabled !== false).length
}
