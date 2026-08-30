// El cliente de OpenAI admite un ENDPOINT ALTERNATIVO compatible.
//
// Es la única vía legítima de no pagar por token: la suscripción de ChatGPT
// cubre a una persona usando el chat, no a un programa desatendido a las 02:30
// en un servidor; y GitHub Models está retirándose (devuelve 410).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openAiBaseUrl, openai, resetClients, MissingApiKeyError, providerOf } from '../../src/ai/clients'

const KEYS = ['OPENAI_BASE_URL', 'OPENAI_API_KEY'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k]
  resetClients()
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  resetClients()
})

describe('openAiBaseUrl', () => {
  it('sin configurar, no hay endpoint alternativo', () => {
    delete process.env['OPENAI_BASE_URL']
    expect(openAiBaseUrl()).toBeUndefined()
  })

  it('la cadena vacía cuenta como sin configurar', () => {
    // Mismo cuidado que con PUBLISH_BASE_URL: una variable de Actions que no
    // existe llega vacía, no ausente.
    process.env['OPENAI_BASE_URL'] = '   '
    expect(openAiBaseUrl()).toBeUndefined()
  })

  it('recorta los espacios del valor', () => {
    process.env['OPENAI_BASE_URL'] = '  http://127.0.0.1:11434/v1  '
    expect(openAiBaseUrl()).toBe('http://127.0.0.1:11434/v1')
  })
})

describe('construcción del cliente', () => {
  it('contra la API de OpenAI, la clave es OBLIGATORIA', () => {
    delete process.env['OPENAI_BASE_URL']
    delete process.env['OPENAI_API_KEY']
    expect(() => openai()).toThrow(MissingApiKeyError)
  })

  it('el error dice dónde va la clave y dónde NO', () => {
    delete process.env['OPENAI_BASE_URL']
    delete process.env['OPENAI_API_KEY']
    try {
      openai()
      expect.unreachable('debería haber lanzado')
    } catch (e) {
      const m = (e as Error).message
      expect(m).toContain('.env.local')
      expect(m).toContain('Secret')
      expect(m).toContain('NUNCA en el código')
    }
  })

  it('con un endpoint propio, la clave deja de ser obligatoria', () => {
    // Un servidor local no pide clave, pero el SDK exige que haya algo.
    process.env['OPENAI_BASE_URL'] = 'http://127.0.0.1:11434/v1'
    delete process.env['OPENAI_API_KEY']
    const client = openai()
    expect(client.baseURL).toBe('http://127.0.0.1:11434/v1')
  })

  it('el hueco de la clave SOLO se abre con endpoint propio', () => {
    // Sin esta condición, olvidarse la clave contra la API de OpenAI daría un
    // 401 confuso en vez de un mensaje que explica qué falta.
    process.env['OPENAI_BASE_URL'] = ''
    delete process.env['OPENAI_API_KEY']
    expect(() => openai()).toThrow(MissingApiKeyError)
  })

  it('sin endpoint propio usa el de OpenAI', () => {
    delete process.env['OPENAI_BASE_URL']
    process.env['OPENAI_API_KEY'] = 'sk-de-prueba'
    expect(openai().baseURL).toContain('api.openai.com')
  })
})

describe('providerOf', () => {
  it('encamina cada modelo a su proveedor', () => {
    expect(providerOf('claude-opus-5')).toBe('anthropic')
    expect(providerOf('gpt-5-mini')).toBe('openai')
    // Un modelo local se sirve por el camino compatible con OpenAI.
    expect(providerOf('qwen2.5:7b')).toBe('openai')
  })
})
