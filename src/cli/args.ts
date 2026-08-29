// src/cli/args.ts
// Parseo de argumentos compartido. Sin dependencias: `--flag`, `--k=v` y `--k v`
// cubren todo lo que necesitan trece comandos, y añadir un parser sería añadir
// una dependencia para no ganar nada.
import type { CuratedCollection } from '../../contracts/curated'
import { ALL_COLLECTIONS } from '../store/paths'

export interface Args {
  readonly flags: ReadonlySet<string>
  readonly values: ReadonlyMap<string, string>
  readonly positionals: readonly string[]
}

export function parseArgs(argv: readonly string[] = process.argv.slice(2)): Args {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      values.set(body.slice(0, eq), body.slice(eq + 1))
      continue
    }
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      values.set(body, next)
      i++
    } else {
      flags.add(body)
    }
  }

  return { flags, values, positionals }
}

export function hasFlag(args: Args, name: string): boolean {
  // `--dryRun true` desde un workflow llega como valor, no como bandera.
  if (args.flags.has(name)) return true
  const value = args.values.get(name)
  return value === 'true' || value === '1'
}

export function stringArg(args: Args, name: string, fallback: string): string {
  const value = args.values.get(name)
  return value === undefined || value === '' ? fallback : value
}

export function numberArg(args: Args, name: string, fallback: number): number {
  const raw = args.values.get(name)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** `--collection plans,shows` → las colecciones válidas de esa lista. */
export function collectionsArg(
  args: Args,
  fallback: readonly CuratedCollection[] = ALL_COLLECTIONS,
): CuratedCollection[] {
  const raw = args.values.get('collection')
  if (!raw || raw.trim() === '' || raw === 'all') return [...fallback]
  const wanted = raw
    .split(',')
    .map((c) => c.trim())
    .filter((c): c is CuratedCollection => (ALL_COLLECTIONS as readonly string[]).includes(c))
  return wanted.length > 0 ? wanted : [...fallback]
}

/** Salida de un CLI: código 0 salvo fallo real. Un «nada que hacer» es éxito. */
export function done(message?: string): never {
  if (message) process.stdout.write(message.endsWith('\n') ? message : `${message}\n`)
  process.exit(0)
}

export function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

export function log(message = ''): void {
  process.stdout.write(`${message}\n`)
}
