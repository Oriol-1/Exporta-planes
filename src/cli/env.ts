// src/cli/env.ts
// Lectura del entorno y construcción de las piezas compartidas por los CLI.
//
// El User-Agent es obligatorio y NO tiene valor por defecto silencioso: sin él,
// el rastreador saldría a la red sin identificarse, y toda la política de
// cortesía del §11.4 y la defensa legal del §12.1 se apoyan precisamente en eso.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, type LoadedConfig } from '../../config/index'
import { Fetcher } from '../crawl/fetcher'
import { systemClock, type Clock } from '../core/clock'
import { ROOT } from '../store/paths'

/** Carga `.env.local` si existe. En Actions las variables ya vienen del runner. */
export function loadDotEnvLocal(): void {
  for (const name of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(join(ROOT, name), 'utf8')
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (process.env[key] === undefined) process.env[key] = value
      }
    } catch {
      // No existe: es lo normal en CI.
    }
  }
}

export interface Env {
  readonly userAgent: string
  readonly contactEmail: string | undefined
  readonly publishBaseUrl: string
  readonly producerVersion: string
}

const DEFAULT_UA = 'bcn-curator/1.0 (+https://github.com/Oriol-1/Exporta-planes)'
const DEFAULT_BASE_URL = 'https://oriol-1.github.io/Exporta-planes'

/**
 * Una variable de GitHub Actions que no existe llega como CADENA VACÍA, no como
 * `undefined`, así que `??` no la sustituye por el valor por defecto. Sin esto,
 * un `PUBLISH_BASE_URL` sin configurar produce una URL vacía y el build falla al
 * validar el índice — que es exactamente lo que pasó la primera vez.
 */
function envOr(name: string, fallback: string): string {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? fallback : value.trim()
}

export function readEnv(): Env {
  loadDotEnvLocal()
  const contactEmail = process.env['CRAWLER_CONTACT_EMAIL']?.trim()
  return {
    userAgent: envOr('CRAWLER_USER_AGENT', DEFAULT_UA),
    contactEmail: contactEmail === undefined || contactEmail === '' ? undefined : contactEmail,
    publishBaseUrl: envOr('PUBLISH_BASE_URL', DEFAULT_BASE_URL),
    producerVersion: readPackageVersion(),
  }
}

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(ROOT, 'package.json'), 'utf8')
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export interface Context {
  readonly clock: Clock
  readonly config: LoadedConfig
  readonly env: Env
}

/** Contexto sin red: para validar, informar y publicar. */
export function baseContext(): Context {
  const env = readEnv()
  const clock = systemClock()
  return { clock, config: loadConfig(clock.now()), env }
}

/** Contexto con fetcher: para todo lo que sale a internet. */
export function crawlContext(offline = false): Context & { fetcher: Fetcher } {
  const ctx = baseContext()
  const fetcher = new Fetcher({
    userAgent: ctx.env.userAgent,
    contactEmail: ctx.env.contactEmail,
    now: () => ctx.clock.now(),
    offline,
  })
  return { ...ctx, fetcher }
}
