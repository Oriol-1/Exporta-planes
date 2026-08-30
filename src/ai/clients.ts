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

/**
 * Endpoint alternativo compatible con OpenAI, si se ha configurado uno.
 *
 * Sirve para apuntar el cribado a un MODELO LOCAL (Ollama, LM Studio) o a
 * cualquier proveedor compatible, en vez de a la API de OpenAI. Es la única vía
 * legítima de no pagar por token: la suscripción de ChatGPT NO sirve para esto
 * —cubre a una persona usando el chat, no a un programa desatendido— y GitHub
 * Models está en proceso de retirada (devuelve 410).
 *
 * Con un modelo local se pierde criterio editorial, así que conviene medirlo con
 * `pnpm eval:screen` antes de fiarse (§5.7).
 */
export function openAiBaseUrl(): string | undefined {
  const raw = process.env['OPENAI_BASE_URL']?.trim()
  return raw === undefined || raw === '' ? undefined : raw
}

export function openai(): OpenAI {
  if (openaiClient) return openaiClient
  const baseURL = openAiBaseUrl()

  // Un servidor local no pide clave, pero el SDK exige que haya algo. Solo se
  // permite ese hueco cuando hay un endpoint propio: contra la API de OpenAI la
  // clave sigue siendo obligatoria.
  const apiKey = process.env['OPENAI_API_KEY'] ?? (baseURL ? 'sin-clave-endpoint-local' : undefined)
  if (!apiKey) throw new MissingApiKeyError('openai', 'OPENAI_API_KEY')

  openaiClient = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    maxRetries: 2,
    // Un modelo local en un portátil tarda mucho más que la API.
    timeout: baseURL ? 600_000 : 120_000,
  })
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
