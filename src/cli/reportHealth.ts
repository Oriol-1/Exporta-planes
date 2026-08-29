// src/cli/reportHealth.ts
// `pnpm report:health` — enlaces muertos, fuentes degradadas y verificaciones
// caducadas (§A.9, health.yml, los lunes).
//
// Envejecimiento silencioso: fichas correctas que dejan de serlo. Esta es la
// comprobación que lo caza (§12.4).
import { buildHealthReport, formatHealthReport, type DeadLink } from '../report/health'
import { readAllCards } from '../store/content'
import { writeText } from '../store/fs'
import { WEEKLY_REPORT_FILE } from '../store/paths'
import { crawlContext } from './env'
import { hasFlag, log, parseArgs } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const offline = hasFlag(args, 'offline')
  const ctx = crawlContext(offline)
  const now = ctx.clock.now()

  const { cards } = await readAllCards()
  const deadLinks: DeadLink[] = []

  if (!offline) {
    log(`Comprobando ${cards.length} enlaces oficiales…`)
    for (const card of cards) {
      const url = card.event.officialUrl ?? card.event.sourceUrl
      if (!url) continue
      const body = await ctx.fetcher.getPlain(url, 1200)
      // getPlain devuelve null en cualquier fallo; para el informe basta con
      // señalar el enlace y que una persona lo mire.
      if (body === null) deadLinks.push({ slug: card.slug, url, status: 0 })
    }
  }

  const report = await buildHealthReport(ctx.config.allSources, deadLinks, now)
  const text = formatHealthReport(report)

  await writeText(WEEKLY_REPORT_FILE, text + '\n')
  log('')
  log(text)
}

await main()
