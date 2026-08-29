// src/ai/cache.ts
// Nunca se paga dos veces por lo mismo (§7.3, palanca 2).
//
// Si la clave existe en `.cache/decisions/`, NO se llama al modelo, punto. La
// caché vive en git, así que sobrevive a los runners efímeros y se puede
// auditar y revertir. Un museo analizado en octubre se vuelve a analizar solo si
// su ficha oficial cambia de verdad.
import type { CuratedCollection } from '../../contracts/curated'
import type { Cluster, Decision, ScreenVerdict } from '../types'
import { cacheKeyFromHash, PROMPT_VERSION, type Task } from '../core/hash'
import { madridMonthString } from '../core/clock'
import { readDecisions } from '../store/cache'
import { readCard } from '../store/content'

/**
 * La clave que identifica un trabajo pagado: tarea + versión de prompt + modelo
 * + semanticHash. Se usa como índice de caché y como `custom_id` del lote, que
 * es lo que hace idempotente la fase `collect` (§7.2 ter).
 */
export function jobKey(cluster: Cluster, task: Task, model: string): string {
  return cacheKeyFromHash(cluster.semanticHash, task, model)
}

export interface AiCache {
  /** Veredicto de cribado ya pagado para este cluster, si lo hay. */
  screenVerdict(cluster: Cluster, model: string): ScreenVerdict | undefined
  /** ¿Ya se pagó la redacción de este cluster con este prompt y este modelo? */
  wasWritten(cluster: Cluster, model: string): boolean
  readonly screenEntries: number
  readonly writeEntries: number
}

/**
 * Carga los trabajos ya pagados de los últimos meses, indexados por su clave.
 * `Decision.reason` guarda esa clave para las etapas `screen` y `write`: así la
 * caché se reconstruye del propio registro de decisiones y no hay un segundo
 * índice que pueda desincronizarse.
 */
export async function loadAiCache(now: Date, monthsBack = 3): Promise<AiCache> {
  const screens = new Map<string, ScreenVerdict>()
  const writes = new Set<string>()

  for (let i = 0; i < monthsBack; i++) {
    const month = madridMonthString(new Date(now.getTime() - i * 30 * 86_400_000))
    for (const decision of await readDecisions(month)) {
      if (decision.stage === 'screen' && decision.verdict) {
        screens.set(decision.reason, decision.verdict)
      } else if (decision.stage === 'write') {
        writes.add(decision.reason)
      }
    }
  }

  return {
    screenVerdict: (cluster, model) => screens.get(jobKey(cluster, 'screen', model)),
    wasWritten: (cluster, model) => writes.has(jobKey(cluster, 'write', model)),
    screenEntries: screens.size,
    writeEntries: writes.size,
  }
}

/**
 * ¿Hay que reescribir esta ficha? Una ficha `locked` NO se regenera jamás,
 * aunque cambie el prompt o la fuente: es la vía de escape para cuando el
 * propietario sí quiera escribir algo a mano (§3.7).
 */
export async function shouldRewrite(
  collection: CuratedCollection,
  slug: string,
  cluster: Cluster,
  model: string,
  cache: AiCache,
): Promise<{ rewrite: boolean; reason: string }> {
  const existing = await readCard(collection, slug)

  if (existing?.curated.locked === true) {
    return { rewrite: false, reason: 'ficha bloqueada a mano (locked)' }
  }
  if (cache.wasWritten(cluster, model)) {
    return { rewrite: false, reason: 'ya pagada con este prompt y este modelo' }
  }
  if (!existing) {
    return { rewrite: true, reason: 'ficha nueva' }
  }
  if (existing.curated.promptVersion !== PROMPT_VERSION.write) {
    return { rewrite: true, reason: `prompt ${existing.curated.promptVersion} → ${PROMPT_VERSION.write}` }
  }
  return { rewrite: true, reason: 'el material cambió de significado' }
}

/** La decisión que se apunta tras cribar. Es a la vez caché y etiqueta (§5.5). */
export function screenDecision(
  cluster: Cluster,
  verdict: ScreenVerdict,
  model: string,
  tokens: { input: number; output: number },
  at: string,
  passed: boolean,
): Decision {
  return {
    at,
    clusterId: cluster.clusterId,
    collection: cluster.collection,
    stage: 'screen',
    outcome: passed ? 'passed' : 'rejected',
    reason: jobKey(cluster, 'screen', model),
    verdict,
    model,
    promptVersion: PROMPT_VERSION.screen,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
  }
}

/** La decisión que se apunta tras redactar. Evita pagar dos veces la misma ficha. */
export function writeDecision(
  cluster: Cluster,
  model: string,
  tokens: { input: number; output: number },
  at: string,
  published: boolean,
): Decision {
  return {
    at,
    clusterId: cluster.clusterId,
    collection: cluster.collection,
    stage: 'write',
    outcome: published ? 'passed' : 'rejected',
    reason: jobKey(cluster, 'write', model),
    model,
    promptVersion: PROMPT_VERSION.write,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
  }
}

/** Decisión de una etapa sin IA (prefiltro, selección). No cachea nada: informa. */
export function stageDecision(
  cluster: Cluster,
  stage: 'prefilter' | 'select',
  passed: boolean,
  reason: string,
  at: string,
  score?: number,
): Decision {
  return {
    at,
    clusterId: cluster.clusterId,
    collection: cluster.collection,
    stage,
    outcome: passed ? 'passed' : 'rejected',
    reason,
    score,
  }
}
