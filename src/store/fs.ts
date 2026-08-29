// src/store/fs.ts
// Utilidades de disco compartidas por content.ts y cache.ts. Nadie más de `src/`
// importa `node:fs` (§3.4): eso es lo que permite probar el cribado y el
// enriquecimiento enteros sin sistema de archivos.
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

export function exists(path: string): boolean {
  return existsSync(path)
}

export async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * Escritura atómica: se escribe a un temporal y se renombra. Un job cancelado a
 * mitad de un `writeFile` deja el archivo truncado; un `rename` es atómico y no.
 */
export async function writeText(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path))
  const tmp = `${path}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, path)
}

export async function readJson<T>(path: string): Promise<T | null> {
  const raw = await readText(path)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * JSON con dos espacios y salto final. El formato importa: `content/` es el
 * panel de revisión, y un diff legible es la mitad del producto (§3.3).
 */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, JSON.stringify(value, null, 2) + '\n')
}

export async function readNdjson<T>(path: string): Promise<T[]> {
  const raw = await readText(path)
  if (raw === null) return []
  const out: T[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      out.push(JSON.parse(trimmed) as T)
    } catch {
      // Una línea corrupta no puede tumbar la ejecución: se ignora y se sigue.
    }
  }
  return out
}

/**
 * NDJSON ordenado de forma ESTABLE. Es lo que hace que cambien solo las líneas
 * que cambian: 7.500 URL en un único JSON se reescribirían enteras cada día y
 * producirían un diff inmanejable (§3.4).
 */
export async function writeNdjson<T>(
  path: string,
  rows: readonly T[],
  sortKey: (row: T) => string,
): Promise<void> {
  const sorted = [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  await writeText(path, sorted.map((r) => JSON.stringify(r)).join('\n') + (sorted.length ? '\n' : ''))
}

export async function appendNdjson<T>(path: string, rows: readonly T[]): Promise<void> {
  if (rows.length === 0) return
  const existing = (await readText(path)) ?? ''
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
  await writeText(path, existing + prefix + rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

export async function removeFile(path: string): Promise<void> {
  await rm(path, { force: true })
}

export async function moveFile(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to))
  await rename(from, to)
}
