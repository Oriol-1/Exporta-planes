// config/quotas.ts
// Variedad forzada (§5.6). La puntuación sola produce listas monótonas: seis
// museos de arte, todos en Ciutat Vella, todos de 15 €.
import type { Quotas } from './schema'

export const QUOTAS: Quotas = {
  maxPorCategoria: 2, // por ejecución
  maxPorBarrio: 2,
  maxPorRecinto: 1,
  minGratuitos: 1, // al menos 1 de cada 4 seleccionados es gratis o barato
  minAtemporales: 1, // imprescindible que existe todo el año
  minTemporada: 1, // novedad que caduca
  umbralGratuitoEur: 10,
}
