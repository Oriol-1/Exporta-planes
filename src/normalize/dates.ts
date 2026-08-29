// src/normalize/dates.ts
// Fechas en zona Europe/Madrid, emitidas SIEMPRE con offset (§4.7). El esquema
// Event lo exige: "2026-09-10T19:30:00" falla; "2026-09-10T19:30:00+02:00" pasa.
import type { TimeConfidence } from '../types'
import { madridOffset, addDays, addYears, toMadridIso } from '../core/clock'
import { norm } from '../core/text'

export interface ParsedDate {
  readonly iso: string
  readonly confidence: TimeConfidence
}

const MONTHS: Record<string, number> = {
  gener: 1, enero: 1, january: 1, gen: 1, ene: 1, jan: 1,
  febrer: 2, febrero: 2, february: 2, feb: 2,
  marc: 3, marzo: 3, march: 3, mar: 3,
  abril: 4, april: 4, abr: 4, apr: 4,
  maig: 5, mayo: 5, may: 5, mai: 5,
  juny: 6, junio: 6, june: 6, jun: 6,
  juliol: 7, julio: 7, july: 7, jul: 7,
  agost: 8, agosto: 8, august: 8, ago: 8, aug: 8,
  setembre: 9, septiembre: 9, september: 9, set: 9, sep: 9,
  octubre: 10, october: 10, oct: 10,
  novembre: 11, noviembre: 11, november: 11, nov: 11,
  desembre: 12, diciembre: 12, december: 12, des: 12, dic: 12, dec: 12,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Construye el ISO con offset de Madrid para una fecha y hora locales. */
export function madridIso(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  const approx = new Date(Date.UTC(year, month - 1, day, Math.max(hour - 2, 0), minute))
  const offset = madridOffset(approx)
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000${offset}`
}

/**
 * Parsea una fecha de una fuente. Devuelve `confidence: 'day'` cuando solo hay
 * día sin hora: planonmap ya sabe convivir con eso —su propio feed usa una hora
 * centinela—, pero conviene que quede registrado y no fingir precisión.
 */
export function parseDate(raw: string | undefined | null): ParsedDate | null {
  if (!raw) return null
  const text = raw.trim()
  if (text.length === 0) return null

  // ISO con offset explícito: se respeta tal cual, es lo mejor que hay.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([.]\d+)?([+-]\d{2}:\d{2}|Z)$/.test(text)) {
    const at = new Date(text)
    if (!Number.isNaN(at.getTime())) {
      return { iso: toMadridIso(at), confidence: 'exact' }
    }
  }

  // ISO sin offset: la fuente quiso decir hora local de Barcelona.
  const naive = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(text)
  if (naive) {
    const [, y, m, d, h, min] = naive
    const hasTime = h !== undefined
    return {
      iso: madridIso(Number(y), Number(m), Number(d), Number(h ?? 0), Number(min ?? 0)),
      confidence: hasTime ? 'exact' : 'day',
    }
  }

  // dd/mm/yyyy o dd-mm-yyyy, con hora opcional.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\D{1,3}(\d{1,2})[:.](\d{2}))?/.exec(text)
  if (dmy) {
    const [, d, m, y, h, min] = dmy
    return {
      iso: madridIso(Number(y), Number(m), Number(d), Number(h ?? 0), Number(min ?? 0)),
      confidence: h !== undefined ? 'exact' : 'day',
    }
  }

  // «10 de setembre de 2026, 19.30 h» y variantes catalanas y castellanas.
  const t = norm(text)
  const verbose = /(\d{1,2})\s*(?:de\s+|d[’']\s*)?([a-z]+)\s*(?:de\s+|del\s+)?(\d{4})/.exec(t)
  if (verbose) {
    const [, d, monthName, y] = verbose
    const month = MONTHS[monthName ?? '']
    if (month) {
      const time = /(\d{1,2})[:.h](\d{2})/.exec(t)
      return {
        iso: madridIso(
          Number(y),
          month,
          Number(d),
          time ? Number(time[1]) : 0,
          time ? Number(time[2]) : 0,
        ),
        confidence: time ? 'exact' : 'day',
      }
    }
  }

  return null
}

/** ¿Cae `iso` en la ventana de planonmap: de ayer a +60 días? (§5.2, paso 4). */
export function inWindow(iso: string, now: Date, daysAhead = 60): boolean {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return false
  return at >= addDays(now, -1) && at <= addDays(now, daysAhead)
}

/** Días desde `now` hasta el inicio. Negativo si ya empezó. */
export function daysUntil(iso: string, now: Date): number {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return Number.POSITIVE_INFINITY
  return Math.ceil((at.getTime() - now.getTime()) / 86_400_000)
}

/** ¿Sigue vigente? Un rango cuenta hasta su `endDate`. */
export function isActive(startIso: string, endIso: string | undefined, now: Date): boolean {
  const end = endIso ? new Date(endIso) : new Date(startIso)
  if (Number.isNaN(end.getTime())) return false
  return end >= addDays(now, -1)
}

/**
 * Convenio de museos (§8.5): `startDate` = medianoche de hoy, `endDate` = un año
 * después. Ambas ruedan en cada refresco semanal, pero el `id` y el `slug` NO
 * cambian nunca — así los favoritos, los enlaces compartidos y el
 * posicionamiento en buscadores sobreviven al refresco.
 */
export function museumWindow(now: Date): { startDate: string; endDate: string } {
  const day = toMadridIso(now).slice(0, 10)
  const [y, m, d] = day.split('-').map(Number)
  const start = madridIso(y ?? 2026, m ?? 1, d ?? 1)
  const endDate = addYears(new Date(start), 1)
  return { startDate: start, endDate: toMadridIso(endDate) }
}

/** Resumen legible del rango, para el material del redactor. */
export function summarizeDates(
  startIso: string | undefined,
  endIso: string | undefined,
  temporality: 'atemporal' | 'temporada',
): string {
  if (temporality === 'atemporal') return 'permanente'
  if (!startIso) return 'sin fecha'
  const start = startIso.slice(0, 10)
  if (!endIso) return start
  const end = endIso.slice(0, 10)
  return start === end ? start : `del ${start} al ${end}`
}
