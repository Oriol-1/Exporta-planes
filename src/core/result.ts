// src/core/result.ts
// Result<T> en vez de excepciones que cruzan capas. El rastreo procesa cientos
// de páginas y una de ellas con el HTML roto no puede tumbar la ejecución
// entera (§4.4): el fallo es un valor que se acumula en el informe, no un throw.

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback
}

export function mapResult<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r
}

/** Separa una lista de resultados en aciertos y fallos, sin perder ninguno. */
export function partition<T, E>(rs: readonly Result<T, E>[]): {
  values: T[]
  errors: E[]
} {
  const values: T[] = []
  const errors: E[] = []
  for (const r of rs) {
    if (r.ok) values.push(r.value)
    else errors.push(r.error)
  }
  return { values, errors }
}

/** Envuelve una promesa que puede lanzar. El error se normaliza a texto. */
export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
}
