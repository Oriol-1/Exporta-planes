// La publicación falló una vez con un ZodError sobre `collections.0.url` que
// decía «Invalid URL» y nada más. La causa real era otra: la variable
// PUBLISH_BASE_URL no estaba configurada en el repositorio.
//
// El §3.5 pide lo contrario: que el error señale la CAUSA, no el síntoma, y que
// salte al arrancar y no al final del trabajo.
import { describe, expect, it } from 'vitest'
import { assertValidBaseUrl, InvalidBaseUrlError } from '../../src/publish/build'

describe('assertValidBaseUrl', () => {
  it('acepta una URL de GitHub Pages normal', () => {
    expect(() => assertValidBaseUrl('https://oriol-1.github.io/Exporta-planes')).not.toThrow()
    expect(() => assertValidBaseUrl('https://oriol-1.github.io/Exporta-planes/')).not.toThrow()
  })

  it('rechaza la cadena vacía, que es como llega una variable sin configurar', () => {
    expect(() => assertValidBaseUrl('')).toThrow(InvalidBaseUrlError)
    expect(() => assertValidBaseUrl('   ')).toThrow(InvalidBaseUrlError)
  })

  it('rechaza una URL relativa o malformada', () => {
    expect(() => assertValidBaseUrl('no-es-una-url')).toThrow(InvalidBaseUrlError)
    expect(() => assertValidBaseUrl('/v1')).toThrow(InvalidBaseUrlError)
  })

  it('rechaza un esquema que no sea http(s)', () => {
    expect(() => assertValidBaseUrl('ftp://ejemplo.test/x')).toThrow(InvalidBaseUrlError)
    expect(() => assertValidBaseUrl('file:///tmp/x')).toThrow(InvalidBaseUrlError)
  })

  it('el mensaje nombra la variable y dice cómo arreglarlo', () => {
    // Es la diferencia entre un error que se entiende y uno que hay que
    // investigar: el que falló en producción no mencionaba la variable.
    try {
      assertValidBaseUrl('')
      expect.unreachable('debería haber lanzado')
    } catch (e) {
      const message = (e as Error).message
      expect(message).toContain('PUBLISH_BASE_URL')
      expect(message).toContain('gh variable set')
      expect(message).toContain('CADENA VACÍA')
      expect(message).toContain('(vacío)')
    }
  })

  it('el mensaje muestra el valor recibido, para poder verlo de un vistazo', () => {
    try {
      assertValidBaseUrl('htp://mal-escrito')
      expect.unreachable('debería haber lanzado')
    } catch (e) {
      expect((e as Error).message).toContain('htp://mal-escrito')
    }
  })
})
