// contracts/output.ts
import { z } from 'zod'
import { CuratedEventSchema, CuratedCollectionSchema } from './curated'

export const CollectionFileSchema = z.object({
  schemaVersion: z.literal(1),
  collection: CuratedCollectionSchema,
  generatedAt: z.string().datetime({ offset: true }),
  count: z.number().int().min(0),
  license: z.string().min(1),                 // 'CC-BY-4.0'
  items: z.array(CuratedEventSchema),
})
export type CollectionFile = z.infer<typeof CollectionFileSchema>

export const IndexFileSchema = z.object({
  schemaVersion: z.literal(1),
  producer: z.literal('bcn-curator'),
  producerVersion: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  /**
   * Entre UNA y tres colecciones. No exactamente tres, a propósito: durante las
   * fases 0 a 3 solo existe `museums`, y exigir las tres haría imposible validar
   * —y por tanto publicar— hasta tener el proyecto entero terminado.
   * Una colección ausente significa «todavía no se publica», no «está vacía».
   */
  collections: z
    .array(
      z.object({
        name: CuratedCollectionSchema,
        url: z.string().url(),
        count: z.number().int().min(0),
        generatedAt: z.string().datetime({ offset: true }),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1)
    .max(3)
    .refine((cs) => new Set(cs.map((c) => c.name)).size === cs.length, {
      message: 'colecciones duplicadas en el índice',
    }),
})
export type IndexFile = z.infer<typeof IndexFileSchema>

/** Coherencia interna: count debe cuadrar con items.length. */
export function assertCoherent(file: CollectionFile): void {
  if (file.count !== file.items.length) {
    throw new Error(`count=${file.count} pero items=${file.items.length}`)
  }
}
