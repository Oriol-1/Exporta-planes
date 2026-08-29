// src/ai/batch.ts
// Envío y recogida de lotes de redacción (§7.2 ter).
//
// El Batch API de los dos proveedores es ASÍNCRONO: envías el lote, te devuelve
// un identificador, y los resultados llegan cuando llegan —en la práctica menos
// de una hora, pero el compromiso de servicio es de hasta 24 h—. Un job de
// GitHub Actions no puede quedarse esperando (ni debe: pagarías minutos por
// dormir), así que el día tiene dos fases y `.cache/pending-batches.json` es lo
// que las une.
//
// Tres propiedades hacen esto robusto:
//   · IDEMPOTENTE  — cada elemento lleva como custom_id su clave de caché.
//   · SIN PÉRDIDAS — si collect no encuentra el lote listo, sale con éxito.
//   · CON CADUCIDAD— a las 26 h se cancela y los candidatos vuelven a la cola.
import type { Budget } from '../../config/schema'
import type { PendingBatch, WrittenCard } from '../types'
import { anthropic, openai, providerOf } from './clients'
import { BudgetGuard, approximateTokens, estimateCost, type CostEstimate } from './budget'
import { WRITE_JSON_SCHEMA, WRITE_SYSTEM_PROMPT, parseWrittenCard, type WriteJob } from '../enrich/write'
import { TOKEN_ESTIMATES } from '../../config/budget'

export interface SubmitResult {
  readonly batch: PendingBatch | null
  readonly estimatedEur: number
  readonly skipped: readonly string[]
  readonly reason?: string | undefined
}

export interface CollectedCard {
  readonly customId: string
  readonly card: WrittenCard | null
  readonly rawError?: string | undefined
  readonly inputTokens: number
  readonly outputTokens: number
}

export interface CollectResult {
  readonly ready: boolean
  readonly cards: readonly CollectedCard[]
  readonly expired: boolean
}

/** Coste estimado de un lote, para poder apuntarlo ANTES de enviarlo (§7.6). */
export function estimateBatch(
  jobs: readonly WriteJob[],
  budget: Budget,
  model: string,
): CostEstimate {
  const inputTokens = jobs.reduce(
    (n, j) => n + TOKEN_ESTIMATES.writeSystemTokens + approximateTokens(j.userPrompt),
    0,
  )
  const outputTokens = jobs.length * TOKEN_ESTIMATES.writeOutputPerCard
  return estimateCost(budget, model, inputTokens, outputTokens)
}

/**
 * Envía un lote de redacción. Apunta el importe ESTIMADO con `pending: true`:
 * sin ese apunte provisional, tres ejecuciones seguidas podrían enviar tres
 * lotes creyendo cada una que hay presupuesto de sobra.
 */
export async function submitWriteBatch(
  jobs: readonly WriteJob[],
  budget: Budget,
  guard: BudgetGuard,
  now: Date,
  model: string = budget.writerModel,
): Promise<SubmitResult> {
  if (jobs.length === 0) {
    return { batch: null, estimatedEur: 0, skipped: [], reason: 'nada que enviar' }
  }

  const estimate = estimateBatch(jobs, budget, model)
  if (!guard.canAfford(estimate)) {
    await guard.markExhausted()
    return {
      batch: null,
      estimatedEur: estimate.eur,
      skipped: jobs.map((j) => j.customId),
      reason: `presupuesto agotado: ${guard.spentEur.toFixed(2)} € de ${guard.budgetEur.toFixed(2)} €`,
    }
  }

  const provider = providerOf(model)
  const batchId =
    provider === 'anthropic'
      ? await submitAnthropic(jobs, budget, model)
      : await submitOpenAi(jobs, budget, model)

  const batch: PendingBatch = {
    id: batchId,
    provider,
    task: 'write',
    model,
    submittedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + budget.batchExpiryHours * 3_600_000).toISOString(),
    customIds: jobs.map((j) => j.customId),
    estimatedEur: estimate.eur,
  }

  await guard.record({
    at: now.toISOString(),
    model,
    task: 'write',
    inputTokens: estimate.inputTokens,
    outputTokens: estimate.outputTokens,
    eur: estimate.eur,
    batchId,
    pending: true,
  })

  return { batch, estimatedEur: estimate.eur, skipped: [] }
}

async function submitAnthropic(
  jobs: readonly WriteJob[],
  budget: Budget,
  model: string,
): Promise<string> {
  const created = await anthropic().messages.batches.create({
    requests: jobs.map((job) => ({
      custom_id: job.customId,
      params: {
        model,
        max_tokens: budget.writeMaxTokens,
        system: WRITE_SYSTEM_PROMPT,
        messages: [{ role: 'user' as const, content: job.userPrompt }],
        tools: [
          {
            name: 'emitir_ficha',
            description: 'Emite la ficha bilingüe con sus evidencias literales.',
            input_schema: WRITE_JSON_SCHEMA as unknown as { type: 'object' },
          },
        ],
        tool_choice: { type: 'tool' as const, name: 'emitir_ficha' },
      },
    })),
  })
  return created.id
}

async function submitOpenAi(
  jobs: readonly WriteJob[],
  budget: Budget,
  model: string,
): Promise<string> {
  // El Batch API de OpenAI recibe un archivo JSONL de peticiones.
  const jsonl = jobs
    .map((job) =>
      JSON.stringify({
        custom_id: job.customId,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model,
          messages: [
            { role: 'system', content: WRITE_SYSTEM_PROMPT },
            { role: 'user', content: job.userPrompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'ficha', strict: true, schema: WRITE_JSON_SCHEMA },
          },
          max_completion_tokens: budget.writeMaxTokens,
        },
      }),
    )
    .join('\n')

  const file = await openai().files.create({
    file: new File([jsonl], 'write-batch.jsonl', { type: 'application/jsonl' }),
    purpose: 'batch',
  })

  const created = await openai().batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  })
  return created.id
}

/**
 * Consulta un lote pendiente. Si NO está listo, devuelve `ready: false` y no
 * toca nada: los reintentos de las 10:30 y 14:30 lo recogen, y el identificador
 * sigue en el archivo.
 */
export async function collectWriteBatch(
  pending: PendingBatch,
  now: Date,
): Promise<CollectResult> {
  const expired = new Date(pending.expiresAt) < now

  const result =
    pending.provider === 'anthropic'
      ? await collectAnthropic(pending)
      : await collectOpenAi(pending)

  if (!result.ready && expired) {
    // A las 26 h se cancela, se registra el incidente y los candidatos vuelven a
    // la cola del día siguiente. Nunca se queda colgado.
    await cancelBatch(pending)
    return { ready: false, cards: [], expired: true }
  }

  return { ...result, expired: false }
}

async function collectAnthropic(pending: PendingBatch): Promise<CollectResult> {
  const batch = await anthropic().messages.batches.retrieve(pending.id)
  if (batch.processing_status !== 'ended') return { ready: false, cards: [], expired: false }

  const cards: CollectedCard[] = []
  for await (const entry of await anthropic().messages.batches.results(pending.id)) {
    const customId = entry.custom_id
    if (entry.result.type !== 'succeeded') {
      cards.push({
        customId,
        card: null,
        rawError: entry.result.type,
        inputTokens: 0,
        outputTokens: 0,
      })
      continue
    }

    const message = entry.result.message
    const toolUse = message.content.find((c) => c.type === 'tool_use')
    const raw =
      toolUse && toolUse.type === 'tool_use'
        ? JSON.stringify(toolUse.input)
        : message.content
            .filter((c): c is { type: 'text'; text: string; citations: null } => c.type === 'text')
            .map((c) => c.text)
            .join('')

    cards.push({
      customId,
      card: parseWrittenCard(raw),
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    })
  }

  return { ready: true, cards, expired: false }
}

async function collectOpenAi(pending: PendingBatch): Promise<CollectResult> {
  const batch = await openai().batches.retrieve(pending.id)
  if (batch.status !== 'completed') return { ready: false, cards: [], expired: false }
  if (!batch.output_file_id) return { ready: true, cards: [], expired: false }

  const content = await openai().files.content(batch.output_file_id)
  const text = await content.text()

  const cards: CollectedCard[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line) as {
        custom_id: string
        response?: {
          body?: {
            choices?: { message?: { content?: string } }[]
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }
        }
        error?: unknown
      }
      const body = row.response?.body
      const raw = body?.choices?.[0]?.message?.content ?? ''
      cards.push({
        customId: row.custom_id,
        card: raw ? parseWrittenCard(raw) : null,
        rawError: row.error ? JSON.stringify(row.error) : undefined,
        inputTokens: body?.usage?.prompt_tokens ?? 0,
        outputTokens: body?.usage?.completion_tokens ?? 0,
      })
    } catch {
      // Una línea corrupta no invalida el lote entero.
    }
  }

  return { ready: true, cards, expired: false }
}

async function cancelBatch(pending: PendingBatch): Promise<void> {
  try {
    if (pending.provider === 'anthropic') await anthropic().messages.batches.cancel(pending.id)
    else await openai().batches.cancel(pending.id)
  } catch {
    // Cancelar es un intento de cortesía: si falla, el lote caduca solo.
  }
}
