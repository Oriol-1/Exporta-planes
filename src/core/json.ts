// src/core/json.ts
// Lectura TOLERANTE de un JSON emitido por un modelo.
//
// Con `json_schema` estricto de OpenAI la respuesta es JSON puro y esto sobra.
// Con cualquier otro proveedor, no: hay modelos que anteponen su razonamiento
// («We need to produce JSON for each candidate…»), lo envuelven en un bloque de
// código, o lo rematan con una coletilla. Medido contra
// `nvidia/nemotron-3-super-120b-a12b`: con el MISMO lote, a veces JSON limpio y
// a veces con prólogo.
//
// Esto NO relaja la validación: lo que se extrae sigue pasando por su esquema
// después. Solo evita tirar una respuesta correcta por la envoltura.

/** Quita un bloque de código markdown, si el modelo lo puso. */
function stripFence(text: string): string {
  const fence = /^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/.exec(text)
  return fence?.[1] ?? text
}

/**
 * Recorta al primer objeto o array JSON EQUILIBRADO que haya en el texto.
 *
 * Se cuentan llaves y corchetes respetando las cadenas y los escapes: buscar el
 * último `}` a secas se rompería con un `}` dentro de una cadena, que en este
 * proyecto aparece constantemente (los motivos y las evidencias son texto libre).
 */
function firstBalanced(text: string): string | null {
  const inicio = text.search(/[{[]/)
  if (inicio === -1) return null

  const abre = text[inicio] === '{' ? '{' : '['
  const cierra = abre === '{' ? '}' : ']'

  let nivel = 0
  let enCadena = false
  let escapado = false

  for (let i = inicio; i < text.length; i++) {
    const c = text[i]

    if (enCadena) {
      if (escapado) escapado = false
      else if (c === '\\') escapado = true
      else if (c === '"') enCadena = false
      continue
    }

    if (c === '"') enCadena = true
    else if (c === abre) nivel++
    else if (c === cierra) {
      nivel--
      if (nivel === 0) return text.slice(inicio, i + 1)
    }
  }

  return null // se quedó abierto: la respuesta viene truncada
}

export interface LooseParse<T> {
  readonly ok: boolean
  readonly value?: T | undefined
  /** Cómo se consiguió leer: útil para saber si un modelo se porta bien. */
  readonly via?: 'directo' | 'sin-bloque' | 'recortado' | undefined
  readonly problem?: string | undefined
}

/** Intenta leer un JSON de la respuesta de un modelo, en tres pasadas. */
export function parseJsonLoose<T>(raw: string): LooseParse<T> {
  const texto = raw.trim()
  if (texto === '') return { ok: false, problem: 'respuesta vacía' }

  // 1 · Tal cual, que es lo que debería pasar siempre.
  try {
    return { ok: true, value: JSON.parse(texto) as T, via: 'directo' }
  } catch {
    /* se sigue intentando */
  }

  // 2 · Sin el bloque de código de markdown.
  const sinBloque = stripFence(texto)
  if (sinBloque !== texto) {
    try {
      return { ok: true, value: JSON.parse(sinBloque) as T, via: 'sin-bloque' }
    } catch {
      /* se sigue intentando */
    }
  }

  // 3 · Recortando al primer objeto equilibrado, por si hay prólogo o coletilla.
  const recortado = firstBalanced(sinBloque)
  if (recortado !== null) {
    try {
      return { ok: true, value: JSON.parse(recortado) as T, via: 'recortado' }
    } catch (e) {
      return { ok: false, problem: `JSON malformado: ${(e as Error).message}` }
    }
  }

  return { ok: false, problem: 'no hay ningún JSON completo en la respuesta' }
}
