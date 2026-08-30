// src/cli/doctor.ts
// `pnpm doctor` — ¿está todo funcionando?
//
// Reúne en una pantalla lo que si no habría que ir a mirar a cinco sitios: el
// contrato, la configuración, el producto, lo publicado, la automatización de
// GitHub y el gasto. No gasta un céntimo y no llama a ningún modelo.
//
// Cada línea dice qué se comprobó y, cuando algo no está bien, QUÉ HACER. Un
// informe que solo dice «error» obliga a investigar; este intenta ahorrarte eso.
import { CuratedEventSchema } from '../../contracts/curated'
import { IndexFileSchema } from '../../contracts/output'
import { loadConfig, VERIFICATION_MAX_AGE_DAYS } from '../../config/index'
import { readAllCards, readVetoes } from '../store/content'
import { readLedger, readPendingBatches, readHealth } from '../store/cache'
import { exists, readJson, readText } from '../store/fs'
import { DIST_INDEX_FILE, GOLDEN_FIXTURE, ALL_COLLECTIONS } from '../store/paths'
import { madridMonthString } from '../core/clock'
import { sha256 } from '../core/hash'
import { gh } from '../review/git'
import { openAiBaseUrl } from '../ai/clients'
import { crawlContext } from './env'
import { hasFlag, log, parseArgs } from './args'

type Estado = 'ok' | 'aviso' | 'fallo' | 'info'

interface Linea {
  readonly estado: Estado
  readonly texto: string
  readonly detalle?: string | undefined
  /** Qué hacer si no está bien. Lo que convierte un informe en algo útil. */
  readonly arreglo?: string | undefined
}

const icono: Record<Estado, string> = { ok: '✅', aviso: '⚠️ ', fallo: '❌', info: '·' }

class Informe {
  readonly lineas: Linea[] = []

  seccion(nombre: string): void {
    log('')
    log(`── ${nombre} ${'─'.repeat(Math.max(0, 64 - nombre.length))}`)
  }

  add(estado: Estado, texto: string, detalle?: string, arreglo?: string): void {
    this.lineas.push({ estado, texto, detalle, arreglo })
    log(`  ${icono[estado]} ${texto}${detalle ? ` · ${detalle}` : ''}`)
    if (arreglo && estado !== 'ok' && estado !== 'info') log(`        → ${arreglo}`)
  }

  get fallos(): number {
    return this.lineas.filter((l) => l.estado === 'fallo').length
  }

  get avisos(): number {
    return this.lineas.filter((l) => l.estado === 'aviso').length
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const sinRed = hasFlag(args, 'offline')
  const ctx = crawlContext(sinRed)
  const now = ctx.clock.now()
  const r = new Informe()

  log('')
  log('  bcn-curator · revisión general')
  log(`  ${now.toISOString()}${sinRed ? ' · sin red' : ''}`)

  // ── 1 · CONTRATO ──────────────────────────────────────────────────────────
  r.seccion('1 · El contrato con planonmap')

  const goldenRaw = await readJson<unknown[]>(GOLDEN_FIXTURE)
  if (!goldenRaw) {
    r.add('fallo', 'fixture dorado', 'no se encuentra', 'debería estar en contracts/golden/')
  } else {
    const malos = goldenRaw.filter((g) => !CuratedEventSchema.safeParse(g).success)
    if (malos.length === 0) {
      r.add('ok', 'fixture dorado valida', `${goldenRaw.length} elementos, uno por colección`)
    } else {
      r.add('fallo', 'fixture dorado NO valida', `${malos.length} elementos rotos`,
        'los esquemas han divergido: ejecuta pnpm test:contract para ver el detalle')
    }
  }

  // ── 2 · CONFIGURACIÓN ─────────────────────────────────────────────────────
  r.seccion('2 · Configuración')

  try {
    const cfg = loadConfig(now)
    r.add('ok', 'config valida', `${cfg.allSources.length} fuentes · ${cfg.museums.length} museos`)

    const activas = cfg.activeSources.length
    const sinVerificar = cfg.allSources.length - activas
    r.add(
      activas > 0 ? 'ok' : 'fallo',
      'fuentes que se rastrean',
      `${activas} de ${cfg.allSources.length}`,
      activas === 0 ? 'ninguna tiene verifiedAt: nada se va a rastrear' : undefined,
    )
    if (sinVerificar > 0) {
      r.add('info', 'fuentes sin verificar (se omiten a propósito)', String(sinVerificar),
        'para activarlas: lee su robots.txt, anótalo en SOURCES.md y ponles verifiedAt')
    }
    for (const w of cfg.warnings) {
      if (w.message.includes('días')) {
        r.add('aviso', `revisión legal caducada: ${w.id}`, w.message,
          `vuelve a revisar sus condiciones y actualiza verifiedAt (caducan a los ${VERIFICATION_MAX_AGE_DAYS} días)`)
      }
    }

    // Presupuesto
    r.add('ok', 'tope de gasto', `${cfg.budget.monthlyBudgetEur.toFixed(2)} €/mes`)
    r.add('info', 'modelos', `criba ${cfg.budget.screenModel} · redacta ${cfg.budget.writerModel}`)
  } catch (e) {
    r.add('fallo', 'config NO valida', e instanceof Error ? e.message : String(e),
      'corrige config/ y vuelve a ejecutar')
  }

  // ── 3 · CLAVES ────────────────────────────────────────────────────────────
  r.seccion('3 · Claves de IA')

  const tieneOpenAi = Boolean(process.env['OPENAI_API_KEY']?.trim())
  const tieneAnthropic = Boolean(process.env['ANTHROPIC_API_KEY']?.trim())
  const esMarcador = (k: string): boolean => (process.env[k] ?? '').startsWith('pon_aqui')

  r.add(
    tieneOpenAi && !esMarcador('OPENAI_API_KEY') ? 'ok' : 'info',
    'OPENAI_API_KEY (cribado)',
    tieneOpenAi && !esMarcador('OPENAI_API_KEY') ? 'configurada' : 'sin configurar',
    tieneOpenAi ? undefined : 'sin ella no se criba; todo lo demás sigue funcionando',
  )
  r.add(
    tieneAnthropic && !esMarcador('ANTHROPIC_API_KEY') ? 'ok' : 'info',
    'ANTHROPIC_API_KEY (redacción)',
    tieneAnthropic && !esMarcador('ANTHROPIC_API_KEY') ? 'configurada' : 'sin configurar',
    tieneAnthropic ? undefined : 'con solo OpenAI, pon WRITER_MODEL=gpt-5 en .env.local',
  )

  const endpoint = openAiBaseUrl()
  if (endpoint) {
    // Cambia el coste por completo, así que tiene que verse de un vistazo.
    r.add('info', 'endpoint compatible', endpoint,
      'no se llama a la API de OpenAI: mide la calidad con pnpm eval:screen')
  }

  // ── 4 · EL PRODUCTO ───────────────────────────────────────────────────────
  r.seccion('4 · El producto (content/)')

  const { cards, invalid } = await readAllCards()
  r.add(
    invalid.length === 0 ? 'ok' : 'fallo',
    'fichas válidas',
    `${cards.length} válidas, ${invalid.length} inválidas`,
    invalid.length > 0 ? 'ejecuta pnpm validate para ver qué falla en cada una' : undefined,
  )

  const porColeccion = new Map<string, number>()
  for (const c of cards) porColeccion.set(c.collection, (porColeccion.get(c.collection) ?? 0) + 1)
  for (const col of ALL_COLLECTIONS) {
    const n = porColeccion.get(col) ?? 0
    r.add(n > 0 ? 'ok' : 'info', `  ${col}`, n > 0 ? `${n} fichas` : 'todavía vacía')
  }

  const vetos = await readVetoes()
  r.add('info', 'fichas vetadas', String(vetos.length))

  const sinIngles = cards.filter((c) => !c.event.i18n?.description?.en).length
  r.add(
    sinIngles === 0 ? 'ok' : 'aviso',
    'fichas bilingües',
    sinIngles === 0 ? 'todas tienen versión en inglés' : `${sinIngles} sin inglés`,
    sinIngles > 0 ? 'la paridad ES/EN se comprueba al escribir; revisa esas fichas' : undefined,
  )

  // ── 5 · LO PUBLICADO ──────────────────────────────────────────────────────
  r.seccion('5 · Lo publicado')

  if (!exists(DIST_INDEX_FILE)) {
    r.add('info', 'dist/ local', 'no generado',
      'ejecuta pnpm publish:build (dist/ no se versiona: es una proyección)')
  } else {
    const idx = await readJson<unknown>(DIST_INDEX_FILE)
    const parsed = IndexFileSchema.safeParse(idx)
    r.add(
      parsed.success ? 'ok' : 'fallo',
      'dist/v1/index.json local',
      parsed.success ? `${parsed.data.collections.length} colecciones` : 'no valida',
    )
  }

  if (sinRed) {
    r.add('info', 'URL pública', 'no comprobada (--offline)')
  } else {
    const base = ctx.env.publishBaseUrl.replace(/\/$/, '')
    const indexUrl = `${base}/v1/index.json`
    const cuerpo = await ctx.fetcher.getPlain(indexUrl, 0)

    if (cuerpo === null) {
      r.add('fallo', 'URL pública', `no responde: ${indexUrl}`,
        'mira Settings → Pages: Source debe ser «GitHub Actions», y que Publish haya corrido')
    } else {
      const parsed = IndexFileSchema.safeParse(JSON.parse(cuerpo))
      if (!parsed.success) {
        r.add('fallo', 'URL pública', 'sirve algo que no valida', 'relanza el workflow Publish')
      } else {
        const idx = parsed.data
        r.add('ok', 'URL pública responde', indexUrl)
        r.add('info', '  generado', idx.generatedAt)

        // La comprobación que de verdad importa: que las sumas cuadren, porque
        // es lo que planonmap verifica antes de aceptar el archivo (§8.2).
        for (const col of idx.collections) {
          const archivo = await ctx.fetcher.getPlain(col.url, 0)
          if (archivo === null) {
            r.add('fallo', `  ${col.name}.json`, 'no se descarga', 'relanza Publish')
            continue
          }
          const real = sha256(archivo)
          r.add(
            real === col.sha256 ? 'ok' : 'fallo',
            `  ${col.name}.json`,
            real === col.sha256
              ? `${col.count} fichas · sha256 cuadra`
              : 'LA SUMA NO CUADRA: planonmap lo descartaría',
            real === col.sha256 ? undefined : 'relanza Publish para regenerar índice y archivos a la vez',
          )
        }
      }
    }
  }

  // ── 6 · AUTOMATIZACIÓN ────────────────────────────────────────────────────
  r.seccion('6 · Automatización en GitHub')

  if (sinRed) {
    r.add('info', 'workflows', 'no comprobados (--offline)')
  } else {
    const runs = await gh('run', 'list', '--limit', '12', '--json',
      'name,conclusion,createdAt,event')
    if (!runs.ok) {
      r.add('info', 'GitHub CLI', 'no disponible o sin autenticar',
        'ejecuta gh auth login para ver el estado de los workflows')
    } else {
      try {
        const lista = JSON.parse(runs.stdout) as {
          name: string; conclusion: string; createdAt: string; event: string
        }[]
        const porWorkflow = new Map<string, typeof lista[number]>()
        for (const run of lista) if (!porWorkflow.has(run.name)) porWorkflow.set(run.name, run)

        for (const nombre of ['CI', 'Publish', 'Curate', 'Health', 'Reconcile']) {
          const ultima = porWorkflow.get(nombre)
          if (!ultima) {
            r.add('info', nombre, 'sin ejecuciones todavía')
            continue
          }
          const hace = Math.round((now.getTime() - new Date(ultima.createdAt).getTime()) / 3_600_000)
          r.add(
            ultima.conclusion === 'success' ? 'ok' : 'fallo',
            nombre,
            `${ultima.conclusion} · hace ${hace} h · ${ultima.event}`,
            ultima.conclusion === 'success' ? undefined : `gh run list --workflow=${nombre.toLowerCase()}.yml`,
          )
        }
      } catch {
        r.add('info', 'workflows', 'respuesta de gh ilegible')
      }
    }

    const vars = await gh('variable', 'list')
    if (vars.ok) {
      const necesarias = ['PUBLISH_BASE_URL', 'CRAWLER_USER_AGENT', 'AI_MONTHLY_BUDGET_EUR',
        'SCREEN_MODEL', 'WRITER_MODEL']
      const faltan = necesarias.filter((v) => !vars.stdout.includes(v))
      r.add(
        faltan.length === 0 ? 'ok' : 'aviso',
        'variables del repositorio',
        faltan.length === 0 ? 'las 5 configuradas' : `faltan: ${faltan.join(', ')}`,
        faltan.length === 0 ? undefined : `gh variable set ${faltan[0]} --body "…"`,
      )
    }

    const secrets = await gh('secret', 'list')
    if (secrets.ok) {
      const necesarios = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CRAWLER_CONTACT_EMAIL']
      const faltan = necesarios.filter((s) => !secrets.stdout.includes(s))
      r.add(
        faltan.length === 0 ? 'ok' : 'info',
        'secretos del repositorio',
        faltan.length === 0 ? 'los 3 configurados' : `faltan: ${faltan.join(', ')}`,
        faltan.length === 0 ? undefined : 'sin ellos el cron rastrea pero no escribe fichas',
      )
    }
  }

  // ── 7 · GASTO Y ESTADO INTERNO ────────────────────────────────────────────
  r.seccion('7 · Gasto y estado')

  const mes = madridMonthString(now)
  const libro = await readLedger(mes)
  if (!libro) {
    r.add('ok', `gasto de ${mes}`, '0,00 € (sin llamadas todavía)')
  } else {
    const pct = (libro.spentEur / libro.budgetEur) * 100
    r.add(
      pct >= 100 ? 'aviso' : 'ok',
      `gasto de ${mes}`,
      `${libro.spentEur.toFixed(2)} € de ${libro.budgetEur.toFixed(2)} € (${pct.toFixed(0)} %)`,
      pct >= 100 ? 'tope alcanzado: se sigue publicando, pero no se escriben fichas nuevas' : undefined,
    )
  }

  const pendientes = await readPendingBatches()
  if (pendientes.length > 0) {
    const caducados = pendientes.filter((b) => new Date(b.expiresAt) < now)
    r.add(
      caducados.length > 0 ? 'aviso' : 'info',
      'lotes de redacción pendientes',
      `${pendientes.length}${caducados.length > 0 ? `, ${caducados.length} caducados` : ''}`,
      caducados.length > 0 ? 'ejecuta pnpm curate --phase collect para recogerlos o cancelarlos' : undefined,
    )
  } else {
    r.add('ok', 'lotes pendientes', 'ninguno')
  }

  const salud = await readHealth()
  const degradadas = Object.values(salud).filter((s) => s.status !== 'ok')
  r.add(
    degradadas.length === 0 ? 'ok' : 'aviso',
    'salud de las fuentes',
    degradadas.length === 0
      ? `${Object.keys(salud).length} sin incidencias`
      : degradadas.map((d) => `${d.id}:${d.status}`).join(', '),
    degradadas.length === 0 ? undefined : 'ejecuta pnpm report:health para el detalle',
  )

  const resumen = await readText('.cache/last-run-summary.md')
  r.add('info', 'última ejecución de curate',
    resumen === null ? 'sin registro' : `${resumen.split('\n').length} líneas en .cache/last-run-summary.md`)

  // ── VEREDICTO ─────────────────────────────────────────────────────────────
  log('')
  log('─'.repeat(70))
  if (r.fallos === 0 && r.avisos === 0) {
    log('  ✅ TODO CORRECTO. No hay nada que arreglar.')
  } else if (r.fallos === 0) {
    log(`  ✅ Funcionando, con ${r.avisos} aviso(s). Nada roto.`)
  } else {
    log(`  ❌ ${r.fallos} fallo(s) y ${r.avisos} aviso(s). Mira las líneas con → arriba.`)
  }
  log('')
  log('  Comprobaciones que este comando NO hace, porque cuestan o tardan:')
  log('    pnpm test:run     los 209 tests        ·  pnpm validate    esquemas')
  log('    pnpm report:health enlaces muertos     ·  pnpm spend       gasto detallado')
  log('    pnpm curate --dry-run   el embudo entero, sin gastar')
  log('')

  process.exit(r.fallos > 0 ? 1 : 0)
}

await main()
