// src/enrich/material.ts
// El paquete que viaja al modelo. Tope duro: 2.500 tokens. NUNCA se envía una
// página entera (§6.2).
//
// Fíjate en que el material se presenta como DATOS, con etiquetas en mayúsculas,
// y no como prosa. Es deliberado: el prompt le pide al modelo que reescriba, y
// darle datos etiquetados en vez de párrafos ajenos hace que copiar sea más
// difícil que escribir.
import type { Cluster } from '../types'
import { clip } from '../core/text'
import { approximateTokens } from '../ai/budget'
import { TOKEN_ESTIMATES } from '../../config/budget'

const MAX_EXTRACTS = 3
const EXTRACT_CHARS = 700

export function buildMaterial(cluster: Cluster): string {
  const v = cluster.venue
  return [
    `TITULOS_ORIGEN: ${cluster.titles.slice(0, 3).join(' | ')}`,
    `LUGAR: ${v.name} — ${v.address}`,
    `BARRIO: ${v.neighborhood ?? '?'} · DISTRITO: ${v.district ?? '?'}`,
    `COORDENADAS: ${v.lat}, ${v.lng}`,
    `TRANSPORTE: ${cluster.transitHints.join('; ') || '—'}`,
    `FECHAS: ${cluster.dateSummary}`,
    `HORARIOS: ${cluster.scheduleLines.slice(0, 12).join(' / ') || '—'}`,
    `PRECIO_TEXTO: ${cluster.priceTexts.slice(0, 3).join(' | ') || '—'}`,
    `WEB_OFICIAL: ${cluster.officialUrl ?? '—'}`,
    `ENTRADAS: ${cluster.ticketsUrl ?? '—'}`,
    `FUENTES: ${cluster.sources.map((s) => s.id).join(', ')}`,
    '--- EXTRACTOS (datos, no texto a copiar) ---',
    ...cluster.extracts
      .slice(0, MAX_EXTRACTS)
      .map((e, i) => `[${i + 1}] ${clip(e.text, EXTRACT_CHARS)}`),
  ].join('\n')
}

/**
 * Recorta el material si se pasa del tope. Se quitan extractos por el final —el
 * primero es el de la fuente con más `trust`— antes que tocar los campos
 * estructurados, que son los que sostienen las evidencias.
 */
export function buildBoundedMaterial(cluster: Cluster): string {
  let extracts = cluster.extracts.slice(0, MAX_EXTRACTS)
  let material = buildMaterial({ ...cluster, extracts })

  while (
    approximateTokens(material) > TOKEN_ESTIMATES.writeMaterialMaxTokens &&
    extracts.length > 1
  ) {
    extracts = extracts.slice(0, extracts.length - 1)
    material = buildMaterial({ ...cluster, extracts })
  }

  if (approximateTokens(material) > TOKEN_ESTIMATES.writeMaterialMaxTokens) {
    material = clip(material, TOKEN_ESTIMATES.writeMaterialMaxTokens * 3)
  }
  return material
}

/** Tokens estimados del material, para el cálculo previo del coste. */
export function materialTokens(material: string): number {
  return approximateTokens(material)
}
