import type { Prisma, PrismaClient, TutorProfile } from '@prisma/client'

import type { RoleFlags, Session } from '../access'
import { guardKeystonePrismaResults } from './prisma-result'

export type Db = PrismaClient | Prisma.TransactionClient
export type Tx = Prisma.TransactionClient

/** A refusal the person can act on. Any other error is reported as a generic failure. */
export class CommandError extends Error {}

export type CommandResult<T = unknown> = { success: boolean; error: string | null; data: T | null }

export const ok = <T>(data: T): CommandResult<T> => ({ success: true, error: null, data })
export const fail = (error: unknown): CommandResult<never> => ({
  success: false,
  error: error instanceof CommandError ? error.message : 'This could not be completed. Try again.',
  data: null,
})

/**
 * Keystone 6.5 resolves Prisma failures as returned GraphQLError values instead
 * of throwing them (see `prisma-result.ts`, from Gym). Every command works on a
 * guarded client so a failed write throws and rolls its transaction back.
 */
export function guarded(prisma: PrismaClient): PrismaClient {
  return guardKeystonePrismaResults(prisma)
}

/**
 * One short READ COMMITTED transaction. Callers that take a slot or move money
 * take an advisory lock as their first statement; each later statement then
 * sees everything committed before the lock was granted.
 */
export function transaction<T>(prisma: PrismaClient, work: (tx: Tx) => Promise<T>): Promise<T> {
  return guarded(prisma).$transaction(async (tx) => work(guardKeystonePrismaResults(tx)), { maxWait: 30_000, timeout: 60_000 })
}

/** Serialises every path that takes a time slot for one tutor (D13). */
export async function lockTutorBooking(tx: Tx, profileId: string) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'tutor-booking', profileId)
}

/** Serialises invoice numbering, invoice lines and invoice payments for one tutor. */
export async function lockTutorBilling(tx: Tx, profileId: string) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'tutor-billing', profileId)
}

/** Serialises changes to one family's own records (reviews, account claim). */
export async function lockFamily(tx: Tx, familyId: string) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'tutor-family', familyId)
}

/** The signed-in tutor's own business, or a plain refusal. */
export async function requireTutor(db: Db, session: Session | undefined, permission: keyof RoleFlags = 'canManageSessions'): Promise<TutorProfile> {
  if (!session) throw new CommandError('Sign in first.')
  if (!session.data.role?.[permission]) throw new CommandError('Your role does not allow this.')
  const profile = await db.tutorProfile.findFirst({ where: { ownerId: session.itemId } })
  if (!profile) throw new CommandError('Set up your business first.')
  return profile
}

export function money(cents: number, currency = 'USD') {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100) } catch { return `${(cents / 100).toFixed(2)} ${currency}` }
}

export function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function cleanEmail(value: unknown) {
  const email = cleanText(value, 200).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommandError('Enter a valid email.')
  return email
}

export function cleanUrl(value: unknown) {
  const url = cleanText(value, 500)
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    return parsed.toString()
  } catch { throw new CommandError('Enter a full link starting with https://') }
}

export function wholeCents(value: unknown, label: string, max = 100_000_000) {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new CommandError(`${label} is not a valid amount.`)
  return n
}

export function parseInstant(value: unknown, label = 'Choose a time.') {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) throw new CommandError(label)
  return date
}

export function validTimeZone(value: unknown) {
  const tz = cleanText(value, 80)
  if (!tz) return ''
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz } catch { throw new CommandError('Choose a valid timezone.') }
}

/** Charged share of an amount, rounded down so a family is never overcharged by rounding. */
export const share = (amount: number, percent: number) => Math.floor((amount * percent) / 100)
