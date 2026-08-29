// src/review/manifest.ts
// El manifiesto del día y el cuerpo del PR (§10.1, §10.2).
//
// El manifiesto es la corrección clave respecto al primer diseño, que deducía lo
// vetado LEYENDO EL CUERPO DEL PR. Eso era frágil: basta que alguien edite el
// texto del PR, o que un título lleve un carácter raro, para que el veto se
// pierda y la ficha vuelva a proponerse —y a pagarse— al día siguiente. Un
// manifiesto es un archivo versionado, no una cadena que haya que interpretar.
import type { CuratedEvent } from '../../contracts/curated'
import type { ProposalManifest, SpendLedger } from '../types'
import { priceLabel } from '../normalize/price'
import { PROMPT_VERSION } from '../core/hash'

export interface ProposalEntry {
  readonly event: CuratedEvent
  readonly kind: 'new' | 'modified'
  readonly changes?: readonly string[] | undefined
  readonly warnings?: readonly string[] | undefined
}

export interface ManifestInput {
  readonly date: string
  readonly runCostEur: number
  readonly proposals: readonly ProposalEntry[]
  readonly discarded: readonly { readonly slug: string; readonly reason: string }[]
}

export function buildManifest(input: ManifestInput): ProposalManifest {
  return {
    date: input.date,
    promptVersion: PROMPT_VERSION.write,
    runCostEur: round2(input.runCostEur),
    proposed: input.proposals.map((p) => ({
      slug: p.event.curated.slug,
      collection: p.event.curated.collection,
      kind: p.kind,
      score: p.event.curated.score,
    })),
    discarded: input.discarded.map((d) => ({ slug: d.slug, reason: d.reason })),
  }
}

/**
 * Reconciliación: PROPUESTO MENOS PRESENTE = VETADO. Una resta trivial y sin
 * ambigüedad, que es exactamente lo que se buscaba al inventar el manifiesto.
 */
export function computeVetoes(
  manifest: ProposalManifest,
  presentSlugs: ReadonlySet<string>,
): { slug: string; collection: ProposalManifest['proposed'][number]['collection'] }[] {
  return manifest.proposed
    .filter((p) => !presentSlugs.has(p.slug))
    .map((p) => ({ slug: p.slug, collection: p.collection }))
}

const COLLECTION_LABEL = { plans: 'plans', shows: 'shows', museums: 'museums' } as const

/**
 * El cuerpo del PR, pensado para decidir en 30 segundos. La sección de
 * descartadas importa tanto como la de propuestas: es donde el propietario
 * detecta que el criterio se está torciendo, y es gratis (el motivo ya venía en
 * el cribado).
 */
export function renderPrBody(
  input: ManifestInput,
  ledger: SpendLedger,
  discardedDetail: readonly { readonly title: string; readonly reason: string }[] = [],
): string {
  const nuevas = input.proposals.filter((p) => p.kind === 'new')
  const modificadas = input.proposals.filter((p) => p.kind === 'modified')

  const lines: string[] = [
    `## Propuesta del ${formatDateEs(input.date)}`,
    '',
    `**${nuevas.length} fichas nuevas · ${modificadas.length} modificadas · ${input.discarded.length} descartadas**`,
    `Coste de esta ejecución: ${round2(input.runCostEur).toFixed(2)} € · ` +
      `Gasto del mes: ${ledger.spentEur.toFixed(2)} € de ${ledger.budgetEur.toFixed(2)} €`,
    '',
    '---',
  ]

  for (const p of nuevas) {
    lines.push(...renderNewCard(p))
    lines.push('---')
  }

  for (const p of modificadas) {
    const c = p.event.curated
    lines.push(
      `### ♻️ MODIFICADA · ${p.event.title}`,
      `**Cambió:** ${(p.changes ?? ['datos estructurados']).join(', ')}`,
      `\`content/cards/${COLLECTION_LABEL[c.collection]}/${c.slug}.json\``,
      '',
      '---',
    )
  }

  if (discardedDetail.length > 0) {
    lines.push(
      `### ❌ DESCARTADAS HOY (${discardedDetail.length})`,
      '',
      '| Título | Motivo |',
      '|---|---|',
      ...discardedDetail.map((d) => `| ${escapePipes(d.title)} | ${escapePipes(d.reason)} |`),
      '',
    )
  }

  lines.push(
    '---',
    '',
    '**Cómo se revisa esto:** mergear aprueba todo. Borrar el archivo de una ficha',
    'desde la interfaz web del PR y mergear publica el resto y **veta esa ficha**.',
    'Cerrar el PR sin mergear veta todo lo propuesto. Nunca se auto-mergea.',
  )

  return lines.join('\n')
}

function renderNewCard(p: ProposalEntry): string[] {
  const e = p.event
  const c = e.curated
  const v = e.venue

  const practical: string[] = []
  if (c.practical.durationMinutes) practical.push(`⏱ ${c.practical.durationMinutes} min`)
  if (c.practical.booking) {
    const lead = c.practical.bookingLeadDays
    practical.push(`🎟 reserva ${c.practical.booking}${lead ? `, ${lead} días antes` : ''}`)
  }
  if (c.practical.activityLang?.includes('sin-idioma')) practical.push('🗣 no hace falta idioma')
  else if (c.practical.activityLang?.length) {
    practical.push(`🗣 en ${c.practical.activityLang.join(', ')}`)
  }

  const verified = c.verified
  const ok = (['price', 'dates', 'location'] as const).filter((k) => verified[k])
  const missing = (['price', 'schedule', 'dates', 'location'] as const).filter((k) => !verified[k])

  const lines = [
    `### ✨ NUEVA · ${e.title}`,
    `**Puntuación ${c.score}** · ${c.collection} · ${c.temporality} · ` +
      `${v.district ?? v.neighborhood ?? 'sin barrio'} · ${priceLabel(e.price)} · ` +
      `avalado por ${c.consensus.sourceCount} ${c.consensus.sourceCount === 1 ? 'fuente' : 'fuentes'}`,
    '',
    `> ${c.whyWorthIt.es}`,
    '',
  ]

  if (practical.length > 0) lines.push(`- ${practical.join(' · ')}`)
  if (c.practical.transit?.es) lines.push(`- 🚇 ${c.practical.transit.es}`)
  lines.push(
    `- ${ok.length > 0 ? `✅ ${ok.join(', ')} verificados` : '⚠️ sin verificaciones'}` +
      (missing.length > 0 ? ` · ⚠️ sin ${missing.join(', ')} (no había evidencia)` : ''),
  )
  lines.push(
    `- 🔗 ${c.provenance.map((pr) => `[${pr.publisher}](${pr.url})`).join(' · ')}`,
  )
  lines.push(
    e.image ? `- 🖼 Imagen propia: ${e.imageCredit ?? 'sin crédito'}` : '- 🖼 Sin imagen propia: planonmap usará su cascada',
  )

  if (p.warnings?.length) {
    lines.push(`- ⚠️ ${p.warnings.join(' · ')}`)
  }

  lines.push(
    '',
    '<details><summary>Texto completo (ES / EN)</summary>',
    '',
    `**ES** — ${e.description}`,
    '',
    `**EN** — ${e.i18n?.description?.en ?? '(sin versión en inglés)'}`,
    '',
    '</details>',
    '',
  )

  return lines
}

function formatDateEs(iso: string): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} de ${months[m - 1]} de ${y}`
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
