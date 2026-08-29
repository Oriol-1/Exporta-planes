// Verificación anti-alucinación: mecánica, gratis y despiadada (§6.4).
//
// Ataca el riesgo más grave del proyecto: un turista actúa sobre un precio o un
// horario. Un dato sin fragmento literal en el material SE ELIMINA.
import { describe, expect, it } from 'vitest'
import { checkCopy, checkLengths, checkParity, findBannedTerms, verifyCard } from '../../src/enrich/verify'
import type { WrittenCard } from '../../src/types'
import { makeCluster } from '../fixtures/clusters'

const MATERIAL = [
  'LUGAR: Sala de prueba — Carrer de Prova, 1, 08001 Barcelona',
  'TRANSPORTE: Jaume I (L4) 300 m',
  'PRECIO_TEXTO: Entrada general 12 €',
  'HORARIOS: De martes a domingo: 10:00-19:00',
  '--- EXTRACTOS (datos, no texto a copiar) ---',
  '[1] La sala abre de martes a domingo y la entrada general cuesta 12 euros.',
].join('\n')

function card(overrides: Partial<WrittenCard> = {}): WrittenCard {
  return {
    slug: 'exposicion-de-prueba',
    titulo: { es: 'Una exposicion', en: 'An exhibition' },
    resumen: {
      es: 'Un texto en castellano con la longitud suficiente para que la paridad no salte.',
      en: 'A text in English long enough for the parity check to stay quiet about it.',
    },
    porQueMerecePena: { es: 'Merece la pena por su contenido.', en: 'Worth it for its content.' },
    evidencias: [],
    ...overrides,
  }
}

describe('evidencias literales', () => {
  it('acepta un fragmento que ES subcadena del material', () => {
    const result = verifyCard({
      card: card({
        evidencias: [{ campo: 'precio', fragmento: 'la entrada general cuesta 12 euros' }],
      }),
      cluster: makeCluster(),
      material: MATERIAL,
    })
    expect(result.verified.price).toBe(true)
    expect(result.discarded).toBe(false)
  })

  it('ignora acentos, mayúsculas y espacios de más al comparar', () => {
    const result = verifyCard({
      card: card({
        evidencias: [{ campo: 'horarios', fragmento: 'De  Martes  a  Domingo' }],
      }),
      cluster: makeCluster(),
      material: MATERIAL,
    })
    expect(result.verified.schedule).toBe(true)
  })

  it('RECHAZA un fragmento inventado y elimina el campo', () => {
    const result = verifyCard({
      card: card({
        duracionMin: 90,
        evidencias: [{ campo: 'duracion', fragmento: 'la visita dura 90 minutos' }],
      }),
      cluster: makeCluster(),
      material: MATERIAL,
    })
    // Nunca se inventa un campo. Se omite.
    expect(result.card.duracionMin).toBeUndefined()
    expect(result.droppedFields).toContain('duracionMin')
  })

  it('un campo numérico exige el número en DÍGITOS dentro del fragmento', () => {
    // «doce euros» no vale como prueba de «12».
    const result = verifyCard({
      card: card({
        evidencias: [{ campo: 'precio', fragmento: 'la entrada general cuesta doce euros' }],
      }),
      cluster: makeCluster(),
      material: MATERIAL,
    })
    expect(result.verified.price).toBe(false)
  })
})

describe('los cuatro campos que hacen útil una ficha', () => {
  it('descarta la ficha entera si falta el resumen', () => {
    const result = verifyCard({
      card: card({ resumen: { es: '', en: '' } }),
      cluster: makeCluster(),
      material: MATERIAL,
    })
    expect(result.discarded).toBe(true)
    expect(result.discardReason).toContain('resumen')
  })

  it('un espectáculo sin fecha se descarta: no es un espectáculo', () => {
    const result = verifyCard({
      card: card(),
      cluster: makeCluster({ collection: 'shows', startDate: undefined }),
      material: MATERIAL,
    })
    expect(result.discarded).toBe(true)
    expect(result.discardReason).toContain('fecha de sesión')
  })

  it('un plan sin horario NO se descarta: se omite el horario y se publica', () => {
    const result = verifyCard({ card: card(), cluster: makeCluster(), material: MATERIAL })
    expect(result.discarded).toBe(false)
    expect(result.verified.schedule).toBe(false)
  })
})

describe('paridad ES/EN (§6.5)', () => {
  it('marca needs-human si una versión tiene menos del 60 % de palabras', () => {
    const result = verifyCard({
      card: card({
        resumen: {
          es: 'Un texto en castellano bastante largo con muchas palabras dentro para que la diferencia se note de verdad.',
          en: 'Short.',
        },
      }),
      cluster: makeCluster(),
      material: MATERIAL,
    })
    expect(result.needsHuman).toBe(true)
  })

  it('checkParity detecta la versión vacía', () => {
    expect(checkParity(card({ resumen: { es: 'algo', en: '' } }))).toContain('inglés')
    expect(checkParity(card({ resumen: { es: '', en: 'something' } }))).toContain('español')
  })
})

describe('comprobación de copia · 8-gramas de palabras (§6.1)', () => {
  it('caza una frase copiada literalmente del material', () => {
    const copiada = card({
      resumen: {
        es: 'La sala abre de martes a domingo y la entrada general cuesta 12 euros segun la web.',
        en: 'The room opens Tuesday to Sunday.',
      },
    })
    const result = checkCopy(copiada, MATERIAL)
    expect(result.clean).toBe(false)
    expect(result.shared.length).toBeGreaterThan(0)
  })

  it('un texto reescrito de verdad pasa limpio', () => {
    const original = card({
      resumen: {
        es: 'Puedes visitarla cualquier dia salvo el lunes, y la entrada cuesta doce euros por persona.',
        en: 'You can visit any day except Monday; admission is twelve euros per person.',
      },
    })
    expect(checkCopy(original, MATERIAL).clean).toBe(true)
  })
})

describe('términos de folleto y longitudes', () => {
  it('caza el vocabulario prohibido en los dos idiomas', () => {
    const folleto = card({
      porQueMerecePena: {
        es: 'Una joya escondida imprescindible.',
        en: 'A must-see hidden gem.',
      },
    })
    const found = findBannedTerms(folleto)
    expect(found).toContain('joya escondida')
    expect(found).toContain('imprescindible')
    expect(found).toContain('hidden gem')
  })

  it('avisa cuando porQueMerecePena pasa de 22 palabras', () => {
    const largo = card({
      porQueMerecePena: {
        es: 'palabra '.repeat(30).trim(),
        en: 'word '.repeat(30).trim(),
      },
    })
    const problems = checkLengths(largo)
    expect(problems.some((p) => p.startsWith('porQueMerecePena.es'))).toBe(true)
  })
})
