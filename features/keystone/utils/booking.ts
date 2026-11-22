import type { PrismaClient, Session as SessionRow, SessionType, TutorProfile } from '@prisma/client'

import { addDays, businessDateKey, businessWallTime, dayIndexFor, dayOfWeekFor, isDateKey, openSlots, overlaps, tutorDaysCovering, type Busy } from './availability'
import { CommandError, guarded, lockTutorBooking, share, transaction, type Db, type Tx } from './business'
import { coveringPurchase, heldFor, holdMinutes, reopenDebit, reverseCharge, settleHold } from './ledger'
import { expireOpenCheckouts, refundPaymentRow, sessionCardPayment, settleTarget, stripeOn } from './payments'
import { createPublicAccessToken } from './publicAccessToken'

/** Sessions that hold their time. An unpaid hold stops holding once it ends, even before it is released. */
const holdingTime = (now = new Date()) => ({
  OR: [
    { status: { in: ['scheduled' as const, 'completed' as const, 'no_show' as const] } },
    { status: 'pending_payment' as const, holdEndsAt: { gt: now } },
  ],
})

export const FAMILY_SAFE_STATUSES = ['scheduled', 'pending_payment'] as const

async function busyBetween(db: Db, profileId: string, start: Date, end: Date, excludeSessionId?: string | null): Promise<Busy[]> {
  const [sessions, off] = await Promise.all([
    db.session.findMany({
      where: { profileId, ...holdingTime(), startsAt: { lt: new Date(end.getTime() + 86_400_000) }, endsAt: { gt: new Date(start.getTime() - 86_400_000) }, ...(excludeSessionId ? { NOT: { id: excludeSessionId } } : {}) },
      select: { startsAt: true, endsAt: true }, take: 500,
    }),
    db.timeOff.findMany({ where: { profileId, startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true }, take: 200 }),
  ])
  return [...sessions, ...off]
}

/** Open start times for one tutor-timezone day. */
async function tutorDaySlots(db: Db, profile: TutorProfile, type: Pick<SessionType, 'durationMinutes'>, date: string, excludeSessionId?: string | null, now = new Date()) {
  const hours = await db.weeklyHours.findFirst({ where: { profileId: profile.id, dayOfWeek: dayOfWeekFor(date) as never } })
  const dayStart = businessWallTime(date, 0, profile.timezone)
  const dayEnd = businessWallTime(addDays(date, 1), 0, profile.timezone)
  const busy = await busyBetween(db, profile.id, dayStart, dayEnd, excludeSessionId)
  return openSlots({
    date, timeZone: profile.timezone, hours: hours ?? undefined, duration: type.durationMinutes,
    slotMinutes: profile.slotMinutes, bufferMinutes: profile.bufferMinutes, minNoticeHours: profile.minNoticeHours,
    maxAdvanceDays: profile.maxAdvanceDays, busy, now,
  })
}

/**
 * Slots on a calendar day as the viewer sees it (D15). The viewer's day can
 * span two tutor days, so both are read and the result is cut to the viewer's
 * day. Times are ISO instants; the page formats them in the viewer's timezone.
 */
export async function slotsForDay(db: Db, profile: TutorProfile, type: Pick<SessionType, 'durationMinutes'>, date: string, viewerTimeZone?: string | null, excludeSessionId?: string | null) {
  if (!isDateKey(date)) throw new CommandError('Choose a valid date.')
  const tz = viewerTimeZone || profile.timezone
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) } catch { throw new CommandError('Choose a valid timezone.') }
  const { days, start, end } = tutorDaysCovering(date, tz, profile.timezone)
  const all = (await Promise.all(days.map((d) => tutorDaySlots(db, profile, type, d, excludeSessionId)))).flat()
  return [...new Set(all)].filter((iso) => { const t = new Date(iso).getTime(); return t >= start.getTime() && t < end.getTime() }).sort()
}

async function slotIsOpen(db: Db, profile: TutorProfile, type: Pick<SessionType, 'durationMinutes'>, startsAt: Date, excludeSessionId?: string | null) {
  const free = await tutorDaySlots(db, profile, type, businessDateKey(startsAt, profile.timezone), excludeSessionId)
  return free.includes(startsAt.toISOString())
}

/** The tutor may place a session at any time that does not clash (outside weekly hours too). */
async function tutorTimeIsFree(db: Db, profile: TutorProfile, startsAt: Date, endsAt: Date, excludeSessionId?: string | null) {
  const busy = await busyBetween(db, profile.id, startsAt, endsAt, excludeSessionId)
  return !busy.some((b) => overlaps({ startsAt, endsAt }, b, profile.bufferMinutes))
}

/**
 * Releases unpaid online bookings whose hold ended (Barber `releaseUnpaidHolds`,
 * minutes not hours). Stripe is asked first: a payment that arrived confirms the
 * booking instead. Network calls happen outside any transaction.
 */
export async function releaseUnpaidHolds(prisma: PrismaClient, profileId: string, sessionId?: string) {
  const db = guarded(prisma)
  const stale = await db.session.findMany({ where: { profileId, status: 'pending_payment', holdEndsAt: { lte: new Date() }, ...(sessionId ? { id: sessionId } : {}) }, select: { id: true }, take: 50 })
  let released = 0
  for (const s of stale) {
    if ((await settleTarget(prisma, 'session', s.id).catch(() => ({ paid: false }))).paid) continue
    const done = await db.session.updateMany({ where: { id: s.id, status: 'pending_payment', paymentStatus: 'unpaid' }, data: { status: 'released', cancelledBy: 'system', cancelledAt: new Date(), cancellationReason: 'Not paid before the hold ended; the time was released' } })
    if (!done.count) continue
    released++
    await expireOpenCheckouts(db, 'session', s.id)
  }
  return released
}

export type Actor = 'visitor' | 'guardian' | 'tutor' | 'series'

type BookInput = {
  profile: TutorProfile
  type: SessionType
  family: { id: string; status: string; billingMode: string }
  studentIds: string[]
  startsAt: Date
  actor: Actor
  mode?: string | null
  message?: string
  seriesId?: string | null
}

/**
 * The one booking function (D13, §4.1). Every path that takes time calls it
 * inside a transaction that already holds the tutor booking lock: the slot is
 * re-checked inside the lock, funding is decided, package minutes are held.
 */
export async function bookInLock(tx: Tx, input: BookInput) {
  const { profile, type, family, actor } = input
  if (!type.active) throw new CommandError('This kind of session is not offered right now.')
  if (family.status === 'blocked' && actor !== 'tutor') throw new CommandError('This time can’t be booked online. Contact your tutor.')
  if (input.studentIds.length < 1) throw new CommandError('Choose who the session is for.')
  if (input.studentIds.length > type.maxStudents) throw new CommandError(`This session is for up to ${type.maxStudents} ${type.maxStudents === 1 ? 'student' : 'students'}.`)
  const students = await tx.student.count({ where: { id: { in: input.studentIds }, familyId: family.id, profileId: profile.id } })
  if (students !== new Set(input.studentIds).size) throw new CommandError('Choose your own students.')
  const endsAt = new Date(input.startsAt.getTime() + type.durationMinutes * 60_000)
  const open = actor === 'tutor' || actor === 'series'
    ? await tutorTimeIsFree(tx, profile, input.startsAt, endsAt)
    : await slotIsOpen(tx, profile, type, input.startsAt)
  if (!open) throw new CommandError(actor === 'series' ? 'clash' : 'That time was just taken. Choose another.')

  const mode = input.mode === 'in_person' || (type.mode === 'in_person') ? 'in_person' : 'online'
  if (type.mode !== 'either' && input.mode && input.mode !== type.mode) throw new CommandError(`This session is ${type.mode === 'online' ? 'online' : 'in person'}.`)

  // Funding (D5): free; package minutes if any cover it; else the family's billing mode.
  let funding: 'free' | 'package' | 'card' | 'invoice' | 'flat' = 'free'
  let purchase: Awaited<ReturnType<typeof coveringPurchase>> = null
  if (type.priceCents > 0) {
    purchase = actor === 'visitor' ? null : await coveringPurchase(tx, { profileId: profile.id, familyId: family.id, sessionTypeId: type.id, minutes: type.durationMinutes })
    if (purchase) funding = 'package'
    else if (actor !== 'visitor' && family.billingMode === 'invoice') funding = 'invoice'
    else if (actor !== 'visitor' && family.billingMode === 'flat_monthly') funding = 'flat'
    else funding = 'card'
  }
  // Card at booking: an online booker pays at Checkout and the time is held. Paid to the tutor directly when there is no Stripe.
  const checkout = funding === 'card' && (actor === 'visitor' || actor === 'guardian') && stripeOn()
  const access = createPublicAccessToken()
  const now = new Date()
  const session = await tx.session.create({
    data: {
      profileId: profile.id, familyId: family.id, sessionTypeId: type.id, seriesId: input.seriesId ?? null,
      students: { connect: input.studentIds.map((id) => ({ id })) },
      startsAt: input.startsAt, endsAt, mode, status: checkout ? 'pending_payment' : 'scheduled', funding,
      source: actor === 'visitor' || actor === 'guardian' ? 'online' : actor === 'series' ? 'series' : 'tutor',
      typeNameSnapshot: type.name, priceCents: type.priceCents,
      paymentStatus: funding === 'card' ? 'unpaid' : 'not_due',
      holdEndsAt: checkout ? new Date(now.getTime() + profile.unpaidHoldMinutes * 60_000) : null,
      guardianMessage: (input.message ?? '').slice(0, 1000), publicAccessTokenHash: access.hash,
      locationText: mode === 'in_person' ? profile.inPersonArea : '',
    },
  })
  if (purchase && funding === 'package') {
    // §9.3: the guarded decrement. Losing the race to a parallel booking falls back to the billing mode.
    try { await holdMinutes(tx, purchase, session.id, type.durationMinutes) } catch (e) {
      if (!(e instanceof CommandError)) throw e
      const fallback = family.billingMode === 'invoice' ? 'invoice' : family.billingMode === 'flat_monthly' ? 'flat' : 'card'
      const pay = fallback === 'card' && (actor === 'guardian') && stripeOn()
      await tx.session.update({ where: { id: session.id }, data: { funding: fallback, paymentStatus: fallback === 'card' ? 'unpaid' : 'not_due', ...(pay ? { status: 'pending_payment', holdEndsAt: new Date(now.getTime() + profile.unpaidHoldMinutes * 60_000) } : {}) } })
      return { session: await tx.session.findUniqueOrThrow({ where: { id: session.id } }), token: access.token }
    }
  }
  return { session, token: access.token }
}

/** Book in a fresh locked transaction. */
export async function book(prisma: PrismaClient, input: Omit<BookInput, 'profile' | 'type' | 'family'> & { profileId: string; sessionTypeId: string; familyId: string }) {
  await releaseUnpaidHolds(prisma, input.profileId)
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, input.profileId)
    const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: input.profileId } })
    const type = await tx.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id } })
    if (!type) throw new CommandError('Choose a kind of session.')
    const family = await tx.family.findFirst({ where: { id: input.familyId, profileId: profile.id }, select: { id: true, status: true, billingMode: true } })
    if (!family) throw new CommandError('Choose a family.')
    return bookInLock(tx, { ...input, profile, type, family })
  })
}

// ---------- what a session's cancellation would cost ----------

export function insideWindow(profile: Pick<TutorProfile, 'cancellationWindowHours'>, startsAt: Date, now = new Date()) {
  return now.getTime() > startsAt.getTime() - profile.cancellationWindowHours * 3_600_000
}

/** Plain words for what cancelling now would charge (S5, shown before the guardian confirms). */
export function cancelTerms(profile: TutorProfile, s: Pick<SessionRow, 'startsAt' | 'funding' | 'priceCents' | 'status' | 'endsAt'>, durationMinutes: number, now = new Date()) {
  if (s.status === 'pending_payment') return { late: false, percent: 0, text: 'Nothing is charged.' }
  const late = insideWindow(profile, s.startsAt, now)
  const percent = late ? profile.lateCancelPercent : 0
  if (!late) return { late, percent, text: s.funding === 'package' ? 'Your package minutes come back.' : s.funding === 'card' ? 'Anything you paid by card is refunded.' : 'Nothing is charged.' }
  if (percent === 0 || s.funding === 'free' || s.funding === 'flat') return { late, percent, text: `This is inside the ${profile.cancellationWindowHours}-hour window, but nothing is charged.` }
  const what = s.funding === 'package' ? `${share(durationMinutes, percent)} minutes of your package` : `${percent}% of the price`
  return { late, percent, text: `This is inside the ${profile.cancellationWindowHours}-hour cancellation window, so ${what} is charged.` }
}

type Loaded = SessionRow & { profile: TutorProfile; sessionType: SessionType | null }

async function load(db: Db, id: string, profileId?: string) {
  const s = await db.session.findFirst({ where: { id, ...(profileId ? { profileId } : {}) }, include: { profile: true, sessionType: true } })
  if (!s) throw new CommandError('This session was not found.')
  return s as Loaded
}

const minutesOf = (s: Pick<SessionRow, 'startsAt' | 'endsAt'>) => Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000)

/**
 * Charges `percent` of a session the family cancelled late or missed: package
 * minutes are debited and the rest released; invoice sessions bill that
 * share; card keeps that share (the rest refunded by the caller, outside the lock).
 */
async function chargeShare(tx: Tx, s: Loaded, percent: number, reason: string) {
  const out = { chargedCents: 0, chargedMinutes: 0, billable: 'no' as 'no' | 'yes' }
  if (s.funding === 'package') {
    const r = await settleHold(tx, s.profileId, s.id, share(minutesOf(s), percent), reason)
    out.chargedMinutes = r.charged
  } else if (s.funding === 'invoice') {
    out.chargedCents = share(s.priceCents, percent)
    out.billable = out.chargedCents > 0 ? 'yes' : 'no'
  } else if (s.funding === 'card') {
    out.chargedCents = share(s.priceCents, percent)
  }
  return out
}

/** Card money to give back for a session, given what it should keep. Runs outside the lock. */
async function refundCardDown(prisma: PrismaClient, sessionId: string, keepCents: number, note: string) {
  const payment = await sessionCardPayment(guarded(prisma), sessionId)
  if (!payment) return 0
  const left = payment.amountCents - payment.refundedCents
  const give = Math.max(0, left - keepCents)
  if (give <= 0) return 0
  await refundPaymentRow(prisma, payment.id, give, note)
  return give
}

/**
 * Cancel (§4.1): `guardian` outside the window → cancelled, nothing charged;
 * inside → late_cancelled with the policy charge. `tutor` → cancelled, never
 * charged. Card refunds happen first; if Stripe refuses, the session stays booked.
 */
export async function cancelSession(prisma: PrismaClient, input: { sessionId: string; by: 'guardian' | 'tutor'; profileId: string; reason?: string }) {
  const db = guarded(prisma)
  let s = await load(db, input.sessionId, input.profileId)
  if (s.status === 'pending_payment') {
    await settleTarget(prisma, 'session', s.id).catch(() => null)
    s = await load(db, s.id, input.profileId)
  }
  if (s.status === 'pending_payment') {
    const done = await db.session.updateMany({ where: { id: s.id, status: 'pending_payment' }, data: { status: 'cancelled', cancelledBy: input.by, cancelledAt: new Date(), cancellationReason: input.reason || 'Cancelled before payment' } })
    if (!done.count) throw new CommandError('This session changed. Refresh and try again.')
    await expireOpenCheckouts(db, 'session', s.id)
    return { status: 'cancelled', charged: 'nothing', refundedCents: 0 }
  }
  if (s.status !== 'scheduled') throw new CommandError('Only a booked session can be cancelled.')
  if (input.by === 'guardian' && s.startsAt.getTime() <= Date.now()) throw new CommandError('This session has started. Contact your tutor.')
  const late = input.by === 'guardian' && insideWindow(s.profile, s.startsAt)
  const percent = late ? s.profile.lateCancelPercent : 0
  const keepCents = s.funding === 'card' ? share(s.priceCents, percent) : 0
  let refundedCents = 0
  if (s.funding === 'card') {
    try { refundedCents = await refundCardDown(prisma, s.id, keepCents, input.by === 'tutor' ? 'Cancelled by the tutor' : 'Cancelled by the family') } catch (e) {
      if (e instanceof CommandError) throw new CommandError(`The card refund did not go through, so the session is still booked. ${e.message}`)
      throw e
    }
  }
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, s.profileId)
    const fresh = await load(tx, s.id)
    if (fresh.status !== 'scheduled') throw new CommandError('This session changed. Refresh and try again.')
    const charge = late ? await chargeShare(tx, fresh, percent, 'Late cancellation') : { chargedCents: 0, chargedMinutes: 0, billable: 'no' as const }
    if (!late && fresh.funding === 'package') await settleHold(tx, fresh.profileId, fresh.id, 0, input.by === 'tutor' ? 'Cancelled by the tutor' : 'Cancelled in time')
    const done = await tx.session.updateMany({
      where: { id: fresh.id, status: 'scheduled' },
      data: { status: late ? 'late_cancelled' : 'cancelled', cancelledBy: input.by, cancelledAt: new Date(), cancellationReason: (input.reason || '').slice(0, 300), ...charge },
    })
    if (!done.count) throw new CommandError('This session changed. Refresh and try again.')
    return { status: late ? 'late_cancelled' : 'cancelled', charged: late && percent > 0 ? `${percent}%` : 'nothing', refundedCents }
  })
}

/** Reschedule (§4.1, §9.17): same lock; the new slot must be free; the old slot frees in the same transaction; funding carries. */
export async function rescheduleSession(prisma: PrismaClient, input: { sessionId: string; by: 'guardian' | 'tutor'; profileId: string; startsAt: Date }) {
  await releaseUnpaidHolds(prisma, input.profileId)
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, input.profileId)
    const s = await load(tx, input.sessionId, input.profileId)
    if (!['scheduled', 'pending_payment'].includes(s.status)) throw new CommandError('Only a booked session can be moved.')
    if (!s.sessionType) throw new CommandError('This session has no session type.')
    if (input.by === 'guardian') {
      if (insideWindow(s.profile, s.startsAt)) throw new CommandError(`Moving closes ${s.profile.cancellationWindowHours} hours before the session. Contact your tutor.`)
      if (s.rescheduleCount >= s.profile.reschedulesAllowed) throw new CommandError(`This session has been moved ${s.rescheduleCount} ${s.rescheduleCount === 1 ? 'time' : 'times'}, the most allowed. Contact your tutor.`)
    }
    const duration = minutesOf(s)
    const endsAt = new Date(input.startsAt.getTime() + duration * 60_000)
    const free = input.by === 'tutor'
      ? await tutorTimeIsFree(tx, s.profile, input.startsAt, endsAt, s.id)
      : await slotIsOpen(tx, s.profile, { durationMinutes: duration }, input.startsAt, s.id)
    if (!free) throw new CommandError('That time was just taken. Choose another.')
    const done = await tx.session.updateMany({
      where: { id: s.id, status: s.status, startsAt: s.startsAt },
      data: { startsAt: input.startsAt, endsAt, rescheduledFrom: s.startsAt, reminderSentAt: null, ...(input.by === 'guardian' ? { rescheduleCount: { increment: 1 } } : {}) },
    })
    if (!done.count) throw new CommandError('This session changed. Refresh and try again.')
    return { id: s.id, startsAt: input.startsAt.toISOString(), endsAt: endsAt.toISOString(), from: s.startsAt.toISOString() }
  })
}

/** Tutor: complete (not before the start). Package hold becomes a debit; invoice becomes billable. */
export async function completeInLock(tx: Tx, sessionId: string, profileId: string) {
  const s = await load(tx, sessionId, profileId)
  if (s.status !== 'scheduled') throw new CommandError('Only a booked session can be completed.')
  if (s.startsAt.getTime() > Date.now()) throw new CommandError('This session has not started yet.')
  const charge = await chargeShare(tx, s, 100, 'Session taught')
  const done = await tx.session.updateMany({ where: { id: s.id, status: 'scheduled' }, data: { status: 'completed', completedAt: new Date(), ...charge } })
  if (!done.count) throw new CommandError('This session changed. Refresh and try again.')
  return s
}

export async function markNoShow(prisma: PrismaClient, sessionId: string, profileId: string) {
  const s = await load(guarded(prisma), sessionId, profileId)
  if (s.status !== 'scheduled') throw new CommandError('Only a booked session can be marked as a no-show.')
  if (s.startsAt.getTime() > Date.now()) throw new CommandError('A no-show can be marked once the session has started.')
  const percent = s.profile.noShowPercent
  if (s.funding === 'card') await refundCardDown(prisma, s.id, share(s.priceCents, percent), 'No-show: charge reduced by your tutor’s policy')
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId)
    const fresh = await load(tx, sessionId, profileId)
    if (fresh.status !== 'scheduled') throw new CommandError('This session changed. Refresh and try again.')
    const charge = await chargeShare(tx, fresh, percent, 'No-show')
    await tx.session.updateMany({ where: { id: fresh.id, status: 'scheduled' }, data: { status: 'no_show', cancelledBy: 'none', ...charge } })
    return { status: 'no_show', percent }
  })
}

async function onLiveInvoice(db: Db, sessionId: string) {
  return (await db.invoiceLine.count({ where: { sessionId, invoice: { status: { in: ['sent', 'paid'] } } } })) > 0
}

/** Tutor: excuse a late cancel or no-show within 30 days and not on a sent invoice. Reverses the charge for every funding. */
export async function excuseSession(prisma: PrismaClient, sessionId: string, profileId: string) {
  const db = guarded(prisma)
  const s = await load(db, sessionId, profileId)
  if (!['late_cancelled', 'no_show'].includes(s.status)) throw new CommandError('Only a late cancellation or a no-show can be excused.')
  if (Date.now() - s.startsAt.getTime() > 30 * 86_400_000) throw new CommandError('A charge can be excused up to 30 days after the session.')
  if (await onLiveInvoice(db, s.id)) throw new CommandError('This charge is on a sent invoice. Void the invoice first.')
  if (s.funding === 'card') await refundCardDown(prisma, s.id, 0, 'Charge excused by your tutor')
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId)
    if (await onLiveInvoice(tx, s.id)) throw new CommandError('This charge is on a sent invoice. Void the invoice first.')
    // A draft invoice line for it goes away with the charge.
    await tx.invoiceLine.deleteMany({ where: { sessionId: s.id, invoice: { status: 'draft' } } })
    if (s.funding === 'package') await reverseCharge(tx, profileId, s.id, 'Excused')
    const done = await tx.session.updateMany({ where: { id: s.id, status: s.status }, data: { status: 'excused', chargedCents: 0, chargedMinutes: 0, billable: 'no' } })
    if (!done.count) throw new CommandError('This session changed. Refresh and try again.')
    return { status: 'excused' }
  })
}

/** Tutor: reopen a completed session within 7 days (a mis-click), not on a sent invoice. */
export async function reopenSession(prisma: PrismaClient, sessionId: string, profileId: string) {
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId)
    const s = await load(tx, sessionId, profileId)
    if (s.status !== 'completed') throw new CommandError('Only a completed session can be reopened.')
    if (!s.completedAt || Date.now() - s.completedAt.getTime() > 7 * 86_400_000) throw new CommandError('A session can be reopened up to 7 days after it was completed.')
    if (await onLiveInvoice(tx, s.id)) throw new CommandError('This session is on a sent invoice. Void the invoice first.')
    await tx.invoiceLine.deleteMany({ where: { sessionId: s.id, invoice: { status: 'draft' } } })
    if (s.funding === 'package') await reopenDebit(tx, profileId, s.id)
    await tx.session.updateMany({ where: { id: s.id, status: 'completed' }, data: { status: 'scheduled', completedAt: null, chargedCents: 0, chargedMinutes: 0, billable: 'no' } })
    return { status: 'scheduled' }
  })
}

// ---------- weekly series (D12, §4.6) ----------

const WEEKS_AHEAD = 8

/** Generates a series' sessions up to 8 weeks ahead. A clash skips that week and lists it. Runs inside the booking lock. */
export async function topUpSeriesInLock(tx: Tx, seriesId: string, now = new Date()) {
  const series = await tx.recurringSeries.findUnique({ where: { id: seriesId }, include: { students: { select: { id: true } } } })
  if (!series || series.status !== 'active' || !series.sessionTypeId || !series.familyId) return { created: 0, skipped: [] as string[] }
  const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: series.profileId } })
  const type = await tx.sessionType.findUnique({ where: { id: series.sessionTypeId } })
  const family = await tx.family.findUnique({ where: { id: series.familyId }, select: { id: true, status: true, billingMode: true } })
  if (!type || !family) return { created: 0, skipped: [] }
  const today = businessDateKey(now, profile.timezone)
  const horizon = addDays(today, WEEKS_AHEAD * 7)
  let date = series.generatedThrough ? addDays(series.generatedThrough, 1) : series.startsOn
  if (date < today) date = today
  while (dayIndexFor(date) !== series.dayOfWeek) date = addDays(date, 1)
  const skipped: string[] = []
  let created = 0
  let through = series.generatedThrough || addDays(series.startsOn, -1)
  for (; date <= horizon && (!series.endsOn || date <= series.endsOn); date = addDays(date, 7)) {
    through = date
    let startsAt: Date
    try { startsAt = businessWallTime(date, series.startMinute, profile.timezone) } catch { skipped.push(date); continue }
    if (startsAt.getTime() <= now.getTime()) continue
    try {
      await bookInLock(tx, { profile, type, family, studentIds: series.students.map((s) => s.id), startsAt, actor: 'series', mode: series.mode, seriesId: series.id })
      created++
    } catch (e) {
      if (e instanceof CommandError) { skipped.push(date); continue }
      throw e
    }
  }
  if (series.endsOn && horizon >= series.endsOn) through = series.endsOn > through ? series.endsOn : through
  const known = new Set((series.skippedDates || '').split('\n').filter(Boolean))
  skipped.forEach((d) => known.add(d))
  await tx.recurringSeries.update({ where: { id: series.id }, data: { generatedThrough: through, skippedDates: [...known].sort().join('\n') } })
  return { created, skipped }
}

/** Tops up every active series of a tutor (D16: when the calendar or Today is read). */
export async function topUpAllSeries(prisma: PrismaClient, profileId: string) {
  const db = guarded(prisma)
  const profile = await db.tutorProfile.findUnique({ where: { id: profileId }, select: { timezone: true } })
  if (!profile) return
  const horizon = addDays(businessDateKey(new Date(), profile.timezone), WEEKS_AHEAD * 7 - 7)
  const due = await db.recurringSeries.findMany({ where: { profileId, status: 'active', OR: [{ generatedThrough: '' }, { generatedThrough: { lt: horizon } }] }, select: { id: true, endsOn: true, generatedThrough: true }, take: 50 })
  for (const s of due) {
    if (s.endsOn && s.generatedThrough && s.generatedThrough >= s.endsOn) continue
    await transaction(prisma, async (tx) => { await lockTutorBooking(tx, profileId); await topUpSeriesInLock(tx, s.id) })
  }
}

/** Pausing or ending cancels future generated sessions that are still booked, as tutor cancellations (no charge). */
export async function cancelFutureSeriesSessions(prisma: PrismaClient, seriesId: string, profileId: string) {
  const db = guarded(prisma)
  const future = await db.session.findMany({ where: { seriesId, profileId, status: 'scheduled', startsAt: { gt: new Date() } }, select: { id: true }, take: 200 })
  let cancelled = 0
  for (const s of future) {
    await cancelSession(prisma, { sessionId: s.id, by: 'tutor', profileId, reason: 'Weekly series paused or ended' }).then(() => cancelled++).catch((e) => console.error('[tutor] series cancel failed', e instanceof Error ? e.message : e))
  }
  return cancelled
}

export { heldFor }
