// src/crawl/extract/opengraph.ts
// Respaldo cuando no hay JSON-LD (§4.5). Menos rico, pero casi universal:
// cualquier CMS moderno emite og:title y og:description para que la página se
// vea bien al compartirla.
import * as cheerio from 'cheerio'
import type { RawExtract } from '../../types'
import { stripHtml } from '../../core/text'

export function extractOpenGraph(html: string): RawExtract[] {
  const $ = cheerio.load(html)

  const meta = (prop: string): string | undefined => {
    const v =
      $(`meta[property="${prop}"]`).attr('content') ??
      $(`meta[name="${prop}"]`).attr('content')
    const cleaned = v ? stripHtml(v) : ''
    return cleaned || undefined
  }

  const title = meta('og:title') ?? (stripHtml($('title').first().text()) || undefined)
  const description = meta('og:description') ?? meta('description')

  if (!title && !description) return []

  return [
    {
      via: 'opengraph',
      title,
      description,
      image: meta('og:image'),
      url: meta('og:url'),
      startDate: meta('article:published_time'),
      officialUrl: meta('og:url'),
    },
  ]
}
