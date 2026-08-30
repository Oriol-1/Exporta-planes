// src/cli/publishBuild.ts
// `pnpm publish:build` — regenera `dist/v1/*.json` desde `content/` (§9.2).
//
// `dist/` NO se commitea: se sube como artefacto de Pages. `content/` es el
// producto; `dist/` es una proyección, y tener las dos versionadas invitaría a
// que divergieran.
import { build, formatBuildReport, InvalidBaseUrlError } from '../publish/build'
import { baseContext } from './env'
import { fail, hasFlag, log, parseArgs, stringArg } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const ctx = baseContext()
  const dryRun = hasFlag(args, 'dry-run')

  let report
  try {
    report = await build({
      now: ctx.clock.now(),
      nowIso: ctx.clock.nowIso(),
      baseUrl: stringArg(args, 'base-url', ctx.env.publishBaseUrl),
      producerVersion: ctx.env.producerVersion,
      dryRun,
      archiveExpired: hasFlag(args, 'archive-expired'),
    })
  } catch (e) {
    // Un error de configuración merece un mensaje, no un volcado de pila.
    if (e instanceof InvalidBaseUrlError) fail(`\n${e.message}`)
    throw e
  }

  log(formatBuildReport(report))

  if (report.index === null) {
    // Una colección ausente significa «todavía no se publica», no «está vacía»
    // (§A.3). Pero un índice vacío no es publicable: no hay nada que servir.
    fail(
      '\nNo hay ninguna colección con fichas: no se puede construir el índice.\n' +
        'Escribe al menos una ficha en content/cards/ y vuelve a intentarlo.',
    )
  }

  if (dryRun) log('\n(en seco: no se escribió nada en dist/)')
  else log(`\ndist/v1/ listo · base ${report.baseUrl}`)
}

await main()
