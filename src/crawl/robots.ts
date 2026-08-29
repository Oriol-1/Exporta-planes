// src/crawl/robots.ts
// Lectura y caché de robots.txt. Se respeta SIEMPRE, sin excepciones ni «modo
// agresivo» (§11.4). No es solo cortesía: toda la defensa legal del §12.1 se
// apoya en que este archivo se obedezca.
import robotsParser, { type Robot } from 'robots-parser'
import { readRobotsCache, writeRobotsCache, type RobotsCache } from '../store/cache'
import { daysBetween } from '../core/clock'

const CACHE_TTL_HOURS = 24

export interface RobotsRules {
  readonly host: string
  isAllowed(url: string, userAgent: string): boolean
  /** `Crawl-delay` declarado en ms, o `undefined` si el sitio no dice nada. */
  crawlDelayMs(userAgent: string): number | undefined
}

/** Sin robots.txt legible se aplica la interpretación estándar: todo permitido. */
function permissive(host: string): RobotsRules {
  return {
    host,
    isAllowed: () => true,
    crawlDelayMs: () => undefined,
  }
}

function fromBody(host: string, body: string, robotsUrl: string): RobotsRules {
  const parsed: Robot = robotsParser(robotsUrl, body)
  return {
    host,
    isAllowed(url, userAgent) {
      // `isAllowed` devuelve undefined cuando no hay regla aplicable: eso es
      // «permitido», no «prohibido». Confundirlo dejaría el rastreo en nada.
      return parsed.isAllowed(url, userAgent) !== false
    },
    crawlDelayMs(userAgent) {
      const seconds = parsed.getCrawlDelay(userAgent)
      return typeof seconds === 'number' ? Math.round(seconds * 1000) : undefined
    },
  }
}

export class RobotsRegistry {
  private cache: RobotsCache = {}
  private readonly rules = new Map<string, RobotsRules>()
  private loaded = false

  constructor(
    private readonly now: Date,
    /** Descarga cruda. Se inyecta para poder probar sin red. */
    private readonly download: (url: string) => Promise<{ status: number; body: string }>,
  ) {}

  private async load(): Promise<void> {
    if (this.loaded) return
    this.cache = await readRobotsCache()
    this.loaded = true
  }

  private isFresh(fetchedAt: string): boolean {
    const ageMs = this.now.getTime() - new Date(fetchedAt).getTime()
    return ageMs < CACHE_TTL_HOURS * 3_600_000
  }

  /** Reglas del host de `url`. Una lectura por host y ejecución, cacheada 24 h. */
  async forUrl(url: string): Promise<RobotsRules> {
    await this.load()
    let host: string
    let robotsUrl: string
    try {
      const u = new URL(url)
      host = u.host
      robotsUrl = `${u.protocol}//${u.host}/robots.txt`
    } catch {
      return permissive('desconocido')
    }

    const inMemory = this.rules.get(host)
    if (inMemory) return inMemory

    const cached = this.cache[host]
    if (cached && this.isFresh(cached.fetchedAt)) {
      const rules = cached.status === 200 ? fromBody(host, cached.body, robotsUrl) : permissive(host)
      this.rules.set(host, rules)
      return rules
    }

    let status = 0
    let body = ''
    try {
      const res = await this.download(robotsUrl)
      status = res.status
      body = res.body
    } catch {
      // Un robots.txt inalcanzable no autoriza a rastrear a ciegas, pero
      // tampoco debe parar el proyecto: se trata como ausente, que es lo que
      // hace cualquier rastreador que se porta bien.
      status = 0
    }

    this.cache[host] = { host, body, status, fetchedAt: this.now.toISOString() }
    await writeRobotsCache(this.cache)

    const rules = status === 200 ? fromBody(host, body, robotsUrl) : permissive(host)
    this.rules.set(host, rules)
    return rules
  }

  /** Edad en días de la lectura cacheada de un host. Para `pnpm sources:check`. */
  ageInDays(host: string): number | null {
    const entry = this.cache[host]
    if (!entry) return null
    return daysBetween(new Date(entry.fetchedAt), this.now)
  }
}
