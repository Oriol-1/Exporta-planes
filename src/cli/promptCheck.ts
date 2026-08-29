// src/cli/promptCheck.ts
// `pnpm prompts:check --base <ref>` — ¿ha cambiado de verdad algún prompt?
//
// LA PUERTA DEL §5.7: subir PROMPT_VERSION sin haber pasado la evaluación está
// prohibido, y la CI lo comprueba.
//
// La primera versión de esa comprobación miraba si el ARCHIVO había cambiado, y
// eso da falsos positivos: `llmScreen.ts` contiene el prompt Y el manejo de
// errores de red, así que arreglar un reintento hacía fallar la CI pidiendo una
// evaluación que no venía a cuento. Peor aún, enseña a saltarse el guardián.
//
// Esta versión compara el CONTENIDO de los prompts —el texto de sistema, el
// esquema de salida forzado y PROMPT_VERSION— entre la base y HEAD. Es exacta:
// ni deja pasar un cambio de prompt ni protesta por un cambio que no lo es.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { sha256 } from '../core/hash'
import { fail, log, parseArgs, stringArg } from './args'

/** Los archivos que contienen prompts, y qué se considera «prompt» en cada uno. */
const WATCHED: readonly { file: string; markers: readonly string[] }[] = [
  {
    file: 'src/screen/llmScreen.ts',
    markers: ['SCREEN_SYSTEM_PROMPT', 'SCREEN_JSON_SCHEMA'],
  },
  {
    file: 'src/enrich/write.ts',
    markers: ['WRITE_SYSTEM_PROMPT', 'WRITE_RETRY_NUDGE', 'WRITE_JSON_SCHEMA', 'BANNED_TERMS'],
  },
  {
    file: 'src/core/hash.ts',
    markers: ['PROMPT_VERSION'],
  },
]

/**
 * Extrae la declaración de una constante: desde `export const <nombre>` hasta la
 * línea que la cierra en la columna 0. Es tosco, pero es exacto para el estilo
 * de este proyecto y no necesita un parser de TypeScript entero.
 */
function extractConstant(source: string, name: string): string {
  const start = source.indexOf(`export const ${name}`)
  if (start === -1) return ''
  const rest = source.slice(start)
  // El cierre es la primera línea que empieza en columna 0 con `}` o con un
  // backtick, seguido opcionalmente de `as const` y punto y coma.
  const end = /\n(?:`|\}|\])[^\n]*\n/.exec(rest)
  return end ? rest.slice(0, end.index + end[0].length) : rest
}

function fingerprintOf(readFile: (path: string) => string | null): {
  hash: string
  perFile: Record<string, string>
} {
  const perFile: Record<string, string> = {}
  const parts: string[] = []

  for (const watched of WATCHED) {
    const source = readFile(watched.file)
    if (source === null) {
      perFile[watched.file] = '(archivo ausente)'
      parts.push(`${watched.file}:ausente`)
      continue
    }
    const extracted = watched.markers.map((m) => extractConstant(source, m)).join('\n')
    const hash = sha256(extracted)
    perFile[watched.file] = hash
    parts.push(`${watched.file}:${hash}`)
  }

  return { hash: sha256(parts.join('|')), perFile }
}

function readAtRef(ref: string, path: string): string | null {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

function readWorking(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function main(): void {
  const args = parseArgs()
  const base = stringArg(args, 'base', '')

  const current = fingerprintOf(readWorking)

  if (base === '' || /^0{40}$/.test(base)) {
    log('Sin base con la que comparar: se omite la puerta del §5.7.')
    log(`Huella actual de los prompts: ${current.hash.slice(0, 16)}…`)
    return
  }

  const previous = fingerprintOf((path) => readAtRef(base, path))

  if (previous.hash === current.hash) {
    log('✅ Ningún prompt ha cambiado: no hace falta volver a evaluar.')
    return
  }

  const changed = WATCHED.map((w) => w.file).filter(
    (file) => previous.perFile[file] !== current.perFile[file],
  )

  log('Han cambiado los prompts de:')
  for (const file of changed) log(`  · ${file}`)
  log('')

  // Aquí sí manda la regla: un prompt distinto exige su informe de evaluación.
  const evalsChanged = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], {
    encoding: 'utf8',
  })
    .split('\n')
    .some((f) => f.startsWith('evals/'))

  if (!evalsChanged) {
    fail(
      '::error::Has cambiado un prompt sin actualizar evals/.\n' +
        'Ejecuta `pnpm eval:screen` (o `pnpm eval:write`) y commitea su informe.\n' +
        'Un falso positivo pesa más que un falso negativo: publicar una trampa\n' +
        'turística cuesta credibilidad, que es todo lo que tiene una guía curada.',
    )
  }

  log('✅ El prompt cambió y evals/ viene actualizado.')
}

main()
