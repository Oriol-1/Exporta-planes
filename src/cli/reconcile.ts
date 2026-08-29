// src/cli/reconcile.ts
// `pnpm review:reconcile` — tras cerrarse el PR, manifiesto contra lo publicado
// → vetos (§10.1).
//
// Lo lanza reconcile.yml con PR_NUMBER y PR_MERGED en el entorno.
import { latestManifestDate, reconcile, formatReconcileReport } from '../review/reconcile'
import { commitAll, configureBotIdentity, git, pushWithRebase } from '../review/git'
import { madridDayString } from '../core/clock'
import { baseContext } from './env'
import { log, parseArgs, stringArg } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const ctx = baseContext()
  const today = madridDayString(ctx.clock.now())

  const date = stringArg(args, 'date', (await latestManifestDate()) ?? today)
  const merged =
    stringArg(args, 'merged', process.env['PR_MERGED'] ?? 'true').toLowerCase() === 'true'

  log(`Reconciliando el manifiesto del ${date} (PR ${merged ? 'mergeado' : 'cerrado sin mergear'}).\n`)

  const report = await reconcile({ date, merged, today })
  log(formatReconcileReport(report))

  if (report.vetoed.length === 0) {
    log('\nSin vetos que registrar.')
    return
  }

  // Los vetos entran por una rama, como todo lo demás: nada se empuja a main
  // directamente (§3.6, regla 3).
  const branch = `mantenimiento/vetos-${today}`
  await configureBotIdentity()
  await git('checkout', '-B', branch)
  await commitAll(
    `chore: registra ${report.vetoed.length} veto(s) del PR del ${date}\n\n` +
      report.vetoed.map((v) => `- ${v.slug} (${v.collection})`).join('\n'),
  )
  const pushed = await pushWithRebase(branch)
  log(pushed.ok ? `\nVetos empujados a ${branch}.` : `\nNo se pudo empujar: ${pushed.stderr}`)
}

await main()
