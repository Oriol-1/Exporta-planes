// src/cli/archive.ts
// `pnpm archive <slug>` — retira SIN vetar (§3.7).
//
// Archivado, no borrado: si el montaje vuelve la temporada siguiente se reactiva
// sin volver a pagar la redacción. Solo se actualizan fechas y precio, que es
// extracción determinista.
import { archiveCard, cardExists, restoreCard, listArchivedSlugs } from '../store/content'
import { ALL_COLLECTIONS } from '../store/paths'
import { fail, hasFlag, log, parseArgs, stringArg } from './args'
import type { CuratedCollection } from '../../contracts/curated'

async function main(): Promise<void> {
  const args = parseArgs()

  if (hasFlag(args, 'list')) {
    for (const slug of await listArchivedSlugs()) log(slug)
    return
  }

  const [slug] = args.positionals
  if (!slug) {
    fail('Uso: pnpm archive <slug>   ·   pnpm archive --restore <slug> --collection museums   ·   pnpm archive --list')
  }

  if (hasFlag(args, 'restore') || args.values.has('restore')) {
    const target = stringArg(args, 'collection', 'plans') as CuratedCollection
    const restored = await restoreCard(slug, target)
    if (!restored) fail(`No hay ninguna ficha archivada con el slug ${slug}.`)
    log(`Restaurado ${slug} en ${target}. No se ha vuelto a pagar la redacción.`)
    return
  }

  for (const collection of ALL_COLLECTIONS) {
    if (await cardExists(collection, slug)) {
      await archiveCard(collection, slug)
      log(`Archivado ${slug} desde ${collection}. Puede volver con --restore.`)
      return
    }
  }

  fail(`No hay ninguna ficha publicada con el slug ${slug}.`)
}

await main()
