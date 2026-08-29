// La puerta del §5.7 tiene que distinguir un PROMPT cambiado de un ARCHIVO
// tocado. La primera versión miraba el archivo y daba falsos positivos:
// `llmScreen.ts` contiene el prompt Y el manejo de errores de red, así que
// arreglar un reintento hacía fallar la CI pidiendo una evaluación que no venía
// a cuento — y eso solo enseña a saltarse el guardián.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from '../../src/core/hash'
import { ROOT } from '../../src/store/paths'
import { SCREEN_SYSTEM_PROMPT, SCREEN_JSON_SCHEMA } from '../../src/screen/llmScreen'
import { WRITE_SYSTEM_PROMPT, WRITE_JSON_SCHEMA } from '../../src/enrich/write'
import { PROMPT_VERSION } from '../../src/core/hash'

describe('los prompts están donde la puerta los busca', () => {
  it('las constantes que vigila promptCheck existen y no están vacías', () => {
    expect(SCREEN_SYSTEM_PROMPT.length).toBeGreaterThan(500)
    expect(WRITE_SYSTEM_PROMPT.length).toBeGreaterThan(500)
    expect(SCREEN_JSON_SCHEMA.strict).toBe(true)
    expect(WRITE_JSON_SCHEMA.required).toContain('evidencias')
  })

  it('cada prompt se declara con `export const`, que es lo que extrae la puerta', () => {
    const screen = readFileSync(join(ROOT, 'src/screen/llmScreen.ts'), 'utf8')
    const write = readFileSync(join(ROOT, 'src/enrich/write.ts'), 'utf8')
    const hash = readFileSync(join(ROOT, 'src/core/hash.ts'), 'utf8')

    expect(screen).toContain('export const SCREEN_SYSTEM_PROMPT')
    expect(screen).toContain('export const SCREEN_JSON_SCHEMA')
    expect(write).toContain('export const WRITE_SYSTEM_PROMPT')
    expect(write).toContain('export const WRITE_JSON_SCHEMA')
    expect(hash).toContain('export const PROMPT_VERSION')
  })

  it('PROMPT_VERSION viaja en cada ficha para saber cuál rehacer', () => {
    expect(PROMPT_VERSION.screen).toBe('screen-v1')
    expect(PROMPT_VERSION.write).toBe('write-v1')
  })
})

describe('el prompt de cribado dice lo que el §5.3 exige', () => {
  it('define los cuatro criterios de un buen plan', () => {
    for (const idea of ['Vale el viaje', 'característico de Barcelona', 'varias fuentes', 'sin dominar catalán']) {
      expect(SCREEN_SYSTEM_PROMPT).toContain(idea)
    }
  })

  it('define los cuatro vetos duros', () => {
    for (const veto of ['Trampa turística', 'Genérico europeo', 'Requiere ser local', 'marca disfrazado']) {
      expect(SCREEN_SYSTEM_PROMPT).toContain(veto)
    }
  })

  it('prohíbe suponer datos que faltan', () => {
    expect(SCREEN_SYSTEM_PROMPT).toContain('no lo supongas')
  })

  it('dice que el consenso es señal POSITIVA, que es la inversión clave (§2.1)', () => {
    expect(SCREEN_SYSTEM_PROMPT).toContain('SEÑAL POSITIVA')
  })
})

describe('el prompt de redacción dice lo que el §6.3 exige', () => {
  it('prohíbe copiar y explica por qué el material son datos', () => {
    expect(WRITE_SYSTEM_PROMPT).toContain('NUNCA copies')
    expect(WRITE_SYSTEM_PROMPT).toContain('no texto a versionar')
  })

  it('impone la regla de las evidencias literales, que es la más importante', () => {
    expect(WRITE_SYSTEM_PROMPT).toContain('fragmento LITERAL')
    expect(WRITE_SYSTEM_PROMPT).toContain('el campo va vacío')
  })

  it('prohíbe el vocabulario de folleto en los dos idiomas', () => {
    for (const t of ['imprescindible', 'joya escondida', 'hidden gem', 'must-see']) {
      expect(WRITE_SYSTEM_PROMPT).toContain(t)
    }
  })

  it('fija las longitudes que comprueba pnpm eval:write', () => {
    expect(WRITE_SYSTEM_PROMPT).toContain('90-130 palabras')
    expect(WRITE_SYSTEM_PROMPT).toContain('22 palabras')
  })
})

describe('huella estable', () => {
  it('el mismo prompt produce la misma huella', () => {
    expect(sha256(SCREEN_SYSTEM_PROMPT)).toBe(sha256(SCREEN_SYSTEM_PROMPT))
  })

  it('un carácter distinto produce otra huella', () => {
    expect(sha256(SCREEN_SYSTEM_PROMPT)).not.toBe(sha256(SCREEN_SYSTEM_PROMPT + ' '))
  })
})
