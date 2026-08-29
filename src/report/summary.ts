// src/report/summary.ts
// El resumen de una ejecución. Se escribe en `.cache/last-run-summary.md` y el
// workflow lo vuelca en `$GITHUB_STEP_SUMMARY`: se lee en la pestaña del
// workflow y no ocupa sitio en el repositorio.
import type { PrefilterReason } from '../screen/prefilter'
import type { SpendLedger } from '../types'

export interface FunnelStage {
  readonly name: string
  readonly count: number
  readonly note?: string | undefined
}

export interface RunSummary {
  readonly phase: 'submit' | 'collect'
  readonly collections: readonly string[]
  readonly dryRun: boolean
  readonly startedAt: string
  readonly funnel: readonly FunnelStage[]
  readonly prefilterReasons: Readonly<Partial<Record<PrefilterReason, number>>>
  readonly written: readonly string[]
  readonly discarded: readonly { readonly slug: string; readonly reason: string }[]
  readonly warnings: readonly string[]
  readonly costEur: number
  readonly ledger?: SpendLedger | undefined
  readonly batchId?: string | undefined
}

export function renderRunSummary(summary: RunSummary): string {
  const lines = [
    `## Ejecución \`${summary.phase}\`${summary.dryRun ? ' · **EN SECO** (no se llamó a ningún modelo)' : ''}`,
    '',
    `Colecciones: ${summary.collections.join(', ') || '—'} · ${summary.startedAt}`,
    '',
    '### Embudo',
    '',
    '| Etapa | Cantidad | |',
    '|---|---:|---|',
  ]

  for (const stage of summary.funnel) {
    lines.push(`| ${stage.name} | ${stage.count} | ${stage.note ?? ''} |`)
  }

  const reasons = Object.entries(summary.prefilterReasons).filter(([, n]) => (n ?? 0) > 0)
  if (reasons.length > 0) {
    lines.push(
      '',
      '### Descartes del prefiltro (sin coste)',
      '',
      ...reasons
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .map(([reason, n]) => `- \`${reason}\`: ${n}`),
    )
  }

  if (summary.written.length > 0) {
    lines.push('', '### Fichas escritas', '', ...summary.written.map((s) => `- \`${s}\``))
  }

  if (summary.discarded.length > 0) {
    lines.push(
      '',
      '### Descartadas tras el cribado',
      '',
      '| Ficha | Motivo |',
      '|---|---|',
      ...summary.discarded.map((d) => `| ${d.slug} | ${d.reason} |`),
    )
  }

  if (summary.batchId) {
    lines.push(
      '',
      `### Lote enviado`,
      '',
      `\`${summary.batchId}\` — se recoge en la fase \`collect\` (06:30, 10:30 o 14:30 UTC).`,
    )
  }

  lines.push(
    '',
    '### Coste',
    '',
    `Esta ejecución: **${summary.costEur.toFixed(4)} €**`,
  )
  if (summary.ledger) {
    lines.push(
      `Mes ${summary.ledger.month}: **${summary.ledger.spentEur.toFixed(2)} €** de ` +
        `${summary.ledger.budgetEur.toFixed(2)} €`,
    )
  }

  if (summary.warnings.length > 0) {
    lines.push('', '### Avisos', '', ...summary.warnings.map((w) => `- ⚠️ ${w}`))
  }

  return lines.join('\n')
}

/** Embudo en texto, para el registro de la consola. */
export function renderFunnelText(funnel: readonly FunnelStage[]): string {
  const width = Math.max(...funnel.map((s) => s.name.length), 10)
  return funnel
    .map((s) => `  ${s.name.padEnd(width)}  ${String(s.count).padStart(5)}${s.note ? `  ${s.note}` : ''}`)
    .join('\n')
}
