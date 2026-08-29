// src/core/ids.ts
// makeId y slug, calcados de planonmap (§1.5). El formato del id no es un
// detalle estético: es lo que permite que planonmap trate nuestras fichas
// exactamente igual que las suyas.

/**
 * Copia literal de `lib/utils/dates.ts::makeId` de planonmap. Partes unidas por
 * '|', todo a minúsculas, cualquier carácter que no sea a-z0-9| a '-', y
 * recortado a 64.
 */
export function makeId(...parts: string[]): string {
  return parts
    .join('|')
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, '-')
    .slice(0, 64)
}

import type { CuratedCollection } from '../../contracts/curated'

/** `curated|<colección>|<slug>`. El slug es estable de por vida (§1.5). */
export function curatedId(collection: CuratedCollection, slug: string): string {
  return makeId('curated', collection, slug)
}

/**
 * Slug legible y estable a partir de un título. Cumple ^[a-z0-9-]{3,60}$, que
 * es lo que exige CuratedSchema. Un slug nace una vez y NO se reutiliza jamás.
 */
export function slugify(input: string, maxLen = 60): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '')
  if (base.length >= 3) return base
  // Un título que se queda en menos de 3 caracteres útiles no da un slug válido.
  return (base + '-ficha').slice(0, maxLen)
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,60}$/.test(slug)
}

/** Slug de un espectáculo: incluye el año porque un montaje puede volver (§3.7). */
export function showSlug(title: string, year: number): string {
  return slugify(`${title}-${year}`)
}
