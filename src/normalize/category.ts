// src/normalize/category.ts
// Clasificación palabra clave → categoría, EN UN SOLO SITIO (§1.8).
//
// La lección viene de planonmap: hubo un periodo en que dos fuentes tenían su
// propia copia de estas reglas y no recibían las mejoras. Se unificó, y esa es
// la regla: una sola copia de cada regla. Este archivo es esa copia.
import type { Category } from '../../contracts/event'
import type { CuratedCollection } from '../../contracts/curated'
import { norm } from '../core/text'

/** Confianza de una regla: `strong` gana siempre a `weak`. */
type Confidence = 'strong' | 'weak'

interface Rule {
  readonly pattern: RegExp
  readonly category: Category
  readonly confidence: Confidence
}

/**
 * Reglas ORDENADAS POR ESPECIFICIDAD: la primera que casa gana. El orden no es
 * casual — «exposición en el museo» tiene que salir `exhibitions`, no `museums`.
 */
const RULES: readonly Rule[] = [
  { pattern: /\b(exposicio|exposicion|exhibition|mostra|retrospectiva)\b/, category: 'exhibitions', confidence: 'strong' },
  { pattern: /\b(museu|museo|museum|coleccio|coleccion|collection permanent)\b/, category: 'museums', confidence: 'strong' },
  { pattern: /\b(concert|concierto|gig|recital|festival de musica|live music|dj set)\b/, category: 'music', confidence: 'strong' },
  { pattern: /\b(teatre|teatro|theatre|dansa|danza|dance|opera|musical|circ|circo|monoleg|monologo)\b/, category: 'arts', confidence: 'strong' },
  { pattern: /\b(taller infantil|familiar|familias|families|nens|ninos|kids|children)\b/, category: 'family', confidence: 'strong' },
  { pattern: /\b(mercat|mercado|market|restaurant|tast|degustacio|degustacion|gastronomi|tapas|vermut|showcooking)\b/, category: 'food', confidence: 'strong' },
  { pattern: /\b(ruta|itinerari|itinerario|parc|parque|platja|playa|mirador|excursio|excursion|senderisme|senderismo|jardi|jardin)\b/, category: 'outdoors', confidence: 'strong' },
  { pattern: /\b(partit|partido|match|marato|maraton|cursa|carrera|torneig|torneo|esport|deporte|sport)\b/, category: 'sports', confidence: 'strong' },
  { pattern: /\b(art|arte|galeria|galleria|escultura|pintura|fotografia)\b/, category: 'arts', confidence: 'weak' },
  { pattern: /\b(musica|music|jazz|flamenco|rock|electronica)\b/, category: 'music', confidence: 'weak' },
  { pattern: /\b(cultura|patrimoni|patrimonio|historia|heritage|conferencia|xerrada|charla)\b/, category: 'culture', confidence: 'weak' },
]

export interface Classification {
  readonly category: Category
  readonly confidence: Confidence | 'default'
  readonly secondary: readonly Category[]
}

/**
 * Clasifica a partir del título, la descripción y las etiquetas.
 *
 * Sin coincidencia, el resultado NO es `other`: `other` es la papelera de
 * planonmap y no queremos alimentarla (§4.7). Para planes cae en `culture`; para
 * espectáculos, en `arts`.
 */
export function classify(
  text: string,
  collection: CuratedCollection,
): Classification {
  // La colección C no se clasifica: un museo es `museums`, siempre (§1.6).
  if (collection === 'museums') {
    return { category: 'museums', confidence: 'strong', secondary: [] }
  }

  const t = norm(text)
  const matched: Rule[] = RULES.filter((r) => r.pattern.test(t))

  const strong = matched.find((r) => r.confidence === 'strong')
  const weak = matched.find((r) => r.confidence === 'weak')
  const winner = strong ?? weak

  const secondary = [...new Set(matched.map((r) => r.category))].filter(
    (c) => c !== winner?.category,
  )

  if (!winner) {
    return {
      category: collection === 'shows' ? 'arts' : 'culture',
      confidence: 'default',
      secondary: [],
    }
  }

  return { category: winner.category, confidence: winner.confidence, secondary }
}

/**
 * Los cinco grupos públicos: los botones que ve el visitante en la portada de
 * planonmap. Se resuelven en la consulta; ningún evento cambia de categoría
 * (§1.6). Está aquí solo para poder comprobar la cobertura en los informes.
 */
export const PUBLIC_GROUPS: Readonly<Record<string, readonly Category[]>> = {
  music: ['music'],
  family: ['family'],
  food: ['food'],
  cultura: ['museums', 'exhibitions', 'arts', 'culture'],
  'deporte-naturaleza': ['sports', 'outdoors'],
}

export function publicGroupOf(category: Category): string {
  for (const [group, cats] of Object.entries(PUBLIC_GROUPS)) {
    if (cats.includes(category)) return group
  }
  return 'other'
}

/** Etiquetas a partir del texto: barrio, temática y poco más. Sin inventar. */
export function deriveTags(
  title: string,
  category: Category,
  neighborhood: string | undefined,
): string[] {
  const tags = new Set<string>([category])
  if (neighborhood) {
    const slug = norm(neighborhood).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (slug.length >= 3) tags.add(slug)
  }
  const t = norm(title)
  for (const [needle, tag] of [
    ['gaudi', 'gaudi'],
    ['modernis', 'modernismo'],
    ['picasso', 'picasso'],
    ['miro', 'miro'],
    ['gotic', 'gotico'],
    ['romanic', 'romanico'],
  ] as const) {
    if (t.includes(needle)) tags.add(tag)
  }
  return [...tags]
}
