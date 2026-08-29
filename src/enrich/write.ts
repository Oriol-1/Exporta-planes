// src/enrich/write.ts
// El redactor: `claude-opus-5` vía Message Batches API, 50 % de descuento (§6.3).
//
// Es la parte que más importa y la única donde se usa el modelo caro. La ficha
// final NO contiene ni una frase de la fuente: el modelo recibe material
// extraído como DATOS, no como texto a versionar, y escribe de cero para un
// lector que no conoce la ciudad.
//
// PROMPT_VERSION vive en src/core/hash.ts. Tocar este archivo sin actualizar
// `evals/` hace fallar la CI a propósito (§5.7).
import type { CuratedCollection } from '../../contracts/curated'
import type { Cluster, WrittenCard } from '../types'

/** Prompt de sistema. Constante y cacheado; versión `write-v1`. */
export const WRITE_SYSTEM_PROMPT = `Escribes fichas para una guía de Barcelona dirigida a viajeros que pasan pocos días
en la ciudad y no conocen ni el idioma ni los barrios. Escribes en español y en
inglés, y las dos versiones son originales: la inglesa no es una traducción literal
de la española, sino el mismo contenido escrito para ese lector.

QUÉ HACES
- Reescribes por completo. NUNCA copies ni parafrasees de cerca el material de
  origen: son datos para ti, no texto a versionar. Cambia el orden, la estructura y
  el vocabulario.
- Explicas lo que un local da por supuesto: dónde cae el barrio, qué se ve, cuánto
  se tarda, si hay cola, si hace falta reservar.
- Escribes en segunda persona del plural implícita, tono claro y directo, sin
  adjetivos de folleto. Prohibido: "imprescindible", "no te lo puedes perder",
  "joya escondida", "experiencia única", "mágico", "hidden gem", "must-see".

QUÉ NO HACES NUNCA
- No inventas. Ni un precio, ni un horario, ni una fecha, ni una parada de metro, ni
  un dato de la exposición. Si el material no lo dice, el campo va vacío.
- No conviertes precios ni calculas duraciones que no estén en el material, salvo
  que la conversión sea aritmética directa sobre un dato presente.
- No opinas sobre la calidad artística. Dices qué es y por qué le puede interesar a
  este lector.

EVIDENCIAS (la regla más importante)
Para CADA campo factual —precio, horarios, fechas, duración, reserva, idioma— debes
incluir en "evidencias" el fragmento LITERAL del material del que lo sacaste,
copiado carácter a carácter. Si no puedes señalar el fragmento literal, deja el
campo vacío y no lo incluyas en "evidencias". Un campo sin evidencia se elimina
automáticamente después, así que inventarlo no sirve de nada.

LONGITUDES
- resumen: 90-130 palabras en cada idioma.
- porQueMerecePena: UNA frase, máximo 22 palabras, sin subordinadas encadenadas.
- comoLlegar: máximo 25 palabras, empezando por la parada más cercana del material.

Devuelve EXCLUSIVAMENTE el JSON del esquema, sin texto antes ni después.`

/** Instrucción extra del único reintento tras detectar copia (§6.1). */
export const WRITE_RETRY_NUDGE = `AVISO: tu respuesta anterior reutilizaba frases literales del material. Vuelve a
escribirla cambiando por completo la estructura de las frases y el vocabulario.
Los nombres propios y los topónimos SÍ se mantienen; todo lo demás, no.`

/** Esquema de salida forzado (§6.3). */
export const WRITE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'titulo', 'resumen', 'porQueMerecePena', 'evidencias'],
  properties: {
    slug: { type: 'string', pattern: '^[a-z0-9-]{3,60}$' },
    titulo: {
      type: 'object',
      additionalProperties: false,
      required: ['es', 'en'],
      properties: {
        es: { type: 'string', maxLength: 90 },
        en: { type: 'string', maxLength: 90 },
      },
    },
    resumen: {
      type: 'object',
      additionalProperties: false,
      required: ['es', 'en'],
      properties: {
        es: { type: 'string', maxLength: 1200 },
        en: { type: 'string', maxLength: 1200 },
      },
    },
    porQueMerecePena: {
      type: 'object',
      additionalProperties: false,
      required: ['es', 'en'],
      properties: {
        es: { type: 'string', maxLength: 160 },
        en: { type: 'string', maxLength: 160 },
      },
    },
    comoLlegar: {
      type: 'object',
      properties: { es: { type: 'string' }, en: { type: 'string' } },
    },
    queIncluye: {
      type: 'object',
      properties: { es: { type: 'string' }, en: { type: 'string' } },
    },
    duracionMin: { type: 'integer', minimum: 15, maximum: 600 },
    reserva: { type: 'string', enum: ['ninguna', 'recomendada', 'obligatoria'] },
    reservaDiasAntelacion: { type: 'integer', minimum: 0, maximum: 90 },
    publico: { type: 'string', enum: ['todos', 'familiar', 'adultos', 'mayores'] },
    idiomaActividad: {
      type: 'array',
      items: { type: 'string', enum: ['ca', 'es', 'en', 'sin-idioma'] },
    },
    museo: {
      type: 'object',
      properties: {
        horarios: {
          type: 'array',
          items: {
            type: 'object',
            required: ['dias', 'horas'],
            properties: { dias: { type: 'string' }, horas: { type: 'string' } },
          },
        },
        gratuidades: { type: 'array', items: { type: 'string', maxLength: 120 } },
        exposicionVigente: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            hasta: { type: 'string', format: 'date' },
          },
        },
        minutosVisita: { type: 'integer', minimum: 20, maximum: 300 },
        entradaAnticipada: { type: 'boolean' },
      },
    },
    espectaculo: {
      type: 'object',
      properties: {
        artistaCompania: { type: 'string', maxLength: 120 },
        sala: { type: 'string', maxLength: 120 },
        sobretitulos: { type: 'array', items: { type: 'string', enum: ['ca', 'es', 'en'] } },
      },
    },
    evidencias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['campo', 'fragmento'],
        properties: {
          campo: { type: 'string' },
          fragmento: { type: 'string', maxLength: 300 },
        },
      },
    },
  },
} as const

/** El prompt de usuario: una ficha, con su colección y su material. */
export function buildWriteUserPrompt(
  collection: CuratedCollection,
  material: string,
  retry = false,
): string {
  const head = `COLECCION: ${collection}\nMATERIAL:\n${material}`
  return retry ? `${WRITE_RETRY_NUDGE}\n\n${head}` : head
}

/** Términos de folleto prohibidos. `pnpm eval:write` los caza mecánicamente. */
export const BANNED_TERMS = [
  'imprescindible',
  'no te lo puedes perder',
  'joya escondida',
  'experiencia unica',
  'experiencia única',
  'magico',
  'mágico',
  'hidden gem',
  'must-see',
  'must see',
] as const

/** Una petición del lote. `customId` es la clave de caché: hace idempotente collect. */
export interface WriteJob {
  readonly customId: string
  readonly cluster: Cluster
  readonly slug: string
  readonly material: string
  readonly userPrompt: string
}

export function buildJob(
  cluster: Cluster,
  slug: string,
  material: string,
  customId: string,
  retry = false,
): WriteJob {
  return {
    customId,
    cluster,
    slug,
    material,
    userPrompt: buildWriteUserPrompt(cluster.collection, material, retry),
  }
}

/** Parsea la respuesta cruda del modelo. Un JSON inválido devuelve `null`. */
export function parseWrittenCard(raw: string): WrittenCard | null {
  try {
    const parsed = JSON.parse(raw) as WrittenCard
    if (typeof parsed.slug !== 'string' || !parsed.titulo || !parsed.resumen) return null
    if (!Array.isArray(parsed.evidencias)) return null
    return parsed
  } catch {
    return null
  }
}
