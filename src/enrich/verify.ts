// src/enrich/verify.ts
// Verificación anti-alucinación: mecánica, gratis y despiadada (§6.4).
//
// Corre DESPUÉS del modelo y NO usa IA. Tres invariantes por encima de todo:
//
//   1. Nunca se inventa un campo. Se OMITE.
//   2. Se descarta la ficha entera si falla uno de los cuatro campos que la
//      hacen útil: titulo, resumen, coordenadas, o —colección B— fecha y hora.
//   3. Nada se marca «gratis» sin evidencia explícita.
//
// El riesgo que ataca es el más grave del proyecto: un turista actúa sobre un
// precio o un horario.
import type { Cluster, VerificationResult, WrittenCard } from '../types'
import { isLiteralSubstring, norm, sharedNgrams, wordCount } from '../core/text'
import { BANNED_TERMS } from './write'

export const VERIFY_METHOD = 'evidence-substring'

/** Qué campo de `verified` cubre cada `campo` de las evidencias. */
const FIELD_GROUPS: Readonly<Record<string, 'price' | 'schedule' | 'dates' | 'location'>> = {
  precio: 'price',
  price: 'price',
  queincluye: 'price',
  priceincludes: 'price',
  gratuidades: 'price',
  horario: 'schedule',
  horarios: 'schedule',
  schedule: 'schedule',
  fecha: 'dates',
  fechas: 'dates',
  dates: 'dates',
  exposicionvigente: 'dates',
  duracion: 'schedule',
  duracionmin: 'schedule',
  minutosvisita: 'schedule',
  comollegar: 'location',
  transit: 'location',
  lugar: 'location',
  reserva: 'schedule',
}

function groupOf(campo: string): 'price' | 'schedule' | 'dates' | 'location' | null {
  return FIELD_GROUPS[norm(campo).replace(/[^a-z]/g, '')] ?? null
}

/** Los números que aparecen como dígitos en un texto. */
function digitsIn(text: string): Set<string> {
  return new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((d) => d.replace(',', '.')))
}

/** Campos numéricos: además de la evidencia literal, el número debe estar. */
const NUMERIC_FIELDS = new Set(['precio', 'price', 'duracion', 'duracionmin', 'minutosvisita', 'reservadiasantelacion'])

export interface VerifyInput {
  readonly card: WrittenCard
  readonly cluster: Cluster
  readonly material: string
}

/**
 * Verifica una ficha escrita contra su material. Devuelve la ficha con los
 * campos sin evidencia ELIMINADOS, no rellenados con nada.
 */
export function verifyCard(input: VerifyInput): VerificationResult {
  const { card, cluster, material } = input
  const dropped: string[] = []

  // ── 1 · Cada evidencia debe ser subcadena LITERAL del material.
  const validGroups = new Set<'price' | 'schedule' | 'dates' | 'location'>()
  const invalidFields = new Set<string>()

  for (const ev of card.evidencias) {
    const literal = isLiteralSubstring(ev.fragmento, material)
    let numericOk = true

    if (NUMERIC_FIELDS.has(norm(ev.campo).replace(/[^a-z]/g, ''))) {
      // Para campos numéricos se exige además que el número aparezca como
      // dígitos en el fragmento: «quince euros» no vale como prueba de «15».
      numericOk = digitsIn(ev.fragmento).size > 0
    }

    if (literal && numericOk) {
      const group = groupOf(ev.campo)
      if (group) validGroups.add(group)
    } else {
      invalidFields.add(norm(ev.campo))
    }
  }

  // ── 2 · Se eliminan los campos cuya evidencia no resistió.
  const cleaned: WrittenCard = { ...card }
  const mutable = cleaned as { -readonly [K in keyof WrittenCard]: WrittenCard[K] }

  const drop = (field: keyof WrittenCard, label: string): void => {
    if (mutable[field] !== undefined) {
      delete mutable[field]
      dropped.push(label)
    }
  }

  if (invalidFields.has('duracion') || invalidFields.has('duracionmin')) {
    drop('duracionMin', 'duracionMin')
  }
  if (invalidFields.has('reserva')) {
    drop('reserva', 'reserva')
    drop('reservaDiasAntelacion', 'reservaDiasAntelacion')
  }
  if (invalidFields.has('comollegar') || invalidFields.has('transit')) {
    drop('comoLlegar', 'comoLlegar')
  }
  if (invalidFields.has('queincluye') || invalidFields.has('precio')) {
    drop('queIncluye', 'queIncluye')
  }
  if (!validGroups.has('schedule') && mutable.museo?.horarios) {
    mutable.museo = { ...mutable.museo, horarios: undefined }
    dropped.push('museo.horarios')
  }
  if (!validGroups.has('price') && mutable.museo?.gratuidades) {
    mutable.museo = { ...mutable.museo, gratuidades: undefined }
    dropped.push('museo.gratuidades')
  }
  if (!validGroups.has('dates') && mutable.museo?.exposicionVigente) {
    mutable.museo = { ...mutable.museo, exposicionVigente: undefined }
    dropped.push('museo.exposicionVigente')
  }

  // ── 3 · Los cuatro campos que hacen útil la ficha. Sin ellos, no hay ficha.
  const missing: string[] = []
  if (!card.titulo?.es || card.titulo.es.trim().length === 0) missing.push('titulo')
  if (!card.resumen?.es || card.resumen.es.trim().length === 0) missing.push('resumen')
  if (!Number.isFinite(cluster.venue.lat) || !Number.isFinite(cluster.venue.lng)) {
    missing.push('coordenadas')
  }
  if (cluster.collection === 'shows' && !cluster.startDate) {
    // Un espectáculo sin fecha no es un espectáculo.
    missing.push('fecha de sesión')
  }

  if (missing.length > 0) {
    return {
      card: cleaned,
      verified: {
        price: false,
        schedule: false,
        dates: false,
        location: false,
        method: VERIFY_METHOD,
      },
      droppedFields: dropped,
      discarded: true,
      discardReason: `faltan campos esenciales: ${missing.join(', ')}`,
      needsHuman: false,
    }
  }

  // ── 4 · Paridad ES/EN: si una versión es mucho más corta, no se publica.
  const parity = checkParity(cleaned)

  return {
    card: cleaned,
    verified: {
      price: validGroups.has('price'),
      schedule: validGroups.has('schedule'),
      dates: validGroups.has('dates'),
      location: validGroups.has('location'),
      method: VERIFY_METHOD,
    },
    droppedFields: dropped,
    discarded: false,
    needsHuman: parity !== null,
    needsHumanReason: parity ?? undefined,
  }
}

/**
 * Comprobación automática de paridad ES/EN (§6.5): si una versión tiene menos
 * del 60 % de las palabras de la otra, o si una está vacía, la ficha se marca
 * `needs-human` y no se publica.
 */
export function checkParity(card: WrittenCard): string | null {
  const es = wordCount(card.resumen?.es ?? '')
  const en = wordCount(card.resumen?.en ?? '')
  if (es === 0) return 'el resumen en español está vacío'
  if (en === 0) return 'el resumen en inglés está vacío'
  const ratio = Math.min(es, en) / Math.max(es, en)
  if (ratio < 0.6) return `paridad ES/EN rota: ${es} palabras frente a ${en}`
  return null
}

export interface CopyCheck {
  readonly clean: boolean
  readonly shared: readonly string[]
}

/**
 * Comprobación mecánica de solapamiento: si algún 8-grama de palabras del texto
 * generado aparece literalmente en el material, la ficha se rechaza (§6.1).
 * Cero frases copiadas, verificado por código y no por confianza.
 */
export function checkCopy(card: WrittenCard, material: string): CopyCheck {
  const generated = [
    card.resumen?.es ?? '',
    card.resumen?.en ?? '',
    card.porQueMerecePena?.es ?? '',
    card.porQueMerecePena?.en ?? '',
  ].join(' ')
  const shared = sharedNgrams(generated, material, 8)
  return { clean: shared.length === 0, shared: shared.slice(0, 5) }
}

/** Términos de folleto encontrados en la ficha. Los caza `pnpm eval:write`. */
export function findBannedTerms(card: WrittenCard): string[] {
  const haystack = norm(
    [
      card.titulo?.es,
      card.titulo?.en,
      card.resumen?.es,
      card.resumen?.en,
      card.porQueMerecePena?.es,
      card.porQueMerecePena?.en,
    ]
      .filter(Boolean)
      .join(' '),
  )
  return BANNED_TERMS.filter((t) => haystack.includes(norm(t)))
}

/** ¿Todas las longitudes dentro de lo pedido? Regresión objetiva, no estilo. */
export function checkLengths(card: WrittenCard): string[] {
  const problems: string[] = []
  for (const lang of ['es', 'en'] as const) {
    const words = wordCount(card.resumen?.[lang] ?? '')
    if (words > 0 && (words < 90 || words > 130)) {
      problems.push(`resumen.${lang}: ${words} palabras (se pidieron 90-130)`)
    }
    const why = wordCount(card.porQueMerecePena?.[lang] ?? '')
    if (why > 22) problems.push(`porQueMerecePena.${lang}: ${why} palabras (máx. 22)`)
    const transit = wordCount(card.comoLlegar?.[lang] ?? '')
    if (transit > 25) problems.push(`comoLlegar.${lang}: ${transit} palabras (máx. 25)`)
  }
  return problems
}
