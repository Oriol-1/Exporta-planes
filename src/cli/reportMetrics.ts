// src/cli/reportMetrics.ts
// `pnpm report:metrics` — precisión editorial, coste por ficha y cobertura por
// barrio (§5.5).
//
// La etiqueta de verdad es gratis: mergear es «acierto», borrar el archivo del
// PR es «fallo». Este comando solo hace la cuenta.
import { computeMetrics, formatMetrics, funnelCounts, proposeTrustAdjustments } from '../report/metrics'
import { readText, writeText } from '../store/fs'
import { WEEKLY_REPORT_FILE } from '../store/paths'
import { baseContext } from './env'
import { log, numberArg, parseArgs } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const ctx = baseContext()
  const now = ctx.clock.now()

  const metrics = await computeMetrics(now, numberArg(args, 'months', 1))
  const proposals = proposeTrustAdjustments(metrics, ctx.config.allSources)
  const text = formatMetrics(metrics, proposals)

  const funnel = await funnelCounts(now)
  const funnelText = [
    '',
    '## Embudo del mes',
    '',
    ...Object.entries(funnel)
      .sort()
      .map(([stage, n]) => `- \`${stage}\`: ${n}`),
  ].join('\n')

  // El informe semanal es UNA incidencia: salud y métricas se concatenan para
  // que el propietario lea un solo texto.
  const existing = (await readText(WEEKLY_REPORT_FILE)) ?? ''
  await writeText(WEEKLY_REPORT_FILE, `${existing}\n\n---\n\n${text}${funnelText}\n`)

  log(text)
  log(funnelText)
}

await main()
