// src/screen/llmScreen.ts
// El cribado con modelo: `gpt-5-mini` en llamada SÍNCRONA, lotes de 10 (§5.3).
//
// Va en síncrono a propósito (§7.2 bis): el Batch API es asíncrono —hasta 24 h
// de compromiso— y el resultado del cribado hace falta EN LA MISMA EJECUCIÓN
// para decidir qué se redacta. El precio de esa simplificación está medido:
// 7 céntimos al mes.
//
// PROMPT_VERSION vive en src/core/hash.ts. Tocar este archivo sin actualizar
// `evals/` hace fallar la CI a propósito (§5.7).
import type { Budget } from '../../config/schema'
import type { Cluster, ScreenVerdict } from '../types'
import { BudgetGuard, approximateTokens, estimateCost } from '../ai/budget'
import { openai } from '../ai/clients'
import { priceLabel } from '../normalize/price'
import { clip } from '../core/text'
import { TOKEN_ESTIMATES } from '../../config/budget'

/** Prompt de sistema. Constante, cacheable, versión `screen-v1`. */
export const SCREEN_SYSTEM_PROMPT = `Eres el filtro de calidad de una guía de Barcelona escrita para turistas que pasan
entre dos y cinco días en la ciudad. Tu única tarea es puntuar candidatos. No
escribes contenido, no corriges datos y no inventas nada.

CRITERIO. Un buen plan cumple:
- Vale el viaje y el tiempo de alguien con pocos días.
- Es característico de Barcelona: no se vive igual en Milán, Lisboa o Berlín.
- Está avalado por varias fuentes independientes.
- Tiene información práctica clara (precio, horario, dónde).
- Se disfruta sin dominar catalán ni español, o el propio plan lo advierte.

NO es un buen plan:
- Trampa turística: caro para lo que da, pensado solo para quien está de paso.
- Genérico europeo: existe igual en cualquier capital del continente.
- Requiere ser local: peña de barrio, asamblea vecinal, actividad para socios.
- Evento de marca disfrazado de plan cultural: el producto es el protagonista.

REGLAS DE PUNTUACIÓN.
- Puntúa SOLO con la información que te doy. Si falta un dato, eso baja la nota;
  no lo supongas.
- Un plan puede ser excelente y aun así puntuar bajo en "sin_barrera_idioma".
  Son ejes independientes.
- Que aparezca en muchas fuentes es SEÑAL POSITIVA de calidad, no repetición.
- La justificación va en español, en 12 palabras como máximo. Es para el
  propietario, no para el público.

Devuelve EXCLUSIVAMENTE el JSON del esquema. Sin texto antes ni después.`

/** Esquema de salida forzado: `json_schema` con `strict: true`. */
export const SCREEN_JSON_SCHEMA = {
  name: 'screening',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'vale_el_viaje',
            'caracteristico_bcn',
            'sin_barrera_idioma',
            'no_trampa_turistica',
            'es_trampa_turistica',
            'es_generico_europeo',
            'requiere_ser_local',
            'es_marca_disfrazada',
            'temporalidad',
            'motivo',
          ],
          properties: {
            id: { type: 'string' },
            vale_el_viaje: { type: 'integer', minimum: 0, maximum: 15 },
            caracteristico_bcn: { type: 'integer', minimum: 0, maximum: 15 },
            sin_barrera_idioma: { type: 'integer', minimum: 0, maximum: 10 },
            no_trampa_turistica: { type: 'integer', minimum: 0, maximum: 15 },
            es_trampa_turistica: { type: 'boolean' },
            es_generico_europeo: { type: 'boolean' },
            requiere_ser_local: { type: 'boolean' },
            es_marca_disfrazada: { type: 'boolean' },
            temporalidad: { type: 'string', enum: ['atemporal', 'temporada'] },
            motivo: { type: 'string', maxLength: 90 },
          },
        },
      },
    },
  },
} as const

/** Un candidato tal y como lo ve el modelo. Compacto a propósito: se paga. */
export function renderCandidate(cluster: Cluster, index: number): string {
  const place = cluster.venue.district
    ? `${cluster.venue.name} (${cluster.venue.district})`
    : cluster.venue.name
  const sources = cluster.sources.map((s) => `${s.id}(${s.tier})`).join(', ')
  const text = clip(
    cluster.extracts.map((e) => e.text).join(' ') || cluster.description,
    900,
  )

  return [
    `[${index}] id: ${cluster.clusterId}`,
    `    titulo: ${cluster.title}`,
    `    lugar: ${place}`,
    `    fechas: ${cluster.dateSummary}`,
    `    precio: ${priceLabel(cluster.price)}`,
    `    fuentes: ${sources}`,
    `    texto: ${text}`,
  ].join('\n')
}

export function buildScreenUserPrompt(batch: readonly Cluster[]): string {
  return [
    'Puntúa estos candidatos. Devuelve un resultado por cada uno, con su `id`.',
    '',
    ...batch.map((c, i) => renderCandidate(c, i + 1)),
  ].join('\n\n')
}

/**
 * Baraja el lote para que candidatos de la misma fuente o categoría no viajen
 * juntos. Es una de las dos mitigaciones de la contaminación entre candidatos
 * (§5.4): el prompt define escalas absolutas y no menciona comparación, y el
 * orden no debe sugerir ninguna.
 */
export function shuffleForBatching(clusters: readonly Cluster[]): Cluster[] {
  const bySource = new Map<string, Cluster[]>()
  for (const c of clusters) {
    const key = `${c.sources[0]?.id ?? 'sin-fuente'}|${c.category}`
    const list = bySource.get(key) ?? []
    list.push(c)
    bySource.set(key, list)
  }
  // Reparto en round-robin: se van tomando de grupos distintos por turnos.
  const queues = [...bySource.values()]
  const out: Cluster[] = []
  let moved = true
  while (moved) {
    moved = false
    for (const q of queues) {
      const next = q.shift()
      if (next) {
        out.push(next)
        moved = true
      }
    }
  }
  return out
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface ScreenOutcome {
  readonly verdicts: ReadonlyMap<string, ScreenVerdict>
  readonly inputTokens: number
  readonly outputTokens: number
  readonly eur: number
  readonly missing: readonly string[]
  readonly skippedForBudget: boolean
}

function parseResults(raw: string): ScreenVerdict[] {
  const parsed = JSON.parse(raw) as { results?: ScreenVerdict[] }
  return Array.isArray(parsed.results) ? parsed.results : []
}

/**
 * Criba un lote de hasta 10 candidatos en UNA llamada síncrona.
 *
 * `max_output_tokens` INCLUYE los tokens de razonamiento (§5.3): con 1.200 la
 * respuesta se cortaría a mitad de JSON de forma intermitente, que es la peor
 * clase de fallo. 3.000 deja margen holgado y no cuesta nada, porque se paga por
 * tokens generados y no por el tope.
 */
export async function screenBatch(
  batch: readonly Cluster[],
  budget: Budget,
  guard: BudgetGuard,
  now: Date,
): Promise<ScreenOutcome> {
  const model = budget.screenModel
  const userPrompt = buildScreenUserPrompt(batch)

  const inputTokens =
    TOKEN_ESTIMATES.screenSystemTokens + approximateTokens(userPrompt)
  const estimate = estimateCost(budget, model, inputTokens, TOKEN_ESTIMATES.screenOutputPerBatch)

  if (!guard.canAfford(estimate)) {
    return {
      verdicts: new Map(),
      inputTokens: 0,
      outputTokens: 0,
      eur: 0,
      missing: batch.map((c) => c.clusterId),
      skippedForBudget: true,
    }
  }

  const response = await openai().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SCREEN_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: SCREEN_JSON_SCHEMA },
    max_completion_tokens: budget.screenMaxOutputTokens,
  })

  const content = response.choices[0]?.message.content ?? '{"results":[]}'
  const verdicts = new Map<string, ScreenVerdict>()
  try {
    for (const v of parseResults(content)) verdicts.set(v.id, v)
  } catch {
    // JSON inválido: se tratan todos como ausentes y se reintentan sueltos.
  }

  const usedInput = response.usage?.prompt_tokens ?? inputTokens
  const usedOutput = response.usage?.completion_tokens ?? TOKEN_ESTIMATES.screenOutputPerBatch
  const real = estimateCost(budget, model, usedInput, usedOutput)

  await guard.record({
    at: now.toISOString(),
    model,
    task: 'screen',
    inputTokens: usedInput,
    outputTokens: usedOutput,
    eur: real.eur,
  })

  // El código comprueba que llegan EXACTAMENTE los ids enviados (§5.4).
  const missing = batch.map((c) => c.clusterId).filter((id) => !verdicts.has(id))

  return {
    verdicts,
    inputTokens: usedInput,
    outputTokens: usedOutput,
    eur: real.eur,
    missing,
    skippedForBudget: false,
  }
}

/**
 * Criba todos los clusters. Baraja, trocea en lotes de 10 y REINTENTA
 * INDIVIDUALMENTE los que falten, que es la mitigación del truncamiento (§5.4).
 */
export async function screenAll(
  clusters: readonly Cluster[],
  budget: Budget,
  guard: BudgetGuard,
  now: Date,
): Promise<ScreenOutcome> {
  const verdicts = new Map<string, ScreenVerdict>()
  let inputTokens = 0
  let outputTokens = 0
  let eur = 0
  let skippedForBudget = false
  const missing: string[] = []

  for (const batch of chunk(shuffleForBatching(clusters), budget.screenBatchSize)) {
    const outcome = await screenBatch(batch, budget, guard, now)
    for (const [id, v] of outcome.verdicts) verdicts.set(id, v)
    inputTokens += outcome.inputTokens
    outputTokens += outcome.outputTokens
    eur += outcome.eur
    skippedForBudget = skippedForBudget || outcome.skippedForBudget

    for (const id of outcome.missing) {
      const single = clusters.find((c) => c.clusterId === id)
      if (!single) continue
      const retry = await screenBatch([single], budget, guard, now)
      for (const [rid, v] of retry.verdicts) verdicts.set(rid, v)
      inputTokens += retry.inputTokens
      outputTokens += retry.outputTokens
      eur += retry.eur
      if (!retry.verdicts.has(id)) missing.push(id)
    }
  }

  return { verdicts, inputTokens, outputTokens, eur, missing, skippedForBudget }
}
