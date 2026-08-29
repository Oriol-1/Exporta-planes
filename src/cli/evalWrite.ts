// src/cli/evalWrite.ts
// `pnpm eval:write` — comprobaciones MECÁNICAS de la redacción (§5.7).
//
// No juzga el estilo —eso lo hace una persona— pero CAZA LAS REGRESIONES
// OBJETIVAS: que ningún 8-grama coincide con el material, que todas las
// evidencias son subcadenas literales, que ES y EN están dentro de las
// longitudes, y que ningún término prohibido aparece.
//
// Coste: 0 €. No llama a ningún modelo: relee fichas ya aceptadas.
import type { WrittenCard } from '../types'
import { checkCopy, checkLengths, checkParity, findBannedTerms } from '../enrich/verify'
import { isLiteralSubstring } from '../core/text'
import { EVAL_WRITE_GOLDEN, evalReportFile } from '../store/paths'
import { readText, writeText } from '../store/fs'
import { PROMPT_VERSION } from '../core/hash'
import { fail, log } from './args'

interface GoldenWriteRow {
  readonly id: string
  readonly material: string
  readonly card: WrittenCard
}

interface RowResult {
  readonly id: string
  readonly problems: readonly string[]
}

async function readGolden(): Promise<GoldenWriteRow[]> {
  const raw = await readText(EVAL_WRITE_GOLDEN)
  if (raw === null) {
    fail(`No existe ${EVAL_WRITE_GOLDEN}. Guarda 8 fichas aceptadas con su material.`)
  }
  const rows: GoldenWriteRow[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    rows.push(JSON.parse(line) as GoldenWriteRow)
  }
  return rows
}

function checkRow(row: GoldenWriteRow): RowResult {
  const problems: string[] = []

  // 1 · Ningún 8-grama de palabras compartido con el material.
  const copy = checkCopy(row.card, row.material)
  if (!copy.clean) {
    problems.push(`copia literal: «${copy.shared[0] ?? ''}»`)
  }

  // 2 · Toda evidencia debe ser subcadena literal del material.
  for (const ev of row.card.evidencias ?? []) {
    if (!isLiteralSubstring(ev.fragmento, row.material)) {
      problems.push(`evidencia inventada en «${ev.campo}»: «${ev.fragmento.slice(0, 60)}»`)
    }
  }

  // 3 · Longitudes dentro de lo pedido.
  problems.push(...checkLengths(row.card))

  // 4 · Paridad ES/EN.
  const parity = checkParity(row.card)
  if (parity) problems.push(parity)

  // 5 · Términos de folleto.
  const banned = findBannedTerms(row.card)
  if (banned.length > 0) problems.push(`términos prohibidos: ${banned.join(', ')}`)

  return { id: row.id, problems }
}

async function main(): Promise<void> {
  const rows = await readGolden()
  log(`Comprobando ${PROMPT_VERSION.write} sobre ${rows.length} fichas doradas. Coste: 0 €.\n`)

  const results = rows.map(checkRow)
  const failing = results.filter((r) => r.problems.length > 0)

  const report = [
    `# Evaluación de la redacción · ${PROMPT_VERSION.write}`,
    '',
    `${rows.length - failing.length} de ${rows.length} fichas sin regresiones objetivas.`,
    '',
    '| Ficha | Problemas |',
    '|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.problems.length === 0 ? '✅ ninguno' : r.problems.join(' · ')} |`),
    '',
    '> Estas comprobaciones no juzgan el estilo: eso lo hace una persona en el PR.',
    '> Cazan lo que se puede comprobar sin juicio, que es donde aparecen las',
    '> regresiones cuando se toca un prompt.',
  ].join('\n')

  await writeText(evalReportFile('write'), report + '\n')
  log(report)

  if (failing.length > 0) {
    fail(`\n❌ ${failing.length} fichas con regresiones objetivas.`)
  }
  log('\n✅ Sin regresiones objetivas.')
}

await main()
