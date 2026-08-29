// src/cli/reviewPr.ts
// `pnpm review:pr` — empuja la rama de propuesta y abre o actualiza el PR (§10.1).
//
// EL PULL REQUEST ES EL PANEL. No se construye ninguna interfaz: la revisión
// editorial se hace con una herramienta que ya existe, es gratis, funciona desde
// el móvil y guarda historial.
//
//   --only-state  → la fase `submit` solo guarda el lote pendiente en la rama.
import { commitAll, configureBotIdentity, checkoutBranch, ghAvailable, openOrUpdatePr, proposalBranch, pushWithRebase } from '../review/git'
import { readManifest } from '../store/content'
import { readLedger, readPendingBatches } from '../store/cache'
import { renderPrBody } from '../review/manifest'
import { madridDayString } from '../core/clock'
import { baseContext } from './env'
import { hasFlag, log, parseArgs, stringArg } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const ctx = baseContext()
  const today = stringArg(args, 'date', madridDayString(ctx.clock.now()))
  const branch = proposalBranch(today)
  const onlyState = hasFlag(args, 'only-state')

  await configureBotIdentity()
  await checkoutBranch(branch)

  if (onlyState) {
    // En `submit` solo se guarda el identificador del lote pendiente: todavía no
    // hay fichas que revisar, así que no se abre ningún PR.
    const pending = await readPendingBatches()
    const committed = await commitAll(
      `chore: lote de redacción pendiente (${pending.length}) del ${today}`,
    )
    log(committed.stdout || committed.stderr)
    const pushed = await pushWithRebase(branch)
    log(pushed.ok ? `Estado guardado en ${branch}.` : `No se pudo empujar: ${pushed.stderr}`)
    return
  }

  const manifest = await readManifest(today)
  if (!manifest) {
    log(`No hay manifiesto para el ${today}: nada que proponer.`)
    return
  }

  const ledger = (await readLedger(today.slice(0, 7))) ?? {
    month: today.slice(0, 7),
    budgetEur: ctx.config.budget.monthlyBudgetEur,
    spentEur: 0,
    byModel: {},
    calls: [],
  }

  // El cuerpo se reconstruye del manifiesto: es el archivo versionado, no una
  // cadena de texto que haya que interpretar (§10.1).
  const body = renderPrBody(
    {
      date: manifest.date,
      runCostEur: manifest.runCostEur,
      proposals: [],
      discarded: [...manifest.discarded],
    },
    ledger,
    manifest.discarded.map((d) => ({ title: d.slug, reason: d.reason })),
  )

  const nuevas = manifest.proposed.filter((p) => p.kind === 'new').length
  const modificadas = manifest.proposed.length - nuevas
  const title = `Propuesta del ${today} · ${nuevas} nuevas, ${modificadas} modificadas`

  const committed = await commitAll(
    `feat: ${manifest.proposed.length} fichas propuestas el ${today}\n\n` +
      manifest.proposed.map((p) => `- ${p.kind}: ${p.slug} (${p.collection}, ${p.score})`).join('\n'),
  )
  log(committed.stdout || committed.stderr)

  const pushed = await pushWithRebase(branch)
  if (!pushed.ok) {
    log(`No se pudo empujar la rama: ${pushed.stderr}`)
    return
  }

  if (!(await ghAvailable())) {
    log('`gh` no está autenticado: la rama está empujada, abre el PR a mano.')
    log(`\n── Cuerpo sugerido ──\n${body}`)
    return
  }

  // UN PR ABIERTO COMO MÁXIMO: si ya hay uno sin revisar, se le añaden los
  // cambios en vez de abrir otro.
  const pr = await openOrUpdatePr(branch, title, body)
  log(pr.ok ? `PR listo: ${pr.stdout}` : `No se pudo abrir el PR: ${pr.stderr}`)
}

await main()
