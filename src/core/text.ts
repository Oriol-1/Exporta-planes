// src/core/text.ts
// Normalización, trigramas y solapamiento de n-gramas. Todo puro: sin red, sin
// disco, sin reloj.

/**
 * Normalización de comparación: minúsculas, sin acentos, espacios colapsados.
 * Un cambio de tipografía o un espacio de más no debe costar dinero (§5.2).
 */
export function norm(s: string | undefined | null): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalización de deduplicación de planonmap, calcada carácter por carácter
 * de `lib/sources/dedupe.ts` (§1.9). NO la toques: si diverge, dejamos de poder
 * decir «este plan curado ya está en el feed».
 */
export function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes y diacríticos
    .replace(/[^a-z0-9]/g, '') // quita signos, espacios y emojis
    .slice(0, 40)
}

/** Trigramas de caracteres sobre el texto normalizado. */
export function trigrams(s: string): Set<string> {
  const t = norm(s).replace(/\s/g, '')
  const out = new Set<string>()
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3))
  if (out.size === 0 && t.length > 0) out.add(t)
  return out
}

/** Jaccard entre dos conjuntos. 1 = idénticos, 0 = disjuntos. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/** Similitud de títulos por trigramas. El umbral de agrupación es 0,82 (§4.8). */
export function titleSimilarity(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b))
}

/** n-gramas de PALABRAS, que es la unidad en la que se mide el plagio (§6.1). */
export function wordNgrams(s: string, n: number): Set<string> {
  const words = norm(s).split(' ').filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '))
  return out
}

/**
 * Solapamiento de 8-gramas entre el texto generado y el material de origen.
 * Devuelve los n-gramas literalmente compartidos: si hay alguno, la ficha se
 * rechaza (§6.1). Es la barrera anti-copia, verificada por código y no por
 * confianza.
 */
export function sharedNgrams(generated: string, source: string, n = 8): string[] {
  const a = wordNgrams(generated, n)
  if (a.size === 0) return []
  const b = wordNgrams(source, n)
  const shared: string[] = []
  for (const g of a) if (b.has(g)) shared.push(g)
  return shared
}

/** ¿Es `fragment` subcadena literal de `material`, tras normalizar? (§6.4). */
export function isLiteralSubstring(fragment: string, material: string): boolean {
  const f = norm(fragment)
  if (f.length === 0) return false
  return norm(material).includes(f)
}

/** Cuenta palabras de verdad, para las longitudes del prompt (90-130). */
export function wordCount(s: string): number {
  return norm(s).split(' ').filter(Boolean).length
}

/** Recorta a `max` caracteres sin partir una palabra por la mitad. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

/** Quita etiquetas y colapsa el espacio en blanco de un fragmento de HTML. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
