import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type Read<T> = { ok: true; data: T } | { ok: false; error: string; needsSetup?: boolean }

/** Reads one tutor query that answers CommandResult. */
export async function read<T = any>(query: string, field: string, variables: Record<string, unknown> = {}): Promise<Read<T>> {
  const r = await keystoneClient<Record<string, { success: boolean; error: string | null; data: T }>>(query, variables, { cache: 'no-store' })
  if (!r.success) return { ok: false, error: 'Connection problem. Try again.' }
  const res = r.data[field]
  if (!res?.success) return { ok: false, error: res?.error || 'Not available.', needsSetup: res?.error === 'Set up your business first.' }
  return { ok: true, data: res.data }
}

/** Reads plain generic lists (the tutor's own rows by access filter). */
export async function lists<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  const r = await keystoneClient<T>(query, variables, { cache: 'no-store' })
  return r.success ? r.data : null
}

export const money = (cents: number | null | undefined, currency = 'USD') => {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100) } catch { return `${((cents ?? 0) / 100).toFixed(2)} ${currency}` }
}
export const when = (iso: string | null | undefined, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) => iso ? new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(iso)) : ''
export const day = (iso: string | null | undefined, tz: string) => when(iso, tz, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
export const time = (iso: string | null | undefined, tz: string) => when(iso, tz, { hour: 'numeric', minute: '2-digit' })
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const label = (s: string | null | undefined) => (s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
export const minutesText = (m: number) => m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
