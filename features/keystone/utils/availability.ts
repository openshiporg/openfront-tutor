import { businessDateKey, businessDayRange, businessMinute, businessWallTime } from '../../shared/business-time'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export type Hours = { dayOfWeek: string; isWorking?: boolean | null; startMinute?: number | null; endMinute?: number | null; breakStartMinute?: number | null; breakEndMinute?: number | null }
export type Busy = { startsAt: Date; endsAt: Date }

export function dayOfWeekFor(date: string) {
  return DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
}

export function dayIndexFor(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Two time ranges overlap, each widened by `buffer` minutes after it ends. */
export function overlaps(a: Busy, b: Busy, bufferMinutes = 0) {
  const pad = bufferMinutes * 60_000
  return a.startsAt.getTime() < b.endsAt.getTime() + pad && b.startsAt.getTime() < a.endsAt.getTime() + pad
}

/**
 * Start times (ISO) on one calendar day in the tutor's timezone for a session of
 * `duration` minutes. Honors weekly hours and the break, time off, booked
 * sessions plus the buffer, notice and the booking window. (Barber `openSlots`.)
 */
export function openSlots(input: {
  date: string
  timeZone: string
  hours: Hours | undefined
  duration: number
  slotMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxAdvanceDays: number
  busy: Busy[]
  now?: Date
}) {
  const { hours, date, timeZone, duration } = input
  const now = input.now ?? new Date()
  if (!hours?.isWorking) return []
  const start = hours.startMinute ?? 900
  const end = hours.endMinute ?? 1200
  const step = Math.max(5, input.slotMinutes)
  const earliest = now.getTime() + input.minNoticeHours * 3_600_000
  const latest = now.getTime() + input.maxAdvanceDays * 86_400_000
  const out: string[] = []
  for (let minute = start; minute + duration <= end; minute += step) {
    const inBreak = typeof hours.breakStartMinute === 'number' && typeof hours.breakEndMinute === 'number'
      && minute < hours.breakEndMinute && hours.breakStartMinute < minute + duration
    if (inBreak) continue
    let begins: Date
    try { begins = businessWallTime(date, minute, timeZone) } catch { continue }
    // A wall time that a clock change skips or repeats is offered once, at its real instant.
    if (businessMinute(begins, timeZone) !== minute || businessDateKey(begins, timeZone) !== date) continue
    if (begins.getTime() < earliest || begins.getTime() > latest) continue
    const slot = { startsAt: begins, endsAt: new Date(begins.getTime() + duration * 60_000) }
    if (!input.busy.some((b) => overlaps(slot, b, input.bufferMinutes))) out.push(begins.toISOString())
  }
  return out
}

/** The tutor-timezone days whose slots can fall on `date` in another timezone. */
export function tutorDaysCovering(date: string, viewerTimeZone: string, tutorTimeZone: string) {
  const { start, end } = businessDayRange(date, viewerTimeZone)
  const first = businessDateKey(start, tutorTimeZone)
  const last = businessDateKey(new Date(end.getTime() - 1), tutorTimeZone)
  const days = [first]
  while (days[days.length - 1] < last) days.push(addDays(days[days.length - 1], 1))
  return { days, start, end }
}

export { businessDateKey, businessDayRange, businessMinute, businessWallTime }
