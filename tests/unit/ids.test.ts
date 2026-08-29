import { describe, expect, it } from 'vitest'
import { curatedId, isValidSlug, makeId, slugify } from '../../src/core/ids'

describe('makeId · copia literal de planonmap (§1.5)', () => {
  it('une con | , baja a minúsculas y sustituye lo que no sea a-z0-9|', () => {
    expect(makeId('opendatabcn', '99400785311')).toBe('opendatabcn|99400785311')
    expect(makeId('Curated', 'Museums', 'Museu Picassó')).toBe('curated|museums|museu-picass-')
  })

  it('recorta a 64 caracteres', () => {
    expect(makeId('x'.repeat(100)).length).toBe(64)
  })

  it('construye el id curado con el formato del contrato', () => {
    expect(curatedId('museums', 'museu-picasso')).toBe('curated|museums|museu-picasso')
    expect(curatedId('shows', 'el-rei-lear-lliure-2026')).toBe('curated|shows|el-rei-lear-lliure-2026')
  })
})

describe('slugify', () => {
  it('produce slugs que cumplen ^[a-z0-9-]{3,60}$', () => {
    for (const input of [
      'Sagrada Família amb accés a les torres',
      'MACBA · Museu d’Art Contemporani',
      '¡¡¡Concert!!! "Sina Bathaie"',
    ]) {
      const slug = slugify(input)
      expect(isValidSlug(slug), `${input} → ${slug}`).toBe(true)
    }
  })

  it('quita acentos y no deja guiones colgando', () => {
    expect(slugify('Fundació Joan Miró')).toBe('fundacio-joan-miro')
    expect(slugify('Museu Picasso   ')).toBe('museu-picasso')
  })

  it('rescata un título que se quedaría en menos de 3 caracteres', () => {
    expect(isValidSlug(slugify('¡!'))).toBe(true)
  })
})
