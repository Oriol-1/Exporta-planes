// src/cli/validate.ts
// `pnpm validate` — valida `content/`, `config/` y lo publicado contra los
// esquemas. Corre en cada PR (§A.9, ci.yml) y antes de desplegar Pages.
//
// Fallar aquí es barato. Fallar en la publicación, no.
import { loadConfig } from '../../config/index'
import { CuratedEventSchema } from '../../contracts/curated'
import { CollectionFileSchema, IndexFileSchema } from '../../contracts/output'
import { readAllCards, readVetoes } from '../store/content'
import { readJson, exists } from '../store/fs'
import { ALL_COLLECTIONS, DIST_INDEX_FILE, distCollectionFile } from '../store/paths'
import { baseContext } from './env'
import { fail, log } from './args'

interface Problem {
  readonly where: string
  readonly message: string
}

async function main(): Promise<void> {
  const problems: Problem[] = []
  const warnings: string[] = []
  const ctx = baseContext()

  // ── config/ ───────────────────────────────────────────────────────────────
  try {
    const config = loadConfig(ctx.clock.now())
    log(
      `config: ${config.allSources.length} fuentes (${config.activeSources.length} activas) · ` +
        `${config.museums.length} museos`,
    )
    for (const w of config.warnings) warnings.push(`${w.scope} ${w.id}: ${w.message}`)
  } catch (e) {
    problems.push({ where: 'config/', message: e instanceof Error ? e.message : String(e) })
  }

  // ── content/ ──────────────────────────────────────────────────────────────
  const { cards, invalid } = await readAllCards()
  for (const bad of invalid) {
    problems.push({ where: `content/cards/${bad.collection}/${bad.slug}.json`, message: bad.problem })
  }
  log(`content: ${cards.length} fichas válidas, ${invalid.length} inválidas`)

  // Un slug no se reutiliza jamás (§3.7): dos colecciones no pueden compartirlo.
  const seen = new Map<string, string>()
  for (const card of cards) {
    const previous = seen.get(card.slug)
    if (previous) {
      problems.push({
        where: `content/cards/${card.collection}/${card.slug}.json`,
        message: `slug duplicado: ya existe en ${previous}. Un slug es estable de por vida y no se reutiliza.`,
      })
    }
    seen.set(card.slug, card.collection)
  }

  // Una ficha publicada Y vetada a la vez es una contradicción que hay que ver.
  const vetoed = new Set((await readVetoes()).map((v) => v.slug))
  for (const card of cards) {
    if (vetoed.has(card.slug)) {
      warnings.push(
        `${card.slug} está publicada y vetada a la vez: la publicación la excluirá`,
      )
    }
  }

  // ── dist/ (si existe) ─────────────────────────────────────────────────────
  if (exists(DIST_INDEX_FILE)) {
    const index = await readJson<unknown>(DIST_INDEX_FILE)
    const parsed = IndexFileSchema.safeParse(index)
    if (!parsed.success) {
      problems.push({
        where: 'dist/v1/index.json',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '),
      })
    } else {
      log(`dist: índice con ${parsed.data.collections.length} colecciones`)
    }

    for (const collection of ALL_COLLECTIONS) {
      const path = distCollectionFile(collection)
      if (!exists(path)) continue
      const file = await readJson<unknown>(path)
      const check = CollectionFileSchema.safeParse(file)
      if (!check.success) {
        problems.push({
          where: `dist/v1/${collection}.json`,
          message: check.error.issues[0]?.message ?? 'no valida',
        })
        continue
      }
      for (const item of check.data.items) {
        const itemCheck = CuratedEventSchema.safeParse(item)
        if (!itemCheck.success) {
          problems.push({
            where: `dist/v1/${collection}.json`,
            message: `${item.id}: ${itemCheck.error.issues[0]?.message ?? 'no valida'}`,
          })
        }
      }
    }
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    log('')
    for (const w of warnings) log(`⚠️  ${w}`)
  }

  if (problems.length > 0) {
    log('')
    for (const p of problems) log(`❌ ${p.where}: ${p.message}`)
    fail(`\n${problems.length} problemas de validación.`)
  }

  log('\n✅ 0 errores de esquema y de configuración.')
}

await main()
