// Lectura tolerante del JSON que emite un modelo.
//
// Con `json_schema` estricto de OpenAI la respuesta es JSON puro y esto sobra.
// Con otros proveedores no: medido contra nemotron-3-super-120b, que con el
// MISMO lote a veces devuelve JSON limpio y a veces le antepone su razonamiento
// («We need to produce JSON for each candidate…»).
//
// NO relaja la validación: lo extraído sigue pasando por su esquema después.
import { describe, expect, it } from 'vitest'
import { parseJsonLoose } from '../../src/core/json'

describe('parseJsonLoose', () => {
  it('lee un JSON limpio, que es lo que debería pasar siempre', () => {
    const r = parseJsonLoose<{ results: number[] }>('{"results":[1,2]}')
    expect(r.ok).toBe(true)
    expect(r.via).toBe('directo')
    expect(r.value?.results).toEqual([1, 2])
  })

  it('quita el bloque de código de markdown', () => {
    const r = parseJsonLoose<{ a: number }>('```json\n{"a":1}\n```')
    expect(r.ok).toBe(true)
    expect(r.via).toBe('sin-bloque')
    expect(r.value?.a).toBe(1)
  })

  it('recorta el razonamiento que algunos modelos anteponen', () => {
    // El caso real que se midió con nemotron.
    const raw = 'We need to produce JSON for each candidate with fields.\n{"results":[{"id":"x"}]}'
    const r = parseJsonLoose<{ results: { id: string }[] }>(raw)
    expect(r.ok).toBe(true)
    expect(r.via).toBe('recortado')
    expect(r.value?.results[0]?.id).toBe('x')
  })

  it('recorta también la coletilla del final', () => {
    const r = parseJsonLoose<{ a: number }>('{"a":1}\n\nEspero que te sirva.')
    expect(r.ok).toBe(true)
    expect(r.value?.a).toBe(1)
  })

  it('NO se confunde con una llave dentro de una cadena', () => {
    // Los motivos y las evidencias son texto libre y llevan llaves y comillas
    // constantemente: buscar el último `}` a secas se rompería aquí.
    const raw = 'prólogo {"motivo":"cierra } aquí","ok":true} coletilla'
    const r = parseJsonLoose<{ motivo: string; ok: boolean }>(raw)
    expect(r.ok).toBe(true)
    expect(r.value?.motivo).toBe('cierra } aquí')
    expect(r.value?.ok).toBe(true)
  })

  it('respeta las comillas escapadas', () => {
    const raw = 'texto {"motivo":"dijo \\"hola\\" y se fue"} fin'
    const r = parseJsonLoose<{ motivo: string }>(raw)
    expect(r.ok).toBe(true)
    expect(r.value?.motivo).toBe('dijo "hola" y se fue')
  })

  it('lee también un array en la raíz', () => {
    const r = parseJsonLoose<number[]>('mira: [1,2,3] ya está')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual([1, 2, 3])
  })

  it('una respuesta TRUNCADA se rechaza: no se inventa el cierre', () => {
    // Es lo que pasó de verdad en dos lotes de la evaluación. Aceptar un JSON a
    // medias sería peor que descartarlo: publicaríamos fichas con datos a medio
    // leer.
    const r = parseJsonLoose('{"results":[{"id":"x","vale_el_viaje":9')
    expect(r.ok).toBe(false)
    expect(r.problem).toContain('completo')
  })

  it('una respuesta vacía o sin JSON se rechaza', () => {
    expect(parseJsonLoose('').ok).toBe(false)
    expect(parseJsonLoose('   ').ok).toBe(false)
    expect(parseJsonLoose('lo siento, no puedo ayudarte con eso').ok).toBe(false)
  })

  it('un JSON malformado se rechaza con su motivo', () => {
    const r = parseJsonLoose('{"a":1,,}')
    expect(r.ok).toBe(false)
    expect(r.problem).toContain('malformado')
  })
})
