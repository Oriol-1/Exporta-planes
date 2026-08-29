// src/crawl/fetcher.ts
// EL ÚNICO punto del proyecto autorizado a hacer peticiones a terceros (§4.3).
// Nadie llama a `fetch` directamente; una regla de ESLint lo impide en todos los
// demás archivos. Concentrarlo aquí es lo que hace que la cortesía sea una
// propiedad del sistema y no una promesa.
//
// Impone, sin que la persona que llama pueda saltárselo:
//   1. robots.txt, leído una vez por host y cacheado 24 h.
//   2. User-Agent identificable y con contacto. Nada de disfrazarse de navegador.
//   3. Un host a la vez, con el retardo configurado entre peticiones.
//   4. If-None-Match / If-Modified-Since: un 304 cuesta unos bytes.
//   5. Timeout de 15 s.
//   6. Tope diario por fuente.
import pLimit from 'p-limit'
import type { SourceConfig } from '../../config/schema'
import type { FetchOutcome } from '../types'
import { RobotsRegistry } from './robots'

const TIMEOUT_MS = 15_000
const MAX_HOSTS_IN_PARALLEL = 4
const MAX_RETRY_AFTER_MS = 60_000

export interface FetcherOptions {
  readonly userAgent: string
  readonly contactEmail?: string | undefined
  readonly now: () => Date
  /** En seco no sale nada a la red: se usa para probar sin molestar a nadie. */
  readonly offline?: boolean | undefined
}

export type FetchError =
  | { readonly kind: 'robots-disallowed'; readonly url: string }
  | { readonly kind: 'quota-exceeded'; readonly url: string; readonly sourceId: string }
  | { readonly kind: 'blocked'; readonly url: string; readonly status: number }
  | { readonly kind: 'rate-limited'; readonly url: string; readonly retryAfterMs: number }
  | { readonly kind: 'dead'; readonly url: string; readonly status: number }
  | { readonly kind: 'network'; readonly url: string; readonly message: string }
  | { readonly kind: 'offline'; readonly url: string }

export interface ConditionalHeaders {
  readonly etag?: string | undefined
  readonly lastModified?: string | undefined
}

interface HostState {
  readonly limit: ReturnType<typeof pLimit>
  lastRequestAt: number
}

export class Fetcher {
  private readonly hosts = new Map<string, HostState>()
  private readonly hostGate = pLimit(MAX_HOSTS_IN_PARALLEL)
  private readonly robots: RobotsRegistry
  private readonly pagesBySource = new Map<string, number>()
  /** Fuentes apagadas en esta ejecución por 403 o por 429 repetido (§4.4). */
  private readonly stopped = new Map<string, 'blocked' | 'paused'>()

  constructor(private readonly opts: FetcherOptions) {
    this.robots = new RobotsRegistry(opts.now(), (url) => this.raw(url))
  }

  /** El User-Agent completo: identificable y con una vía de contacto. */
  private ua(): string {
    return this.opts.contactEmail
      ? `${this.opts.userAgent} (contacto: ${this.opts.contactEmail})`
      : this.opts.userAgent
  }

  private hostState(host: string): HostState {
    let st = this.hosts.get(host)
    if (!st) {
      st = { limit: pLimit(1), lastRequestAt: 0 } // un host a la vez
      this.hosts.set(host, st)
    }
    return st
  }

  private async wait(ms: number): Promise<void> {
    if (ms <= 0) return
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** Petición cruda, sin robots ni ritmo. Solo la usa el propio robots.txt. */
  private async raw(url: string): Promise<{ status: number; body: string }> {
    if (this.opts.offline) return { status: 0, body: '' }
    const res = await fetch(url, {
      headers: { 'user-agent': this.ua(), accept: 'text/plain,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    return { status: res.status, body: res.ok ? await res.text() : '' }
  }

  isStopped(sourceId: string): 'blocked' | 'paused' | undefined {
    return this.stopped.get(sourceId)
  }

  pagesUsed(sourceId: string): number {
    return this.pagesBySource.get(sourceId) ?? 0
  }

  /**
   * Descarga una URL respetando todo lo de arriba. Devuelve `FetchOutcome` o un
   * `FetchError` tipado: nunca lanza por una página concreta, porque una página
   * rota no puede tumbar el rastreo entero (§4.4).
   */
  async get(
    url: string,
    source: SourceConfig,
    conditional: ConditionalHeaders = {},
  ): Promise<{ ok: true; value: FetchOutcome } | { ok: false; error: FetchError }> {
    if (this.opts.offline) return { ok: false, error: { kind: 'offline', url } }

    const stopped = this.stopped.get(source.id)
    if (stopped) {
      return { ok: false, error: { kind: 'blocked', url, status: stopped === 'blocked' ? 403 : 429 } }
    }

    const used = this.pagesUsed(source.id)
    if (used >= source.maxPagesPerDay) {
      return { ok: false, error: { kind: 'quota-exceeded', url, sourceId: source.id } }
    }

    let host: string
    try {
      host = new URL(url).host
    } catch {
      return { ok: false, error: { kind: 'network', url, message: 'URL inválida' } }
    }

    const rules = await this.robots.forUrl(url)
    if (!rules.isAllowed(url, this.opts.userAgent)) {
      return { ok: false, error: { kind: 'robots-disallowed', url } }
    }

    // El Crawl-delay declarado manda, pero nunca por debajo del configurado:
    // si el sitio pide 10 s y nosotros teníamos 5, se esperan 10.
    const declared = rules.crawlDelayMs(this.opts.userAgent)
    const delayMs = Math.max(source.crawlDelayMs, declared ?? 0)

    const st = this.hostState(host)
    return await this.hostGate(() =>
      st.limit(async () => {
        const since = this.opts.now().getTime() - st.lastRequestAt
        await this.wait(delayMs - since)
        const result = await this.request(url, conditional, delayMs)
        st.lastRequestAt = this.opts.now().getTime()
        if (result.ok && !result.value.notModified) {
          this.pagesBySource.set(source.id, used + 1)
        }
        if (!result.ok) this.reactToError(source.id, result.error)
        return result
      }),
    )
  }

  private reactToError(sourceId: string, error: FetchError): void {
    // Un 403 es una respuesta, no un obstáculo a esquivar: la fuente se apaga y
    // se revisa a mano. No se rota User-Agent, no se usan proxies (§11.4).
    if (error.kind === 'blocked') this.stopped.set(sourceId, 'blocked')
    if (error.kind === 'rate-limited') this.stopped.set(sourceId, 'paused')
  }

  private async request(
    url: string,
    conditional: ConditionalHeaders,
    delayMs: number,
  ): Promise<{ ok: true; value: FetchOutcome } | { ok: false; error: FetchError }> {
    const headers: Record<string, string> = {
      'user-agent': this.ua(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'ca,es;q=0.9,en;q=0.8',
    }
    if (conditional.etag) headers['if-none-match'] = conditional.etag
    if (conditional.lastModified) headers['if-modified-since'] = conditional.lastModified

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: 'follow',
        })
        const fetchedAt = this.opts.now().toISOString()

        if (res.status === 304) {
          return {
            ok: true,
            value: {
              url,
              status: 304,
              body: null,
              etag: conditional.etag,
              lastModified: conditional.lastModified,
              notModified: true,
              fetchedAt,
            },
          }
        }

        if (res.status === 403) {
          return { ok: false, error: { kind: 'blocked', url, status: 403 } }
        }

        if (res.status === 404 || res.status === 410) {
          return { ok: false, error: { kind: 'dead', url, status: res.status } }
        }

        if (res.status === 429 || res.status === 503) {
          const header = res.headers.get('retry-after')
          const retryAfterMs = header
            ? Math.min(Number(header) * 1000 || MAX_RETRY_AFTER_MS, MAX_RETRY_AFTER_MS)
            : // Sin cabecera: retroceso exponencial 5 s, 20 s, 80 s.
              [5_000, 20_000, 80_000][attempt] ?? 80_000
          // Con cabecera se hace UN solo reintento; sin ella, hasta tres.
          if (header && attempt > 0) {
            return { ok: false, error: { kind: 'rate-limited', url, retryAfterMs } }
          }
          if (attempt === 2) {
            return { ok: false, error: { kind: 'rate-limited', url, retryAfterMs } }
          }
          await this.wait(retryAfterMs)
          continue
        }

        if (!res.ok) {
          return { ok: false, error: { kind: 'network', url, message: `HTTP ${res.status}` } }
        }

        return {
          ok: true,
          value: {
            url,
            status: res.status,
            body: await res.text(),
            etag: res.headers.get('etag') ?? undefined,
            lastModified: res.headers.get('last-modified') ?? undefined,
            notModified: false,
            fetchedAt,
          },
        }
      } catch (e) {
        // Error de red o timeout: dos reintentos con retroceso. Después, la URL
        // vuelve a la cola de mañana.
        if (attempt === 2) {
          return {
            ok: false,
            error: { kind: 'network', url, message: e instanceof Error ? e.message : String(e) },
          }
        }
        await this.wait(delayMs * (attempt + 1))
      }
    }
    return { ok: false, error: { kind: 'network', url, message: 'agotados los reintentos' } }
  }

  /** GET simple para servicios propios de OSM (Nominatim, Overpass). */
  async getPlain(url: string, delayMs = 1100): Promise<string | null> {
    if (this.opts.offline) return null
    let host: string
    try {
      host = new URL(url).host
    } catch {
      return null
    }
    const st = this.hostState(host)
    return await st.limit(async () => {
      const since = this.opts.now().getTime() - st.lastRequestAt
      await this.wait(delayMs - since)
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': this.ua(), accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        st.lastRequestAt = this.opts.now().getTime()
        return res.ok ? await res.text() : null
      } catch {
        st.lastRequestAt = this.opts.now().getTime()
        return null
      }
    })
  }
}
