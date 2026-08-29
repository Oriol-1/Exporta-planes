// src/publish/checksums.ts
// La `sha256` que publica el índice es la del archivo TAL CUAL SE SIRVE (§8.2).
// planonmap la comprueba al descargar; si no cuadra, descarta el archivo y
// conserva el que ya tenía. Por eso el orden importa: primero se serializa, y el
// hash se calcula sobre esa cadena exacta — nunca sobre el objeto.
import { sha256 } from '../core/hash'

export interface SerializedFile {
  readonly text: string
  readonly sha256: string
  readonly bytes: number
}

/**
 * Serializa un archivo de salida. Sin indentación: es un dato de máquina que
 * viaja por la red una o dos veces al día, y cada byte es ancho de banda del
 * plan gratuito de Pages.
 */
export function serialize(value: unknown): SerializedFile {
  const text = JSON.stringify(value)
  return { text, sha256: sha256(text), bytes: Buffer.byteLength(text, 'utf8') }
}

export function verifyChecksum(text: string, expected: string): boolean {
  return sha256(text) === expected
}
