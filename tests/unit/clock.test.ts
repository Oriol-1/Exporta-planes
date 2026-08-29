// El «ahora» se inyecta SIEMPRE (§3.6). Estos tests usan fechas fijas, que es
// precisamente lo que el reloj inyectable hace seguro: no caducan solos.
import { describe, expect, it } from 'vitest'
import {
  addDays,
  fixedClock,
  madridDayString,
  madridMidnightIso,
  madridMonthString,
  madridOffset,
  toMadridIso,
} from '../../src/core/clock'

describe('reloj', () => {
  it('emite +02:00 en horario de verano y +01:00 en invierno', () => {
    // El offset de Europe/Madrid NO es constante, y el esquema Event exige el
    // correcto: "2026-09-10T19:30:00" falla, "…+02:00" pasa (§A.1).
    expect(madridOffset(new Date('2026-07-15T12:00:00Z'))).toBe('+02:00')
    expect(madridOffset(new Date('2026-01-15T12:00:00Z'))).toBe('+01:00')
  })

  it('convierte a ISO con offset, no a UTC', () => {
    const iso = toMadridIso(new Date('2026-09-10T17:30:00Z'))
    expect(iso).toBe('2026-09-10T19:30:00.000+02:00')
    expect(iso).not.toContain('Z')
  })

  it('da la medianoche de Madrid del día en curso', () => {
    // 23:30 UTC del 30 de agosto ya es el 31 en Madrid.
    expect(madridMidnightIso(new Date('2026-08-30T23:30:00Z'))).toBe(
      '2026-08-31T00:00:00.000+02:00',
    )
  })

  it('da el día y el mes en la zona correcta', () => {
    expect(madridDayString(new Date('2026-08-30T23:30:00Z'))).toBe('2026-08-31')
    expect(madridMonthString(new Date('2026-08-30T23:30:00Z'))).toBe('2026-08')
  })

  it('el reloj fijo devuelve siempre el mismo instante', () => {
    const clock = fixedClock('2026-09-03T02:30:00Z')
    expect(clock.now().getTime()).toBe(clock.now().getTime())
    expect(clock.nowIso()).toBe('2026-09-03T04:30:00.000+02:00')
  })

  it('addDays no se rompe en el cambio de mes', () => {
    expect(madridDayString(addDays(new Date('2026-08-31T10:00:00Z'), 1))).toBe('2026-09-01')
  })
})
