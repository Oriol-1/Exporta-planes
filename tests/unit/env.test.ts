// Lectura del entorno.
//
// REGRESIÓN: una variable de GitHub Actions que no existe llega como CADENA
// VACÍA, no como `undefined`, así que `??` no la sustituye por el valor por
// defecto. La primera publicación falló exactamente por eso: `PUBLISH_BASE_URL`
// sin configurar produjo una URL vacía y el índice no validó.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readEnv } from '../../src/cli/env'
import { parseArgs, stringArg } from '../../src/cli/args'

const KEYS = ['PUBLISH_BASE_URL', 'CRAWLER_USER_AGENT', 'CRAWLER_CONTACT_EMAIL'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k]
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('readEnv', () => {
  it('trata la CADENA VACÍA como ausente', () => {
    process.env['PUBLISH_BASE_URL'] = ''
    process.env['CRAWLER_USER_AGENT'] = ''
    const env = readEnv()
    expect(env.publishBaseUrl).not.toBe('')
    expect(() => new URL(env.publishBaseUrl)).not.toThrow()
    expect(env.userAgent).toContain('bcn-curator')
  })

  it('trata una cadena de solo espacios como ausente', () => {
    process.env['PUBLISH_BASE_URL'] = '   '
    expect(() => new URL(readEnv().publishBaseUrl)).not.toThrow()
  })

  it('respeta el valor cuando sí lo hay, y le quita los espacios', () => {
    process.env['PUBLISH_BASE_URL'] = '  https://ejemplo.test/curator  '
    expect(readEnv().publishBaseUrl).toBe('https://ejemplo.test/curator')
  })

  it('un contacto vacío es `undefined`, no una cadena vacía en el User-Agent', () => {
    process.env['CRAWLER_CONTACT_EMAIL'] = ''
    expect(readEnv().contactEmail).toBeUndefined()
  })
})

describe('stringArg', () => {
  it('un argumento vacío cae al valor por defecto', () => {
    // `--base-url ""` desde un workflow tiene el mismo problema.
    const args = parseArgs(['--base-url', '  '])
    expect(stringArg(args, 'base-url', 'https://por-defecto.test')).toBe('https://por-defecto.test')
  })

  it('un argumento con valor gana al valor por defecto', () => {
    const args = parseArgs(['--base-url=https://ejemplo.test'])
    expect(stringArg(args, 'base-url', 'https://por-defecto.test')).toBe('https://ejemplo.test')
  })
})
