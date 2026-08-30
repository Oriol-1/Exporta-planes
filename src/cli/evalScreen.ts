// src/cli/evalScreen.ts
// `pnpm eval:screen` — ¿el cambio de prompt mejora o empeora? (§5.7).
//
// Las métricas del §5.5 miden el sistema en producción y a semanas vista. Eso es
// imprescindible, pero llega tarde para la pregunta que uno se hace de verdad:
// «acabo de reescribir el prompt, ¿está mejor o peor?». Sin una respuesta, los
// prompts se afinan por intuición y la calidad deriva sin que nadie lo note, que
// es el modo habitual de fallar de estos sistemas.
//
// Coste: menos de un céntimo por pasada.
import type { ScreenVerdict } from '../types'
import { HARD_VETOES } from '../../config/scoring'
import { BudgetGuard } from '../ai/budget'
import { openai } from '../ai/clients'
import { withRetry } from '../ai/retry'
import { SCREEN_JSON_SCHEMA, SCREEN_SYSTEM_PROMPT, chunk } from '../screen/llmScreen'
import { llmPoints } from '../screen/score'
import { EVAL_SCREEN_GOLDEN, evalReportFile } from '../store/paths'
import { readText, writeText } from '../store/fs'
import { PROMPT_VERSION } from '../core/hash'
import { baseContext } from './env'
import { fail, hasFlag, log, parseArgs } from './args'

interface GoldenRow {
  readonly id: string
  readonly material: string
  readonly label: 'aceptar' | 'rechazar'
  readonly expectedBand?: 'alto' | 'medio' | 'bajo'
  readonly expectedVeto?: string
  readonly notes?: string
}

/** Umbrales para aceptar un cambio de prompt (§5.7). */
export const EVAL_THRESHOLDS = {
  minCorrect: 21,
  maxFalsePositives: 1,
  maxScoreDeviation: 4,
  /** El umbral de producción: por encima, el candidato pasaría. */
  passScore: 62,
} as const

async function readGolden(): Promise<GoldenRow[]> {
  const raw = await readText(EVAL_SCREEN_GOLDEN)
  if (raw === null) fail(`No existe ${EVAL_SCREEN_GOLDEN}. Etiqueta 24 candidatos a mano primero.`)
  const rows: GoldenRow[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    rows.push(JSON.parse(line) as GoldenRow)
  }
  return rows
}

async function scoreGolden(rows: readonly GoldenRow[], model: string, maxTokens: number): Promise<Map<string, ScreenVerdict>> {
  const verdicts = new Map<string, ScreenVerdict>()

  for (const batch of chunk(rows, 12)) {
    const userPrompt = [
      'Puntúa estos candidatos. Devuelve un resultado por cada uno, con su `id`.',
      '',
      ...batch.map((r, i) => `[${i + 1}] id: ${r.id}\n${r.material}`),
    ].join('\n\n')

    const response = await withRetry(
      () =>
        openai().chat.completions.create({
          model,
          messages: [
            { role: 'system', content: SCREEN_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_schema', json_schema: SCREEN_JSON_SCHEMA },
          max_completion_tokens: maxTokens,
        }),
      {
        attempts: 6,
        onRetry: (intento, espera) =>
          log(`  (límite de ritmo · intento ${intento}, esperando ${(espera / 1000).toFixed(0)} s)`),
      },
    )

    // Un modelo que NO respeta el esquema estricto devuelve su razonamiento en
    // texto plano, y eso no puede tumbar la evaluación: es precisamente uno de
    // los resultados que la evaluación tiene que medir. Los candidatos de ese
    // lote se quedan sin veredicto y cuentan como fallo, que es lo correcto.
    const content = response.choices[0]?.message.content ?? ''
    try {
      const parsed = JSON.parse(content) as { results?: ScreenVerdict[] }
      for (const v of parsed.results ?? []) verdicts.set(v.id, v)
    } catch {
      log(
        `  ⚠️  el modelo no devolvió JSON en un lote de ${batch.length}: ` +
          `«${content.slice(0, 70).replace(/\s+/g, ' ')}…»`,
      )
    }
  }

  return verdicts
}

async function main(): Promise<void> {
  const args = parseArgs()
  const ctx = baseContext()
  const rows = await readGolden()
  const model = ctx.config.budget.screenModel

  log(`Evaluando ${PROMPT_VERSION.screen} con ${model} sobre ${rows.length} candidatos dorados.\n`)

  if (hasFlag(args, 'offline')) {
    log('Modo offline: solo se comprueba que el conjunto dorado está bien formado.')
    checkGoldenShape(rows)
    return
  }

  const guard = await BudgetGuard.load(ctx.config.budget, ctx.clock.now())
  const verdicts = await scoreGolden(rows, model, ctx.config.budget.screenMaxOutputTokens)

  let correct = 0
  let falsePositives = 0
  const vetoMisses: string[] = []
  const lines: string[] = []

  for (const row of rows) {
    const verdict = verdicts.get(row.id)
    if (!verdict) {
      lines.push(`| ${row.id} | — | sin veredicto | ❌ |`)
      continue
    }

    const points = llmPoints(verdict)
    const hasVeto = HARD_VETOES.some((v) => verdict[v])
    // Se simula el umbral con los 45 deterministas al máximo teórico medio: la
    // evaluación mide el JUICIO del modelo, no el consenso.
    const wouldPass = !hasVeto && points >= EVAL_THRESHOLDS.passScore - 30
    const predicted = wouldPass ? 'aceptar' : 'rechazar'
    const hit = predicted === row.label

    if (hit) correct++
    if (!hit && row.label === 'rechazar') falsePositives++
    if (row.expectedVeto && !verdict[row.expectedVeto as (typeof HARD_VETOES)[number]]) {
      vetoMisses.push(`${row.id}: se esperaba ${row.expectedVeto}`)
    }

    lines.push(
      `| ${row.id} | ${points} | ${predicted} (esperado ${row.label}) | ${hit ? '✅' : '❌'} |`,
    )
  }

  const report = [
    `# Evaluación del cribado · ${PROMPT_VERSION.screen}`,
    '',
    `Modelo: \`${model}\` · ${new Date(ctx.clock.nowIso()).toISOString().slice(0, 10)}`,
    '',
    '| Métrica | Resultado | Umbral | |',
    '|---|---|---|---|',
    `| Aciertos totales | ${correct} de ${rows.length} | ≥ ${EVAL_THRESHOLDS.minCorrect} | ${correct >= EVAL_THRESHOLDS.minCorrect ? '✅' : '❌'} |`,
    `| Falsos positivos | ${falsePositives} | ≤ ${EVAL_THRESHOLDS.maxFalsePositives} | ${falsePositives <= EVAL_THRESHOLDS.maxFalsePositives ? '✅' : '❌'} |`,
    `| Vetos duros fallados | ${vetoMisses.length} | 0 en casos claros | ${vetoMisses.length === 0 ? '✅' : '❌'} |`,
    '',
    '> Un falso positivo pesa más que un falso negativo: dejar fuera un buen plan',
    '> cuesta un plan; publicar una trampa turística cuesta credibilidad, que es',
    '> todo lo que tiene una guía curada.',
    '',
    '## Detalle',
    '',
    '| Candidato | Puntos LLM | Predicción | |',
    '|---|---|---|---|',
    ...lines,
  ]

  if (vetoMisses.length > 0) {
    report.push('', '## Vetos no detectados', '', ...vetoMisses.map((m) => `- ${m}`))
  }

  report.push('', `Coste de la pasada: ${guard.spentEur.toFixed(4)} € acumulados este mes.`)

  const text = report.join('\n')
  await writeText(evalReportFile('screen'), text + '\n')
  log(text)

  const passed =
    correct >= EVAL_THRESHOLDS.minCorrect &&
    falsePositives <= EVAL_THRESHOLDS.maxFalsePositives &&
    vetoMisses.length === 0

  if (!passed) {
    fail('\n❌ La evaluación NO pasa. Subir PROMPT_VERSION con esto sería un retroceso.')
  }
  log('\n✅ La evaluación pasa.')
}

function checkGoldenShape(rows: readonly GoldenRow[]): void {
  const accept = rows.filter((r) => r.label === 'aceptar').length
  const reject = rows.length - accept
  log(`  ${rows.length} filas · ${accept} aceptar · ${reject} rechazar`)
  const borderline = rows.filter((r) => r.notes?.includes('frontera')).length
  log(`  ${borderline} en la frontera — son las que de verdad discriminan`)
  for (const row of rows) {
    if (!row.material || row.material.length < 20) {
      fail(`  ❌ ${row.id}: material vacío o demasiado corto`)
    }
  }
  log('  ✅ conjunto dorado bien formado')
}

await main()
