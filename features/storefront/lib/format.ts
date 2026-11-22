/** Formatting shared by server and client storefront code. No server-only imports. */

export function money(cents: number | null | undefined, currency = 'USD') {
  const value = (cents ?? 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function priceLabel(cents: number, currency: string) {
  return cents > 0 ? money(cents, currency) : 'Free'
}

export function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} ${h === 1 ? 'hour' : 'hours'}`
}

export function hoursOf(minutes: number) {
  const h = minutes / 60
  return Number.isInteger(h) ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${h.toFixed(1)} hours`
}

export function minuteOfDay(minute: number) {
  const h = Math.floor(minute / 60) % 24
  const m = minute % 60
  const suffix = h < 12 ? 'AM' : 'PM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m ? `${hh}:${String(m).padStart(2, '0')} ${suffix}` : `${hh} ${suffix}`
}

export function safeZone(tz: string | null | undefined, fallback = 'UTC') {
  if (!tz) return fallback
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz } catch { return fallback }
}

export function fmtDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function fmtDateLong(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

export function fmtDate(iso: string, tz?: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

export function fmtTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function zoneName(tz: string, at = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(at).find((p) => p.type === 'timeZoneName')
    return part?.value ?? tz
  } catch { return tz }
}

export function dateKey(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeZone(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function addDaysKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function dayLabel(key: string) {
  const d = new Date(`${key}T12:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(d),
    day: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric' }).format(d),
    month: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(d),
    long: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(d),
  }
}

const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
export const sortDays = <T extends { dayOfWeek: string }>(rows: T[]) => [...rows].sort((a, b) => WEEK.indexOf(a.dayOfWeek) - WEEK.indexOf(b.dayOfWeek))
export const dayName = (d: string) => d.charAt(0).toUpperCase() + d.slice(1)

export function modeLabel(mode: string) {
  return mode === 'in_person' ? 'In person' : mode === 'either' ? 'Online or in person' : 'Online'
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Waiting for payment',
  scheduled: 'Booked',
  completed: 'Done',
  cancelled: 'Cancelled',
  late_cancelled: 'Cancelled late',
  no_show: 'Missed',
  excused: 'Excused',
  released: 'Released (not paid in time)',
}

export const FUNDING_LABEL: Record<string, string> = {
  package: 'From your package',
  card: 'Paid by card',
  invoice: 'On your next invoice',
  flat: 'Covered by your monthly fee',
  free: 'Free',
}

export const PAYMENT_LABEL: Record<string, string> = {
  not_due: 'Nothing to pay now',
  unpaid: 'Not paid yet',
  paid: 'Paid',
  refunded: 'Refunded',
  part_refunded: 'Partly refunded',
}

export const METHOD_LABEL: Record<string, string> = {
  stripe: 'Card',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money',
  other: 'Other',
}

export const LEDGER_LABEL: Record<string, string> = {
  grant: 'Added',
  hold: 'Held for a session',
  release: 'Returned',
  debit: 'Used',
  reversal: 'Given back',
  expire: 'Expired',
  refund: 'Refunded',
  adjustment: 'Adjusted by your tutor',
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

/** The name in the wordmark: the tutor's own name, else the business name. */
export function displayName(t: { tutorName: string | null; businessName: string }) {
  return t.tutorName?.trim() || t.businessName
}

export function firstName(t: { tutorName: string | null; businessName: string }) {
  return (t.tutorName?.trim() || t.businessName).split(/\s+/)[0]
}

/** "Maths & Physics tutor · Austin" style subtitle under the wordmark. */
export function tagline(t: { subjects: Array<{ name: string }>; city: string | null; teachesOnline: boolean; teachesInPerson: boolean }) {
  const subj = t.subjects.slice(0, 2).map((s) => s.name).join(' & ')
  const where = t.city || (t.teachesOnline && !t.teachesInPerson ? 'Online' : '')
  return [subj ? `${subj} tutor` : 'Private tutor', where].filter(Boolean).join(' · ')
}
