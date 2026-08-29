// src/cli/spend.ts
// `pnpm spend` — gasto del mes y desglose por modelo y por tarea (§7.6).
//
// Es donde se ven el mismo día las cuatro cosas que harían saltar las cifras:
// subir la versión de un prompt sin --reprocess acotado, añadir el catalán como
// tercer idioma, subir el `effort` de la redacción, o que la caché deje de
// acertar por haber vuelto a indexar por el hash del HTML.
import { readLedger } from '../store/cache'
import { formatLedger } from '../ai/budget'
import { madridMonthString } from '../core/clock'
import { baseContext } from './env'
import { log, parseArgs, stringArg } from './args'

async function main(): Promise<void> {
  const args = parseArgs()
  const ctx = baseContext()
  const month = stringArg(args, 'month', madridMonthString(ctx.clock.now()))

  const ledger = await readLedger(month)
  if (!ledger) {
    log(`Sin gasto registrado en ${month}. Coste: 0,00 €.`)
    return
  }

  log(formatLedger(ledger))

  const remaining = ledger.budgetEur - ledger.spentEur
  const pct = (ledger.spentEur / ledger.budgetEur) * 100
  log('')
  log(`Queda ${remaining.toFixed(2)} € (${(100 - pct).toFixed(0)} % del tope).`)
  if (pct >= 70) log('⚠️  Por encima del 70 % del tope.')
  if (remaining <= 0) {
    log('⛔ Tope alcanzado: no se llamará a ningún modelo, pero la publicación sigue.')
  }
}

await main()
