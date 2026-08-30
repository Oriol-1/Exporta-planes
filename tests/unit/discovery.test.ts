// REGRESIÓN: el rastreo de planes y espectáculos traía CERO candidatos.
//
// Se descubrió mirando la primera ejecución programada de verdad: 66 URL
// descubiertas, 0 descargadas. Dos causas independientes, las dos silenciosas
// —el workflow terminaba «con éxito»—, que es la peor clase de fallo.
import { describe, expect, it } from 'vitest'
import { chooseSubSitemaps } from '../../src/crawl/discover'
import { adapterFor } from '../../src/crawl/adapters'
import { SOURCES } from '../../config/sources'

describe('chooseSubSitemaps · defecto 1: se leían los 8 PRIMEROS', () => {
  // Índice real de teatrebarcelona.com, recortado. Las obras están en
  // `espectacle-*`; los primeros del índice son revista y páginas estáticas.
  const teatre = [
    { url: 'https://t.test/es/post-sitemap.xml', lastmod: '2026-08-27' },
    { url: 'https://t.test/es/post-sitemap2.xml', lastmod: '2022-05-14' },
    { url: 'https://t.test/es/page-sitemap.xml', lastmod: '2026-08-28' },
    { url: 'https://t.test/es/venue-sitemap.xml', lastmod: '2026-07-24' },
    { url: 'https://t.test/es/espectacle-sitemap.xml', lastmod: '2026-08-27' },
    { url: 'https://t.test/es/espectacle-sitemap2.xml', lastmod: '2017-08-07' },
    { url: 'https://t.test/es/espectacle-sitemap13.xml', lastmod: '2026-08-29' },
    { url: 'https://t.test/es/genere-sitemap.xml', lastmod: '2026-08-29' },
  ]

  it('con `sitemapIncludes` se queda SOLO con los que traen contenido', () => {
    const chosen = chooseSubSitemaps(teatre, ['espectacle'], 8)
    expect(chosen).toHaveLength(3)
    expect(chosen.every((c) => c.url.includes('espectacle'))).toBe(true)
  })

  it('ordena por lastmod descendente: lo vivo primero, no lo de 2017', () => {
    const chosen = chooseSubSitemaps(teatre, ['espectacle'], 2)
    expect(chosen.map((c) => c.url.split('/').pop())).toEqual([
      'espectacle-sitemap13.xml',
      'espectacle-sitemap.xml',
    ])
  })

  it('sin filtro, descarta taxonomías y metadatos', () => {
    const chosen = chooseSubSitemaps(teatre, undefined, 8)
    expect(chosen.some((c) => c.url.includes('genere'))).toBe(false)
    expect(chosen.some((c) => c.url.includes('post-sitemap'))).toBe(true)
  })

  it('si el filtro no casa con nada, sigue con todos en vez de quedarse a ciegas', () => {
    // La fuente ha cambiado su estructura: mejor rastrear de más que nada.
    const chosen = chooseSubSitemaps(teatre, ['inexistente'], 8)
    expect(chosen.length).toBeGreaterThan(0)
  })

  it('respeta el tope', () => {
    expect(chooseSubSitemaps(teatre, undefined, 3)).toHaveLength(3)
  })

  it('los sub-sitemaps sin lastmod van al final, no al principio', () => {
    const mixed = [
      { url: 'https://t.test/sin-fecha.xml', lastmod: undefined },
      { url: 'https://t.test/reciente.xml', lastmod: '2026-08-29' },
    ]
    expect(chooseSubSitemaps(mixed, undefined, 1)[0]?.url).toContain('reciente')
  })
})

describe('isDetailUrl · defecto 2: se descartaban las fichas de verdad', () => {
  const teatre = adapterFor('teatre-barcelona')!
  const secreta = adapterFor('barcelona-secreta')!

  it('teatre-barcelona publica en CASTELLANO: /espectaculo/, no /espectacle/', () => {
    // El adaptador solo miraba la forma catalana, así que descartaba el 100 %.
    expect(teatre.isDetailUrl('https://www.teatrebarcelona.com/es/espectaculo/apocalipsi-fatxa')).toBe(true)
    expect(teatre.isDetailUrl('https://www.teatrebarcelona.com/ca/espectacle/canada')).toBe(true)
    expect(teatre.isDetailUrl('https://www.teatrebarcelona.com/es/obra/el-rei-lear')).toBe(true)
  })

  it('teatre-barcelona sigue descartando la revista y las salas', () => {
    expect(teatre.isDetailUrl('https://www.teatrebarcelona.com/es/revista/un-circo-donde-todo-es-posible')).toBe(false)
    expect(teatre.isDetailUrl('https://www.teatrebarcelona.com/es/teatro/sala-beckett')).toBe(false)
  })

  it('barcelona-secreta publica en la RAÍZ, con un solo segmento', () => {
    // El filtro genérico exigía dos o más segmentos y descartaba toda la fuente.
    expect(secreta.isDetailUrl('https://barcelonasecreta.com/tirolina-mas-larga-catalunya-boi-taull/')).toBe(true)
    expect(secreta.isDetailUrl('https://barcelonasecreta.com/cartel-merce-2026-gratis-mural-barcelona/')).toBe(true)
  })

  it('pero la portada y los listados siguen fuera', () => {
    expect(secreta.isDetailUrl('https://barcelonasecreta.com/')).toBe(false)
    expect(secreta.isDetailUrl('https://barcelonasecreta.com/category/cultura/')).toBe(false)
    expect(secreta.isDetailUrl('https://barcelonasecreta.com/author/redaccion/')).toBe(false)
    expect(secreta.isDetailUrl('https://barcelonasecreta.com/cultura/')).toBe(false)
  })
})

describe('la configuración lleva los filtros que hacen falta', () => {
  it('teatre-barcelona filtra a `espectacle`', () => {
    const s = SOURCES.find((s) => s.id === 'teatre-barcelona')!
    expect(s.discovery.kind).toBe('sitemap')
    if (s.discovery.kind !== 'sitemap') return
    expect(s.discovery.sitemapIncludes).toContain('espectacle')
  })

  it('barcelona-secreta filtra a `posts_v2`, el original en castellano', () => {
    // Su índice repite el mismo contenido en siete idiomas: rastrear las
    // traducciones sería multiplicar por siete para publicar lo mismo.
    const s = SOURCES.find((s) => s.id === 'barcelona-secreta')!
    if (s.discovery.kind !== 'sitemap') return
    expect(s.discovery.sitemapIncludes).toContain('posts_v2')
  })
})
