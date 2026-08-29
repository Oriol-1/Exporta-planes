// src/cli/veto.ts
// `pnpm veto <slug> "<motivo>"` — veta una ficha y la retira en la siguiente
// publicación (§10.3, salida 1).
//
// Vetar es PARA SIEMPRE, salvo que se borre la entrada a mano de
// content/vetoed.json. El motivo se guarda para que dentro de seis meses se
// sepa por qué.
import { addVeto, cardExists, deleteCard, readVetoes } from '../store/content'
import { ALL_COLLECTIONS } from '../store/paths'
import { baseContext } from './env'
import { fail, hasFlag, log, parseArgs } from './args'
import { madridDayString } from '../core/clock'
import type { CuratedCollection } from '../../contracts/curated'

async function main(): Promise<void> {
  const args = parseArgs()
  const [slug, ...rest] = args.positionals
  if (!slug) {
    fail('Uso: pnpm veto <slug> "<motivo>"   ·   pnpm veto --list   ·   pnpm veto --undo <slug>')
  }

  const ctx = baseContext()
  const today = madridDayString(ctx.clock.now())

  if (hasFlag(args, 'list')) {
    for (const v of await readVetoes()) log(`${v.date}  ${v.slug.padEnd(40)} ${v.reason}`)
    return
  }

  let collection: CuratedCollection | null = null
  for (const c of ALL_COLLECTIONS) {
    if (await cardExists(c, slug)) collection = c
  }

  const reason = rest.join(' ') || 'veto-manual'
  await addVeto({
    slug,
    collection: collection ?? 'plans',
    date: today,
    reason,
  })

  if (collection) {
    await deleteCard(collection, slug)
    log(`Vetado ${slug} (${collection}) y retirado de content/cards/.`)
  } else {
    log(`Vetado ${slug}. No había ficha publicada: no volverá a proponerse.`)
  }
  log(`Motivo: ${reason}`)
}

await main()
