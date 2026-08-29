// src/core/clock.ts
// El «ahora» SIEMPRE se inyecta (§3.6). Este es el ÚNICO archivo del proyecto
// autorizado a llamar a Date.now() o a new Date(); una regla de ESLint lo
// prohíbe en todos los demás.
//
// El motivo no es purismo: planonmap ha tenido la CI rota tres veces por
// fixtures con fecha fija que caducaron solos. Con el reloj inyectado, un test
// de «este plan empieza en 14 días» sigue significando lo mismo dentro de un año.

export interface Clock {
  /** Instante actual. */
  now(): Date
  /** El mismo instante en ISO 8601 con offset de Europe/Madrid. */
  nowIso(): string
}

/** Zona horaria del proyecto entero. Barcelona, siempre. */
export const TZ = 'Europe/Madrid'

/**
 * Offset de Europe/Madrid en un instante dado: '+02:00' en horario de verano,
 * '+01:00' en invierno. Se calcula con Intl para no depender de una tabla que
 * caduca cuando la UE decida dejar de cambiar la hora.
 */
export function madridOffset(at: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'longOffset',
  })
  const part = fmt.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const m = /GMT([+-]\d{2}:\d{2})/.exec(part)
  return m?.[1] ?? '+00:00'
}

/** ISO 8601 CON offset de Madrid, que es lo que exige el esquema Event (§A.1). */
export function toMadridIso(at: Date): string {
  const offset = madridOffset(at)
  const sign = offset.startsWith('-') ? -1 : 1
  const [oh = '0', om = '0'] = offset.slice(1).split(':')
  const shiftMs = sign * (Number(oh) * 60 + Number(om)) * 60_000
  const local = new Date(at.getTime() + shiftMs)
  return `${local.toISOString().slice(0, 23)}${offset}`
}

/** Medianoche de Madrid del día de `at`, en ISO con offset. Convenio de museos (§8.5). */
export function madridMidnightIso(at: Date): string {
  const day = madridDayString(at)
  // El offset se toma del mediodía para no caer en la hora ambigua del cambio.
  const offset = madridOffset(new Date(`${day}T12:00:00Z`))
  return `${day}T00:00:00.000${offset}`
}

/** 'YYYY-MM-DD' del día en curso en Madrid. */
export function madridDayString(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/** 'YYYY-MM' del mes en curso en Madrid. Clave del libro de gasto. */
export function madridMonthString(at: Date): string {
  return madridDayString(at).slice(0, 7)
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 86_400_000)
}

export function addYears(at: Date, years: number): Date {
  const d = new Date(at.getTime())
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/** El reloj real. Solo lo construyen los puntos de entrada (src/cli/*). */
export function systemClock(): Clock {
  return {
    now: () => new Date(),
    nowIso: () => toMadridIso(new Date()),
  }
}

/** El reloj de los tests: fijo, explícito y sin sorpresas. */
export function fixedClock(iso: string): Clock {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) throw new Error(`fixedClock: fecha inválida "${iso}"`)
  return {
    now: () => new Date(at.getTime()),
    nowIso: () => toMadridIso(at),
  }
}
