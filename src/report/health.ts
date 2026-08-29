// src/report/health.ts
// El canario de rendimiento por fuente (§4.6) y la comprobación semanal de
// enlaces muertos.
//
// La lección que planonmap aprendió por las malas: una degradación SILENCIOSA
// —el refresco «funciona», trae datos, pero la calidad se desploma— es peor que
// un fallo ruidoso. El canario existe para que nunca sea silenciosa.
import type { SourceConfig } from '../../config/schema'
import type { SourceHealth, SourceHealthStatus } from '../types'
import { readHealth, writeHealth, type HealthCache } from '../store/cache'
import { readAllCards } from '../store/content'
import { VERIFICATION_MAX_AGE_DAYS } from '../../config/index'
import { daysBetween } from '../core/clock'

/** Umbrales del canario. Cambiarlos cambia cuándo se grita. */
export const CANARY = {
  /** Menos de este porcentaje de la mediana de 7 días → degradada. */
  minFractionOfMedian: 0.3,
  /** Subida de campos vacíos, en puntos porcentuales, que también degrada. */
  maxEmptyFieldJump: 0.4,
  /** Días consecutivos en `degraded` antes de pasar a `disabled`. */
  degradedDaysToDisable: 7,
  windowDays: 7,
} as const

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

export interface RunObservation {
  readonly sourceId: string
  readonly extracted: number
  readonly emptyFieldRate: number
  readonly error?: string | undefined
}

export interface HealthVerdict {
  readonly health: SourceHealth
  readonly justDegraded: boolean
  readonly justDisabled: boolean
  readonly explanation: string
}

/**
 * Actualiza la salud de una fuente con lo observado en esta ejecución.
 *
 * Consecuencias de una fuente `degraded`, y son las tres a la vez:
 *   · NO participa en el consenso de esa ejecución — evita que un cero técnico
 *     se lea como «este plan ya no está avalado».
 *   · Sus fichas ya publicadas SE CONSERVAN (carry-forward).
 *   · Se abre UNA incidencia; si ya existe una abierta, se comenta en ella.
 */
export function updateHealth(
  previous: SourceHealth | undefined,
  observation: RunObservation,
  now: Date,
): HealthVerdict {
  const recent = [...(previous?.recentExtracted ?? []), observation.extracted].slice(
    -CANARY.windowDays,
  )
  const med = median(previous?.recentExtracted ?? [])
  const previousEmptyRate = previous?.emptyFieldRate ?? observation.emptyFieldRate

  const reasons: string[] = []
  if (observation.error) reasons.push(`error: ${observation.error}`)
  if (observation.extracted === 0 && med > 0) reasons.push('0 elementos extraídos')
  if (med > 0 && observation.extracted < med * CANARY.minFractionOfMedian) {
    reasons.push(`${observation.extracted} elementos frente a una mediana de ${med}`)
  }
  if (observation.emptyFieldRate - previousEmptyRate > CANARY.maxEmptyFieldJump) {
    reasons.push(
      `campos vacíos ${(previousEmptyRate * 100).toFixed(0)} % → ${(observation.emptyFieldRate * 100).toFixed(0)} %`,
    )
  }

  const degraded = reasons.length > 0
  const consecutive = degraded ? (previous?.consecutiveDegradedDays ?? 0) + 1 : 0

  let status: SourceHealthStatus = 'ok'
  if (previous?.status === 'blocked') status = 'blocked'
  else if (consecutive >= CANARY.degradedDaysToDisable) status = 'disabled'
  else if (degraded) status = 'degraded'

  const health: SourceHealth = {
    id: observation.sourceId,
    status,
    medianExtracted: median(recent),
    recentExtracted: recent,
    emptyFieldRate: observation.emptyFieldRate,
    consecutiveDegradedDays: consecutive,
    lastRunAt: now.toISOString(),
    ...(observation.error ? { lastError: observation.error } : {}),
    ...(previous?.effectiveTrust !== undefined ? { effectiveTrust: previous.effectiveTrust } : {}),
    ...(previous?.pausedUntil ? { pausedUntil: previous.pausedUntil } : {}),
    ...(previous?.issueNumber !== undefined ? { issueNumber: previous.issueNumber } : {}),
  }

  return {
    health,
    justDegraded: status === 'degraded' && previous?.status !== 'degraded',
    justDisabled: status === 'disabled' && previous?.status !== 'disabled',
    explanation: reasons.join(' · ') || 'sin incidencias',
  }
}

/** ¿Puede esta fuente contar para el consenso ahora mismo? */
export function countsForConsensus(health: SourceHealth | undefined): boolean {
  if (!health) return true
  return health.status === 'ok'
}

export async function applyObservations(
  observations: readonly RunObservation[],
  now: Date,
): Promise<{ cache: HealthCache; verdicts: readonly HealthVerdict[] }> {
  const cache = await readHealth()
  const verdicts: HealthVerdict[] = []

  for (const observation of observations) {
    const verdict = updateHealth(cache[observation.sourceId], observation, now)
    cache[observation.sourceId] = verdict.health
    verdicts.push(verdict)
  }

  await writeHealth(cache)
  return { cache, verdicts }
}

// ── Informe semanal ─────────────────────────────────────────────────────────

export interface DeadLink {
  readonly slug: string
  readonly url: string
  readonly status: number
}

export interface HealthReport {
  readonly generatedAt: string
  readonly sources: readonly SourceHealth[]
  readonly unverifiedSources: readonly string[]
  readonly staleVerifications: readonly { readonly id: string; readonly ageDays: number }[]
  readonly deadLinks: readonly DeadLink[]
  readonly publishedCards: number
}

export async function buildHealthReport(
  sources: readonly SourceConfig[],
  deadLinks: readonly DeadLink[],
  now: Date,
): Promise<HealthReport> {
  const cache = await readHealth()
  const { cards } = await readAllCards()

  const unverified = sources.filter((s) => !s.verifiedAt).map((s) => s.id)
  const stale = sources
    .filter((s) => s.verifiedAt)
    .map((s) => ({
      id: s.id,
      ageDays: daysBetween(new Date(`${s.verifiedAt ?? ''}T00:00:00Z`), now),
    }))
    .filter((s) => s.ageDays > VERIFICATION_MAX_AGE_DAYS)

  return {
    generatedAt: now.toISOString(),
    sources: Object.values(cache).sort((a, b) => a.id.localeCompare(b.id)),
    unverifiedSources: unverified,
    staleVerifications: stale,
    deadLinks,
    publishedCards: cards.length,
  }
}

export function formatHealthReport(report: HealthReport): string {
  const lines = [
    `# Salud de las fuentes · ${report.generatedAt.slice(0, 10)}`,
    '',
    `Fichas publicadas: **${report.publishedCards}**`,
    '',
    '## Fuentes',
    '',
    '| Fuente | Estado | Mediana 7 d | Campos vacíos | Días degradada |',
    '|---|---|---|---|---|',
  ]

  for (const s of report.sources) {
    lines.push(
      `| ${s.id} | ${statusEmoji(s.status)} ${s.status} | ${s.medianExtracted.toFixed(0)} | ` +
        `${(s.emptyFieldRate * 100).toFixed(0)} % | ${s.consecutiveDegradedDays} |`,
    )
  }

  if (report.unverifiedSources.length > 0) {
    lines.push(
      '',
      '## Sin verificar (no se rastrean)',
      '',
      ...report.unverifiedSources.map(
        (id) => `- \`${id}\` — falta \`verifiedAt\`. Lee su robots.txt y sus condiciones, anótalo en SOURCES.md.`,
      ),
    )
  }

  if (report.staleVerifications.length > 0) {
    lines.push(
      '',
      `## Verificación caducada (> ${VERIFICATION_MAX_AGE_DAYS} días)`,
      '',
      ...report.staleVerifications.map((s) => `- \`${s.id}\` — revisada hace ${s.ageDays} días`),
    )
  }

  lines.push('', '## Enlaces muertos', '')
  if (report.deadLinks.length === 0) {
    lines.push('Ninguno. 🎉')
  } else {
    lines.push('| Ficha | URL | Estado |', '|---|---|---|')
    for (const d of report.deadLinks) {
      lines.push(`| ${d.slug} | ${d.url} | ${d.status} |`)
    }
  }

  return lines.join('\n')
}

function statusEmoji(status: SourceHealthStatus): string {
  switch (status) {
    case 'ok':
      return '✅'
    case 'degraded':
      return '⚠️'
    case 'paused':
      return '⏸'
    case 'blocked':
      return '⛔'
    case 'disabled':
      return '🔴'
  }
}
