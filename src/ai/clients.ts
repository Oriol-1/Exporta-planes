// src/ai/clients.ts
// Los clientes de OpenAI y Anthropic.
//
// Se usan DOS proveedores y no uno porque (a) el propietario lo pidió y (b) hay
// un beneficio real: si uno tiene una incidencia, el pipeline sigue funcionando
// en modo degradado con el otro (§7.7). El precio de la decisión es concreto y
// asumible: dos dependencias, dos secretos y dos contadores de gasto.
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export class MissingApiKeyError extends Error {
  constructor(provider: 'openai' | 'anthropic', envVar: string) {
    super(
      `Falta ${envVar} para ${provider}. En local va en .env.local (que está en ` +
        '.gitignore); en Actions, como Secret del repositorio. NUNCA en el código.',
    )
    this.name = 'MissingApiKeyError'
  }
}

let openaiClient: OpenAI | null = null
let anthropicClient: Anthropic | null = null

export function openai(): OpenAI {
  if (openaiClient) return openaiClient
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) throw new MissingApiKeyError('openai', 'OPENAI_API_KEY')
  openaiClient = new OpenAI({ apiKey, maxRetries: 2, timeout: 120_000 })
  return openaiClient
}

export function anthropic(): Anthropic {
  if (anthropicClient) return anthropicClient
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new MissingApiKeyError('anthropic', 'ANTHROPIC_API_KEY')
  anthropicClient = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 })
  return anthropicClient
}

export function hasOpenAiKey(): boolean {
  return Boolean(process.env['OPENAI_API_KEY'])
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY'])
}

/** Qué proveedor sirve cada modelo. Lo necesita el enrutado del lote. */
export function providerOf(model: string): 'openai' | 'anthropic' {
  return model.startsWith('claude') ? 'anthropic' : 'openai'
}

/**
 * Reinicia los clientes memorizados. Solo lo usan los tests: sin esto, un test
 * que cambia la variable de entorno se encontraría el cliente anterior.
 */
export function resetClients(): void {
  openaiClient = null
  anthropicClient = null
}
