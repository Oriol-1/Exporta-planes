// src/cli/curate.ts
// UN SOLO VERBO, con parámetros (§14.5). Antes había dos comandos casi iguales
// (`crawl:plans` y `crawl:museums`) que compartían el 90 % del código y podían
// divergir.
//
//   pnpm curate --phase submit --collection plans,shows
//   pnpm curate --phase collect
//   pnpm curate --dry-run                  ← el más importante de la lista
//   pnpm curate --limit 5
//   pnpm curate --reprocess <slug…>
//
// `--dry-run` rastrea, criba y SE PARA ANTES DE LLAMAR A NINGÚN MODELO. Imprime
// qué habría enviado y cuánto habría costado, que es justo lo que hace falta ver
// para afinar prompts, umbrales y adaptadores durante horas sin gastar un céntimo.
import { collectionsArg, hasFlag, log, numberArg, parseArgs, stringArg } from './args'
import { crawlContext } from './env'
import { runSubmit } from '../pipeline/submit'
import { runCollect } from '../pipeline/collect'
import { buildManifest, renderPrBody } from '../review/manifest'
import { writeManifest } from '../store/content'
import { BudgetGuard, estimateCost } from '../ai/budget'
import { estimateBatch } from '../ai/batch'
import { writeRunSummary } from '../store/cache'
import { renderFunnelText, renderRunSummary, type RunSummary } from '../report/summary'
import { madridDayString } from '../core/clock'
import { TOKEN_ESTIMATES } from '../../config/budget'

async function main(): Promise<void> {
  const args = parseArgs()
  const phase = stringArg(args, 'phase', 'submit') as 'submit' | 'collect'
  const dryRun = hasFlag(args, 'dry-run') || hasFlag(args, 'dryRun')
  const limit = numberArg(args, 'limit', 0)
  const collections = collectionsArg(args, ['plans', 'shows'])

  const ctx = crawlContext(false)
  const now = ctx.clock.now()
  const today = madridDayString(now)

  for (const warning of ctx.config.warnings) {
    log(`⚠️  ${warning.scope} ${warning.id}: ${warning.message}`)
  }

  if (phase === 'collect') {
    await runCollectPhase(ctx, dryRun, today)
    return
  }

  // ── FASE SUBMIT ───────────────────────────────────────────────────────────
  log(`\nFase submit · ${collections.join(', ')}${dryRun ? ' · EN SECO' : ''}\n`)

  const report = await runSubmit({
    config: ctx.config,
    clock: ctx.clock,
    fetcher: ctx.fetcher,
    collections,
    limit,
    dryRun,
  })

  const funnel = [
    { name: 'URL descubiertas', count: report.discovered },
    { name: 'descargadas', count: report.fetched, note: `${report.notModified} sin cambios (304)` },
    { name: 'candidatos', count: report.candidates },
    { name: 'clusters', count: report.clusters },
    { name: 'cribados', count: report.screened, note: `${report.cachedVerdicts} desde caché` },
    { name: 'seleccionados', count: report.selected.length },
    { name: 'a redactar', count: report.jobs.length },
  ]

  log(renderFunnelText(funnel))
  log()

  for (const [reason, n] of Object.entries(report.prefilterReasons)) {
    log(`  descarte · ${reason.padEnd(28)} ${n}`)
  }

  if (dryRun) {
    // Lo que hace útil el modo seco: el coste que se habría pagado.
    const guard = await BudgetGuard.load(ctx.config.budget, now)
    const screenEstimate = estimateCost(
      ctx.config.budget,
      ctx.config.budget.screenModel,
      report.screened * TOKEN_ESTIMATES.screenPerCandidateTokens,
      Math.ceil(report.screened / ctx.config.budget.screenBatchSize) *
        TOKEN_ESTIMATES.screenOutputPerBatch,
    )
    const writeEstimate = estimateBatch(report.jobs, ctx.config.budget, ctx.config.budget.writerModel)

    log('\n── EN SECO · no se llamó a ningún modelo ──')
    log(`  cribado estimado:   ${screenEstimate.eur.toFixed(4)} €`)
    log(`  redacción estimada: ${writeEstimate.eur.toFixed(4)} €`)
    log(`  TOTAL estimado:     ${(screenEstimate.eur + writeEstimate.eur).toFixed(4)} €`)
    log(`  gasto del mes:      ${guard.spentEur.toFixed(2)} € de ${guard.budgetEur.toFixed(2)} €`)
    log('\n  Fichas que se habrían redactado:')
    for (const job of report.jobs) log(`    · ${job.slug} (${job.cluster.collection})`)
  }

  const summary: RunSummary = {
    phase: 'submit',
    collections,
    dryRun,
    startedAt: ctx.clock.nowIso(),
    funnel,
    prefilterReasons: report.prefilterReasons,
    written: [],
    discarded: report.discarded.map((d) => ({ slug: d.slug, reason: d.reason })),
    warnings: report.warnings,
    costEur: report.costEur,
    ...(report.batch ? { batchId: report.batch.id } : {}),
  }
  await writeRunSummary(renderRunSummary(summary))

  if (report.batch) {
    log(`\n✅ Lote ${report.batch.id} enviado. Se recoge en la fase collect.`)
  } else if (!dryRun) {
    log('\nNada que enviar al redactor en esta ejecución.')
  }

  for (const warning of report.warnings) log(`⚠️  ${warning}`)
}

async function runCollectPhase(
  ctx: ReturnType<typeof crawlContext>,
  dryRun: boolean,
  today: string,
): Promise<void> {
  log('\nFase collect\n')

  const report = await runCollect({ config: ctx.config, clock: ctx.clock, dryRun })

  if (!report.ready) {
    // SIN PÉRDIDAS: si el lote no está listo, se sale con ÉXITO y sin tocar
    // nada. Los reintentos de las 10:30 y 14:30 lo recogen (§7.2 ter).
    for (const w of report.warnings) log(`  ${w}`)
    log('\nSalida limpia: no había nada que recoger.')
    await writeRunSummary(
      renderRunSummary({
        phase: 'collect',
        collections: [],
        dryRun,
        startedAt: ctx.clock.nowIso(),
        funnel: [{ name: 'lotes consultados', count: report.batchesChecked }],
        prefilterReasons: {},
        written: [],
        discarded: [],
        warnings: report.warnings,
        costEur: 0,
      }),
    )
    return
  }

  log(`  fichas escritas:   ${report.proposals.length}`)
  log(`  descartadas:       ${report.discarded.length}`)
  log(`  para revisar a mano: ${report.needsHuman.length}`)

  const guard = await BudgetGuard.load(ctx.config.budget, ctx.clock.now())
  const manifestInput = {
    date: today,
    runCostEur: report.costEur,
    proposals: report.proposals,
    discarded: [
      ...report.discarded.map((d) => ({ slug: d.slug, reason: d.reason })),
      ...report.needsHuman.map((d) => ({ slug: d.slug, reason: d.reason })),
    ],
  }

  if (!dryRun) {
    // El manifiesto es lo que hace posible la reconciliación: propuesto menos
    // presente = vetado. Sin él, un veto se perdería (§10.1).
    await writeManifest(buildManifest(manifestInput))
  }

  const body = renderPrBody(
    manifestInput,
    guard.snapshot(),
    report.discarded.map((d) => ({ title: d.title, reason: d.reason })),
  )

  await writeRunSummary(
    renderRunSummary({
      phase: 'collect',
      collections: [...new Set(report.proposals.map((p) => p.event.curated.collection))],
      dryRun,
      startedAt: ctx.clock.nowIso(),
      funnel: [
        { name: 'lotes consultados', count: report.batchesChecked },
        { name: 'fichas escritas', count: report.proposals.length },
        { name: 'descartadas', count: report.discarded.length },
      ],
      prefilterReasons: {},
      written: report.proposals.map((p) => p.event.curated.slug),
      discarded: manifestInput.discarded,
      warnings: report.warnings,
      costEur: report.costEur,
      ledger: guard.snapshot(),
    }),
  )

  log('\n── Cuerpo del PR ──\n')
  log(body)
}

await main()
