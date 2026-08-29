// src/crawl/extract/selectors.ts
// ÚLTIMO RECURSO (§4.5). Los selectores son la parte frágil —un rediseño los
// rompe— y por eso nunca son la primera opción: se declaran por fuente en su
// adaptador y solo se consultan cuando JSON-LD y OpenGraph no dieron nada.
import * as cheerio from 'cheerio'
import type { RawExtract } from '../../types'
import { stripHtml } from '../../core/text'

/** Selectores CSS de una fuente concreta. Todos opcionales. */
export interface SelectorMap {
  readonly title?: string | undefined
  readonly description?: string | undefined
  readonly body?: string | undefined
  readonly image?: string | undefined
  readonly price?: string | undefined
  readonly schedule?: string | undefined
  readonly venue?: string | undefined
  readonly address?: string | undefined
  readonly officialUrl?: string | undefined
  readonly ticketsUrl?: string | undefined
}

/** Selectores genéricos que funcionan en la mayoría de WordPress. */
export const DEFAULT_SELECTORS: SelectorMap = {
  title: 'h1',
  body: 'article, main, .entry-content, .post-content',
  image: 'article img, .entry-content img',
}

export function extractWithSelectors(html: string, map: SelectorMap): RawExtract[] {
  const $ = cheerio.load(html)

  const text = (selector: string | undefined): string | undefined => {
    if (!selector) return undefined
    const v = stripHtml($(selector).first().text())
    return v || undefined
  }

  const attr = (selector: string | undefined, name: string): string | undefined => {
    if (!selector) return undefined
    const v = $(selector).first().attr(name)
    return v || undefined
  }

  const lines = (selector: string | undefined): string[] | undefined => {
    if (!selector) return undefined
    const out: string[] = []
    $(selector).each((_, el) => {
      const t = stripHtml($(el).text())
      if (t) out.push(t)
    })
    return out.length > 0 ? out.slice(0, 20) : undefined
  }

  const title = text(map.title)
  const body = text(map.body)
  if (!title && !body) return []

  return [
    {
      via: 'selectors',
      title,
      description: text(map.description),
      bodyText: body,
      image: attr(map.image, 'src'),
      priceText: text(map.price),
      scheduleLines: lines(map.schedule),
      venueName: text(map.venue),
      address: text(map.address),
      officialUrl: attr(map.officialUrl, 'href'),
      ticketsUrl: attr(map.ticketsUrl, 'href'),
    },
  ]
}

/** Texto útil de la página, para el material de redacción y el prefiltro. */
export function extractBodyText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, header, footer, aside, form, noscript').remove()
  const scoped = $('article, main, .entry-content, .post-content').first()
  const root = scoped.length > 0 ? scoped : $('body')
  return stripHtml(root.text())
}
