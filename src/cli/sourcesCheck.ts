// src/cli/sourcesCheck.ts
// `pnpm sources:check` — recomprueba robots.txt y `verifiedAt` de todas las
// fuentes (§3.5, §12.1).
//
// La revisión legal caduca a los 180 días. Este comando es el que avisa antes de
// que una fuente lleve un año rastreándose con condiciones que nadie ha vuelto a
// leer.
import { VERIFICATION_MAX_AGE_DAYS } from '../../config/index'
import { daysBetween } from '../core/clock'
import { crawlContext } from './env'
import { hasFlag, log, parseArgs } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const offline = hasFlag(args, 'offline')
  const ctx = crawlContext(offline)
  const now = ctx.clock.now()

  log('Fuente                  Nivel  Verificada   Edad   robots.txt')
  log('─'.repeat(72))

  for (const source of ctx.config.allSources) {
    const age = source.verifiedAt
      ? daysBetween(new Date(`${source.verifiedAt}T00:00:00Z`), now)
      : null

    let robots = offline ? '(sin red)' : '—'
    if (!offline && source.home) {
      const url = new URL('/robots.txt', source.home).href
      const body = await ctx.fetcher.getPlain(url, source.crawlDelayMs)
      if (body === null) robots = 'no accesible'
      else {
        const delay = /crawl-delay:\s*(\d+)/i.exec(body)?.[1]
        robots = delay ? `Crawl-delay: ${delay}s` : `${body.split('\n').length} líneas`
      }
    }

    const state =
      age === null ? '❌ SIN VERIFICAR' : age > VERIFICATION_MAX_AGE_DAYS ? '⚠️  CADUCADA' : '✅'

    log(
      `${source.id.padEnd(23)} ${source.tier}      ` +
        `${(source.verifiedAt ?? '—').padEnd(12)} ${String(age ?? '—').padStart(4)}   ${robots}`,
    )
    if (state !== '✅') log(`  ${state}  → revisa robots.txt y condiciones, y anótalo en SOURCES.md`)
  }

  const unverified = ctx.config.allSources.filter((s) => !s.verifiedAt)
  log('')
  log(
    `${ctx.config.activeSources.length} de ${ctx.config.allSources.length} fuentes se rastrean. ` +
      `${unverified.length} sin verificar se OMITEN en silencio.`,
  )
}

await main()
