import type { PrismaClient } from '@prisma/client'

import type { Session } from '../access'
import { trustedOrigin } from '../../shared/trusted-origin'
import { addDays, businessDateKey } from './availability'
import { book, cancelSession, cancelTerms, insideWindow, releaseUnpaidHolds, rescheduleSession, slotsForDay } from './booking'
import { reportPayment as reportOffline, startPurchase } from './billing'
import { CommandError, cleanText, guarded, lockTutorBooking, parseInstant, transaction, validTimeZone, type Db } from './business'
import { cleanVisitor, familyForVisitor, requireFamily } from './family'
import { cardProvider, openCheckout, settleTarget, stripeOn } from './payments'
import { notify } from './notify'
import { publicAccessTokenMatches } from './publicAccessToken'
import { familyHomeworkSelect, familyInvoiceSelect, familyPurchaseSelect, familySessionSelect, familyStudentSelect, isOverdue, iso } from './views'
import { expirePurchases } from './ledger'

/**
 * §5.7 public and guardian operations. Public reads return hand-built JSON
 * with no private field; guardian operations resolve the family from the
 * session and filter every read by it.
 */

const origin = () => trustedOrigin()
export const bookingLink = (id: string, token: string) => `${origin()}/booking/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`
export const invoiceLink = (id: string, token: string) => `${origin()}/invoice/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`

const fmtWhen = (d: Date, tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short' }).format(d)

// ---------------- public ----------------

async function profileBySlug(db: Db, slug: string) {
  const p = await db.tutorProfile.findUnique({ where: { slug: cleanText(slug, 60).toLowerCase() } })
  if (!p) throw new CommandError('This tutor page was not found.')
  return p
}

/** S1: the tutor's page. Payment instructions are not public (§5.6). */
export async function publicTutor(prisma: PrismaClient, slug: string) {
  const db = guarded(prisma)
  const p = await db.tutorProfile.findUnique({
    where: { slug: cleanText(slug, 60).toLowerCase() },
    include: {
      subjects: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, levels: true, description: true, imageUrl: true } },
      sessionTypes: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }], select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true, mode: true, openToNewFamilies: true, maxStudents: true, subjects: { select: { id: true } } } },
      packages: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { minutes: 'asc' }], select: { id: true, name: true, description: true, minutes: true, priceCents: true, validMonths: true, appliesTo: { select: { id: true, name: true } } } },
      weeklyHours: { select: { dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } },
      reviews: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, displayName: true, rating: true, body: true, createdAt: true } },
    },
  })
  if (!p) return null
  const ratings = p.reviews.map((r) => r.rating)
  return iso({
    slug: p.slug, businessName: p.businessName, tutorName: p.tutorName, headline: p.headline, bio: p.bio, qualifications: p.qualifications,
    photoUrl: p.photoUrl, heroImageUrl: p.heroImageUrl, phone: p.phone, email: p.email, city: p.city, country: p.country,
    timezone: p.timezone, currencyCode: p.currencyCode, teachesOnline: p.teachesOnline, teachesInPerson: p.teachesInPerson, inPersonArea: p.inPersonArea,
    bookingOpen: p.bookingOpen, minNoticeHours: p.minNoticeHours, maxAdvanceDays: p.maxAdvanceDays,
    cancellationWindowHours: p.cancellationWindowHours, lateCancelPercent: p.lateCancelPercent, noShowPercent: p.noShowPercent,
    unpaidHoldMinutes: p.unpaidHoldMinutes, reschedulesAllowed: p.reschedulesAllowed, policiesText: p.policiesText,
    cardPayments: stripeOn() && Boolean(await cardProvider(db, p.id)), reviewsEnabled: p.reviewsEnabled,
    subjects: p.subjects,
    sessionTypes: p.sessionTypes.map((t) => ({ ...t, subjectIds: t.subjects.map((s) => s.id), subjects: undefined })),
    packages: p.packages,
    hours: p.weeklyHours,
    reviews: p.reviewsEnabled ? p.reviews : [],
    rating: ratings.length ? { average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10, count: ratings.length } : null,
  })
}

/** The home page shows the first tutor with booking open (D1). */
export async function homeTutor(prisma: PrismaClient) {
  const first = await guarded(prisma).tutorProfile.findFirst({ where: { bookingOpen: true }, orderBy: { createdAt: 'asc' }, select: { slug: true } })
    ?? await guarded(prisma).tutorProfile.findFirst({ orderBy: { createdAt: 'asc' }, select: { slug: true } })
  return first ? publicTutor(prisma, first.slug) : null
}

/**
 * S2: open times on a day as the viewer sees it. `excludeSessionId` (with its
 * token or for the signed-in family) lets a reschedule offer the session's own slot.
 */
export async function publicSlots(prisma: PrismaClient, input: { slug: string; sessionTypeId: string; date: string; timezone?: string | null; excludeSessionId?: string | null; token?: string | null }, session?: Session) {
  const db = guarded(prisma)
  const profile = await profileBySlug(db, input.slug)
  await releaseUnpaidHolds(prisma, profile.id).catch((e) => console.error('[tutor] hold release failed', e instanceof Error ? e.message : e))
  if (!profile.bookingOpen) throw new CommandError('Online booking is closed. Send your tutor a message instead.')
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id, active: true } })
  if (!type) throw new CommandError('Choose a kind of session.')
  let exclude: string | null = null
  if (input.excludeSessionId) {
    const s = await db.session.findFirst({ where: { id: input.excludeSessionId, profileId: profile.id }, select: { id: true, publicAccessTokenHash: true, family: { select: { userId: true } }, startsAt: true, endsAt: true } })
    const mine = s && ((input.token && publicAccessTokenMatches(input.token, s.publicAccessTokenHash)) || (session?.itemId && s.family?.userId === session.itemId))
    if (!mine) throw new CommandError('This booking link is not valid.')
    exclude = s.id
    const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000)
    return { date: input.date, timezone: input.timezone || profile.timezone, tutorTimezone: profile.timezone, slots: await slotsForDay(db, profile, { durationMinutes: duration }, input.date, input.timezone, exclude) }
  }
  return { date: input.date, timezone: input.timezone || profile.timezone, tutorTimezone: profile.timezone, slots: await slotsForDay(db, profile, type, input.date, input.timezone) }
}

/** S2: a new family books a type open to new families (D3, D4). */
export async function bookFirstSession(prisma: PrismaClient, input: { slug: string; sessionTypeId: string; startsAt: string; guardianName: string; email?: string | null; phone?: string | null; studentName: string; studentLevel?: string | null; message?: string | null; timezone?: string | null; mode?: string | null }) {
  const db = guarded(prisma)
  const visitor = cleanVisitor({ ...input, needs: input.message })
  const timezone = validTimeZone(input.timezone)
  const startsAt = parseInstant(input.startsAt)
  const profile = await profileBySlug(db, input.slug)
  if (!profile.bookingOpen) throw new CommandError('Online booking is closed. Send your tutor a message instead.')
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id, active: true } })
  if (!type) throw new CommandError('Choose a kind of session.')
  if (!type.openToNewFamilies) throw new CommandError('This kind of session is for current families. Book a first session or consultation instead.')
  await releaseUnpaidHolds(prisma, profile.id)
  const result = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profile.id)
    const { family, student } = await familyForVisitor(tx, profile.id, { ...visitor, timezone })
    const { bookInLock } = await import('./booking')
    const fresh = await tx.tutorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    return bookInLock(tx, { profile: fresh, type, family, studentIds: [student.id], startsAt, actor: 'visitor', mode: input.mode, message: visitor.needs })
  })
  const s = result.session
  const link = bookingLink(s.id, result.token)
  const tz = timezone || profile.timezone
  void notify(prisma, { profileId: profile.id, kind: 'booking_confirmed', to: visitor.email, subject: s.status === 'pending_payment' ? `Finish booking: ${type.name}` : `Booked: ${type.name} with ${profile.businessName}`, lines: [`Hi ${visitor.guardianName},`, s.status === 'pending_payment' ? `Your time is held until ${fmtWhen(s.holdEndsAt!, tz)}. Pay to confirm it.` : `${type.name} for ${visitor.studentName} is booked for ${fmtWhen(s.startsAt, tz)}.`, 'Open your booking to see the lesson link, add it to your calendar, pay, move or cancel it.'], link, linkLabel: 'Open your booking', replyTo: profile.email, sessionId: s.id })
  void notify(prisma, { profileId: profile.id, kind: 'tutor_new_booking', to: profile.email, subject: `New booking: ${visitor.guardianName}, ${fmtWhen(s.startsAt, profile.timezone)}`, lines: [`${visitor.guardianName} booked ${type.name} for ${visitor.studentName} (${visitor.studentLevel || 'level not given'}).`, visitor.needs ? `They wrote: ${visitor.needs}` : ''].filter(Boolean), link: `${origin()}/dashboard/platform/sessions/${s.id}`, linkLabel: 'Open in your dashboard', sessionId: s.id })
  return { bookingId: s.id, token: result.token, status: s.status, funding: s.funding, needsPayment: s.status === 'pending_payment', holdEndsAt: s.holdEndsAt?.toISOString() ?? null, bookingUrl: link }
}

async function bookingByToken(db: Db, id: string, token: string) {
  const s = await db.session.findUnique({ where: { id }, select: { id: true, profileId: true, publicAccessTokenHash: true } })
  if (!s || !publicAccessTokenMatches(token, s.publicAccessTokenHash)) throw new CommandError('This booking link is not valid.')
  return s
}

/** One session as its family sees it. Never includes the private note or needs. */
async function sessionView(prisma: PrismaClient, id: string) {
  const db = guarded(prisma)
  const s = await db.session.findUniqueOrThrow({ where: { id }, select: { ...familySessionSelect, profileId: true, familyId: true, family: { select: { guardianName: true, email: true, timezone: true, userId: true } }, sessionType: { select: { durationMinutes: true } } } })
  const p = await db.tutorProfile.findUniqueOrThrow({ where: { id: s.profileId } })
  const known = s.family?.userId || s.status !== 'pending_payment'
  const meetingUrl = s.mode === 'online' ? (s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || p.defaultMeetingUrl) : ''
  const payable = s.funding === 'card' && s.paymentStatus === 'unpaid' && ['pending_payment', 'scheduled', 'completed'].includes(s.status)
  const card = payable && stripeOn() && Boolean(await cardProvider(db, p.id))
  const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000)
  const terms = ['scheduled', 'pending_payment'].includes(s.status) ? cancelTerms(p, s, duration) : null
  const canMove = s.status === 'scheduled' && !insideWindow(p, s.startsAt) && s.rescheduleCount < p.reschedulesAllowed
  const reported = await db.payment.findMany({ where: { sessionId: s.id, kind: 'session' }, select: { id: true, method: true, status: true, amountCents: true, reference: true, paidAt: true }, take: 20 })
  return iso({
    id: s.id, status: s.status, funding: s.funding, paymentStatus: s.paymentStatus, startsAt: s.startsAt, endsAt: s.endsAt, durationMinutes: duration,
    sessionName: s.typeNameSnapshot, sessionTypeId: s.sessionTypeId, priceCents: s.priceCents, chargedCents: s.chargedCents, chargedMinutes: s.chargedMinutes, currencyCode: p.currencyCode,
    mode: s.mode, meetingUrl: known ? meetingUrl : '', locationText: s.mode === 'in_person' ? (s.locationText || p.inPersonArea) : '',
    holdEndsAt: s.status === 'pending_payment' ? s.holdEndsAt : null, released: s.status === 'released',
    cancellationReason: s.cancellationReason, cancelledBy: s.cancelledBy, rescheduleCount: s.rescheduleCount, rescheduledFrom: s.rescheduledFrom,
    students: s.students.map((x) => ({ id: x.id, firstName: x.firstName })),
    note: s.note?.sharedAt ? { covered: s.note.covered, wentWell: s.note.wentWell, workOnNext: s.note.workOnNext, effort: s.note.effort, sharedAt: s.note.sharedAt } : null,
    homework: s.homework,
    payments: reported,
    tutor: { slug: p.slug, businessName: p.businessName, tutorName: p.tutorName, photoUrl: p.photoUrl, phone: p.phone, email: p.email, timezone: p.timezone },
    familyTimezone: s.family?.timezone || '', guardianName: s.family?.guardianName ?? '', hasAccount: Boolean(s.family?.userId),
    canPayByCard: card, payDirectly: payable && !card, paymentInstructions: payable || s.funding === 'invoice' ? p.paymentInstructions : '',
    canCancel: Boolean(terms) && s.startsAt.getTime() > Date.now(), cancelTerms: terms?.text ?? null, cancelIsLate: terms?.late ?? false,
    canReschedule: canMove, rescheduleClosedReason: s.status === 'scheduled' && !canMove ? (insideWindow(p, s.startsAt) ? `Moving closes ${p.cancellationWindowHours} hours before the session. Contact your tutor.` : 'This session has been moved the most times allowed. Contact your tutor.') : null,
    calendarUrl: `/api/calendar/session/${s.id}`,
  })
}

/** S3/S4: booking status by private link. Reads Stripe back and releases an ended hold first. */
export async function publicBooking(prisma: PrismaClient, id: string, token: string) {
  const db = guarded(prisma)
  const s = await bookingByToken(db, id, token)
  await settleTarget(prisma, 'session', s.id).catch(() => null)
  await releaseUnpaidHolds(prisma, s.profileId, s.id).catch(() => null)
  const view = await sessionView(prisma, s.id)
  return { ...view, calendarUrl: `/api/calendar/session/${s.id}?t=${encodeURIComponent(token)}` }
}

async function payForSessionRow(prisma: PrismaClient, sessionId: string, backUrl: string) {
  const db = guarded(prisma)
  await settleTarget(prisma, 'session', sessionId).catch(() => null)
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { profile: true, family: { select: { email: true } } } })
  if (s.status === 'pending_payment' && s.holdEndsAt && s.holdEndsAt <= new Date()) {
    await releaseUnpaidHolds(prisma, s.profileId, s.id)
    throw new CommandError('The time was not paid for before the hold ended, so it was released. Book again.')
  }
  if (s.status === 'released') throw new CommandError('The time was not paid for before the hold ended, so it was released. Book again.')
  if (s.funding !== 'card' || s.paymentStatus !== 'unpaid' || !['pending_payment', 'scheduled', 'completed'].includes(s.status)) throw new CommandError('This session has nothing to pay.')
  return openCheckout(prisma, { profile: s.profile, target: 'session', targetId: s.id, amountCents: s.priceCents, description: `${s.typeNameSnapshot} · ${s.profile.businessName}`, email: s.family?.email, backUrl, holdEndsAt: s.status === 'pending_payment' ? s.holdEndsAt : null })
}

export async function payForBooking(prisma: PrismaClient, id: string, token: string) {
  const s = await bookingByToken(guarded(prisma), id, token)
  return payForSessionRow(prisma, s.id, bookingLink(s.id, token))
}

export async function confirmBookingPayment(prisma: PrismaClient, id: string, token: string) {
  const s = await bookingByToken(guarded(prisma), id, token)
  const r = await settleTarget(prisma, 'session', s.id)
  return { paid: r.paid || (await guarded(prisma).session.findUniqueOrThrow({ where: { id: s.id }, select: { paymentStatus: true } })).paymentStatus === 'paid' }
}

async function afterChange(prisma: PrismaClient, sessionId: string, kind: 'cancelled' | 'moved', link: string | null) {
  const s = await guarded(prisma).session.findUnique({ where: { id: sessionId }, include: { profile: true, family: { select: { email: true, guardianName: true, timezone: true } } } })
  if (!s) return
  const tz = s.family?.timezone || s.profile.timezone
  const what = kind === 'cancelled' ? `${s.typeNameSnapshot} on ${fmtWhen(s.startsAt, tz)} is cancelled.` : `${s.typeNameSnapshot} is now on ${fmtWhen(s.startsAt, tz)}.`
  void notify(prisma, { profileId: s.profileId, kind: kind === 'cancelled' ? 'session_cancelled' : 'session_moved', to: s.family?.email, subject: kind === 'cancelled' ? 'Session cancelled' : 'Session moved', lines: [`Hi ${s.family?.guardianName ?? ''},`, what], link: link ?? `${origin()}/account/sessions/${s.id}`, linkLabel: 'Open the session', replyTo: s.profile.email, sessionId: s.id })
  void notify(prisma, { profileId: s.profileId, kind: kind === 'cancelled' ? 'tutor_session_cancelled' : 'tutor_session_moved', to: s.profile.email, subject: `${s.family?.guardianName ?? 'A family'}: ${kind === 'cancelled' ? 'cancelled' : 'moved'} a session`, lines: [what], link: `${origin()}/dashboard/platform/sessions/${s.id}`, linkLabel: 'Open in your dashboard', sessionId: s.id })
}

export async function cancelMyBooking(prisma: PrismaClient, id: string, token: string, reason?: string | null) {
  const s = await bookingByToken(guarded(prisma), id, token)
  const r = await cancelSession(prisma, { sessionId: s.id, by: 'guardian', profileId: s.profileId, reason: cleanText(reason, 300) })
  void afterChange(prisma, s.id, 'cancelled', bookingLink(s.id, token))
  return r
}

export async function rescheduleMyBooking(prisma: PrismaClient, id: string, token: string, startsAt: string) {
  const s = await bookingByToken(guarded(prisma), id, token)
  const r = await rescheduleSession(prisma, { sessionId: s.id, by: 'guardian', profileId: s.profileId, startsAt: parseInstant(startsAt) })
  void afterChange(prisma, s.id, 'moved', bookingLink(s.id, token))
  return r
}

/** S6: "Ask about tutoring". */
export async function sendInquiry(prisma: PrismaClient, input: { slug: string; name: string; email?: string | null; phone?: string | null; studentLevel?: string | null; subject?: string | null; message?: string | null }) {
  const db = guarded(prisma)
  const profile = await profileBySlug(db, input.slug)
  const name = cleanText(input.name, 120)
  const email = cleanText(input.email, 200).toLowerCase()
  const phone = cleanText(input.phone, 40)
  if (!name) throw new CommandError('Enter your name.')
  if (!email && !phone) throw new CommandError('Enter an email or a phone number so your tutor can reply.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommandError('Enter a valid email.')
  const recent = await db.inquiry.count({ where: { profileId: profile.id, createdAt: { gt: new Date(Date.now() - 3_600_000) }, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } })
  if (recent >= 3) throw new CommandError('Your message was already sent. Your tutor will reply soon.')
  const q = await db.inquiry.create({ data: { profileId: profile.id, name, email, phone, studentLevel: cleanText(input.studentLevel, 80), subject: cleanText(input.subject, 120), message: cleanText(input.message, 3000), status: 'new' } })
  void notify(prisma, { profileId: profile.id, kind: 'tutor_new_inquiry', to: profile.email, subject: `New message from ${name}`, lines: [`${name} (${[email, phone].filter(Boolean).join(', ')}) asked about tutoring${q.subject ? ` in ${q.subject}` : ''}${q.studentLevel ? ` for ${q.studentLevel}` : ''}.`, q.message], link: `${origin()}/dashboard/platform/inquiries`, linkLabel: 'Open inquiries' })
  return { id: q.id, sent: true }
}

/** S16 by private link. */
export async function publicInvoice(prisma: PrismaClient, id: string, token: string) {
  const db = guarded(prisma)
  const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, publicAccessTokenHash: true, status: true } })
  if (!inv || inv.status === 'draft' || !publicAccessTokenMatches(token, inv.publicAccessTokenHash)) throw new CommandError('This invoice link is not valid.')
  await settleTarget(prisma, 'invoice', inv.id).catch(() => null)
  return invoiceView(prisma, inv.id)
}

async function invoiceView(prisma: PrismaClient, id: string) {
  const db = guarded(prisma)
  const inv = await db.invoice.findUniqueOrThrow({ where: { id }, select: { ...familyInvoiceSelect, profileId: true, family: { select: { guardianName: true } } } })
  const p = await db.tutorProfile.findUniqueOrThrow({ where: { id: inv.profileId } })
  const open = inv.status === 'sent' && inv.paidCents < inv.totalCents
  const card = open && stripeOn() && Boolean(await cardProvider(db, p.id))
  return iso({
    ...inv, profileId: undefined, family: undefined, guardianName: inv.family?.guardianName ?? '', overdue: isOverdue(inv), balanceCents: inv.totalCents - inv.paidCents,
    currencyCode: p.currencyCode, tutor: { businessName: p.businessName, email: p.email, phone: p.phone, slug: p.slug },
    canPayByCard: card, paymentInstructions: open ? p.paymentInstructions : '',
  })
}

export async function payInvoiceByToken(prisma: PrismaClient, id: string, token: string) {
  const db = guarded(prisma)
  const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, publicAccessTokenHash: true } })
  if (!inv || !publicAccessTokenMatches(token, inv.publicAccessTokenHash)) throw new CommandError('This invoice link is not valid.')
  return payInvoiceRow(prisma, inv.id, invoiceLink(inv.id, token))
}

async function payInvoiceRow(prisma: PrismaClient, invoiceId: string, backUrl: string) {
  await settleTarget(prisma, 'invoice', invoiceId).catch(() => null)
  const inv = await guarded(prisma).invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { profile: true, family: { select: { email: true } } } })
  if (inv.status !== 'sent' || inv.paidCents >= inv.totalCents) throw new CommandError('This invoice has nothing left to pay.')
  // Pending card payments already opened for this invoice would double-charge; Stripe expires them, a new one replaces them.
  await guarded(prisma).paymentSession.updateMany({ where: { invoiceId, status: 'pending' }, data: { status: 'cancelled' } })
  return openCheckout(prisma, { profile: inv.profile, target: 'invoice', targetId: inv.id, amountCents: inv.totalCents - inv.paidCents, description: `Invoice ${inv.number} · ${inv.profile.businessName}`, email: inv.family?.email, backUrl })
}

// ---------------- guardian (signed in) ----------------

export async function myFamily(prisma: PrismaClient, session?: Session) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  await releaseUnpaidHolds(prisma, f.profileId).catch(() => null)
  await transaction(prisma, async (tx) => { await lockTutorBooking(tx, f.profileId); await expirePurchases(tx, f.profileId, f.id) }).catch(() => null)
  const now = new Date()
  const [upcoming, purchases, invoices, homework, notes, students, completed, review] = await Promise.all([
    db.session.findMany({ where: { familyId: f.id, status: { in: ['scheduled', 'pending_payment'] }, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, take: 5, select: familySessionSelect }),
    db.packagePurchase.findMany({ where: { familyId: f.id, status: { in: ['active', 'awaiting_payment'] } }, select: { id: true, nameSnapshot: true, minutesRemaining: true, minutesGranted: true, status: true, expiresAt: true }, take: 20 }),
    db.invoice.findMany({ where: { familyId: f.id, status: 'sent' }, select: { id: true, number: true, totalCents: true, paidCents: true, dueAt: true, status: true }, take: 50 }),
    db.homework.findMany({ where: { student: { familyId: f.id }, status: 'assigned' }, orderBy: { dueAt: 'asc' }, take: 10, select: { id: true, title: true, dueAt: true, student: { select: { firstName: true } } } }),
    db.sessionNote.findMany({ where: { session: { familyId: f.id }, sharedAt: { not: null, gt: new Date(now.getTime() - 14 * 86_400_000) } }, orderBy: { sharedAt: 'desc' }, take: 5, select: { workOnNext: true, covered: true, sharedAt: true, session: { select: { id: true, startsAt: true, typeNameSnapshot: true } } } }),
    db.student.findMany({ where: { familyId: f.id }, select: familyStudentSelect, take: 20 }),
    db.session.count({ where: { familyId: f.id, status: 'completed' } }),
    db.review.count({ where: { familyId: f.id } }),
  ])
  const unpaidSessions = await db.session.aggregate({ where: { familyId: f.id, funding: 'card', paymentStatus: 'unpaid', status: { in: ['scheduled', 'completed'] } }, _sum: { priceCents: true } })
  const minutesLeft = purchases.filter((p) => p.status === 'active').reduce((a, p) => a + p.minutesRemaining, 0)
  const shortest = await db.sessionType.findFirst({ where: { profileId: f.profileId, active: true, priceCents: { gt: 0 } }, orderBy: { durationMinutes: 'asc' }, select: { durationMinutes: true } })
  const owing = invoices.reduce((a, i) => a + i.totalCents - i.paidCents, 0) + (unpaidSessions._sum.priceCents ?? 0)
  return iso({
    family: { id: f.id, guardianName: f.guardianName, email: f.email, phone: f.phone, secondContactName: f.secondContactName, secondContactPhone: f.secondContactPhone, address: f.address, timezone: f.timezone, billingMode: f.billingMode, status: f.status, monthlyFeeCents: f.monthlyFeeCents },
    tutor: { slug: f.profile.slug, businessName: f.profile.businessName, tutorName: f.profile.tutorName, photoUrl: f.profile.photoUrl, email: f.profile.email, phone: f.profile.phone, timezone: f.profile.timezone, currencyCode: f.profile.currencyCode, paymentInstructions: f.profile.paymentInstructions, cancellationWindowHours: f.profile.cancellationWindowHours, lateCancelPercent: f.profile.lateCancelPercent, noShowPercent: f.profile.noShowPercent, policiesText: f.profile.policiesText, cardPayments: stripeOn() && Boolean(await cardProvider(db, f.profileId)) },
    upcoming, students, packages: purchases, minutesLeft, lowBalance: purchases.some((p) => p.status === 'active') && minutesLeft < (shortest?.durationMinutes ?? 60),
    owingCents: owing, overdueInvoices: invoices.filter(isOverdue).length, openInvoices: invoices,
    homeworkDue: homework, newNotes: notes,
    canReview: f.profile.reviewsEnabled && completed >= 3 && review === 0,
  })
}

const RANGE = { upcoming: 'upcoming', past: 'past', all: 'all' } as const

export async function mySessions(prisma: PrismaClient, session: Session | undefined, range: string | null | undefined) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const now = new Date()
  const r = RANGE[(range || 'upcoming') as keyof typeof RANGE] ?? 'upcoming'
  const where = r === 'upcoming' ? { endsAt: { gt: now }, status: { in: ['scheduled' as const, 'pending_payment' as const] } } : r === 'past' ? { OR: [{ endsAt: { lte: now } }, { status: { notIn: ['scheduled' as const, 'pending_payment' as const] } }] } : {}
  const rows = await db.session.findMany({ where: { familyId: f.id, ...where }, orderBy: { startsAt: r === 'upcoming' ? 'asc' : 'desc' }, take: 200, select: familySessionSelect })
  return iso({ range: r, timezone: f.timezone || f.profile.timezone, currencyCode: f.profile.currencyCode, sessions: rows })
}

export async function mySession(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const s = await db.session.findFirst({ where: { id, familyId: f.id }, select: { id: true } })
  if (!s) throw new CommandError('Session not found.')
  await settleTarget(prisma, 'session', s.id).catch(() => null)
  await releaseUnpaidHolds(prisma, f.profileId, s.id).catch(() => null)
  return sessionView(prisma, s.id)
}

async function ownSession(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const s = await db.session.findFirst({ where: { id, familyId: f.id }, select: { id: true, profileId: true } })
  if (!s) throw new CommandError('Session not found.')
  return { f, s }
}

/** S10: book as a known family. Every active type is open to them (D4). */
export async function bookSession(prisma: PrismaClient, session: Session | undefined, input: { sessionTypeId: string; startsAt: string; studentIds: string[]; message?: string | null; mode?: string | null }) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  if (!f.profile.bookingOpen) throw new CommandError('Online booking is closed. Contact your tutor.')
  const r = await book(prisma, { profileId: f.profileId, familyId: f.id, sessionTypeId: input.sessionTypeId, studentIds: input.studentIds, startsAt: parseInstant(input.startsAt), actor: 'guardian', message: cleanText(input.message, 1000), mode: input.mode })
  const s = r.session
  let packageLeft: number | null = null
  if (s.funding === 'package') {
    const entry = await db.creditEntry.findFirst({ where: { sessionId: s.id }, select: { purchase: { select: { minutesRemaining: true, nameSnapshot: true } } } })
    packageLeft = entry?.purchase?.minutesRemaining ?? null
  }
  void notify(prisma, { profileId: f.profileId, kind: 'tutor_new_booking', to: f.profile.email, subject: `${f.guardianName} booked ${s.typeNameSnapshot}`, lines: [`${f.guardianName} booked ${s.typeNameSnapshot} for ${fmtWhen(s.startsAt, f.profile.timezone)}.`], link: `${origin()}/dashboard/platform/sessions/${s.id}`, linkLabel: 'Open in your dashboard', sessionId: s.id })
  return { sessionId: s.id, status: s.status, funding: s.funding, needsPayment: s.status === 'pending_payment', holdEndsAt: s.holdEndsAt?.toISOString() ?? null, packageMinutesLeft: packageLeft, priceCents: s.priceCents }
}

export async function cancelMySession(prisma: PrismaClient, session: Session | undefined, id: string, reason?: string | null) {
  const { s } = await ownSession(prisma, session, id)
  const r = await cancelSession(prisma, { sessionId: s.id, by: 'guardian', profileId: s.profileId, reason: cleanText(reason, 300) })
  void afterChange(prisma, s.id, 'cancelled', null)
  return r
}

export async function rescheduleMySession(prisma: PrismaClient, session: Session | undefined, id: string, startsAt: string) {
  const { s } = await ownSession(prisma, session, id)
  const r = await rescheduleSession(prisma, { sessionId: s.id, by: 'guardian', profileId: s.profileId, startsAt: parseInstant(startsAt) })
  void afterChange(prisma, s.id, 'moved', null)
  return r
}

export async function payForSession(prisma: PrismaClient, session: Session | undefined, id: string) {
  const { s } = await ownSession(prisma, session, id)
  return payForSessionRow(prisma, s.id, `${origin()}/account/sessions/${encodeURIComponent(s.id)}`)
}

export async function confirmSessionPayment(prisma: PrismaClient, session: Session | undefined, id: string) {
  const { s } = await ownSession(prisma, session, id)
  const r = await settleTarget(prisma, 'session', s.id)
  return { paid: r.paid || (await guarded(prisma).session.findUniqueOrThrow({ where: { id: s.id }, select: { paymentStatus: true } })).paymentStatus === 'paid' }
}

export async function myStudents(prisma: PrismaClient, session?: Session) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  return iso({ students: await db.student.findMany({ where: { familyId: f.id }, select: familyStudentSelect, orderBy: { createdAt: 'asc' }, take: 50 }) })
}

export async function myHomework(prisma: PrismaClient, session: Session | undefined, status?: string | null) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const st = ['assigned', 'handed_in', 'reviewed'].includes(status || '') ? { status: status as 'assigned' } : {}
  return iso({ homework: await db.homework.findMany({ where: { student: { familyId: f.id }, ...st }, select: familyHomeworkSelect, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], take: 200 }) })
}

export async function myPackages(prisma: PrismaClient, session?: Session) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  for (const p of await db.packagePurchase.findMany({ where: { familyId: f.id, status: 'awaiting_payment' }, select: { id: true }, take: 10 })) await settleTarget(prisma, 'package', p.id).catch(() => null)
  await transaction(prisma, async (tx) => { await lockTutorBooking(tx, f.profileId); await expirePurchases(tx, f.profileId, f.id) }).catch(() => null)
  const [purchases, offered] = await Promise.all([
    db.packagePurchase.findMany({ where: { familyId: f.id, status: { not: 'cancelled' } }, select: { ...familyPurchaseSelect, payments: { select: { id: true, method: true, status: true, amountCents: true, reference: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.package.findMany({ where: { profileId: f.profileId, active: true }, select: { id: true, name: true, description: true, minutes: true, priceCents: true, validMonths: true, appliesTo: { select: { id: true, name: true } } }, orderBy: [{ sortOrder: 'asc' }, { minutes: 'asc' }] }),
  ])
  return iso({ currencyCode: f.profile.currencyCode, cardPayments: stripeOn() && Boolean(await cardProvider(db, f.profileId)), paymentInstructions: f.profile.paymentInstructions, purchases, packages: offered })
}

/** S15: buy a package by card (Checkout) or "pay my tutor directly" (waits for the tutor's confirmation). */
export async function buyPackage(prisma: PrismaClient, session: Session | undefined, packageId: string, method: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  if (!['card', 'direct'].includes(method)) throw new CommandError('Choose card or pay your tutor directly.')
  if (method === 'card' && !(stripeOn() && (await cardProvider(db, f.profileId)))) throw new CommandError('Card payments are not set up. Pay your tutor directly.')
  const purchase = await startPurchase(prisma, f.profileId, f.id, packageId)
  if (method === 'direct') {
    void notify(prisma, { profileId: f.profileId, kind: 'tutor_package_requested', to: f.profile.email, subject: `${f.guardianName} wants ${purchase.nameSnapshot}`, lines: [`${f.guardianName} chose to pay you directly for ${purchase.nameSnapshot}. Confirm the payment when it arrives to make the minutes usable.`], link: `${origin()}/dashboard/platform/families/${f.id}`, linkLabel: 'Open the family' })
    return { purchaseId: purchase.id, status: purchase.status, paymentInstructions: f.profile.paymentInstructions, checkoutUrl: null }
  }
  const checkout = await openCheckout(prisma, { profile: f.profile, target: 'package', targetId: purchase.id, amountCents: purchase.pricePaidCents, description: `${purchase.nameSnapshot} · ${f.profile.businessName}`, email: f.email, backUrl: `${origin()}/account/packages?purchase=${encodeURIComponent(purchase.id)}` })
  return { purchaseId: purchase.id, status: purchase.status, paymentInstructions: '', checkoutUrl: checkout.url }
}

export async function confirmPackagePayment(prisma: PrismaClient, session: Session | undefined, purchaseId: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const p = await db.packagePurchase.findFirst({ where: { id: purchaseId, familyId: f.id }, select: { id: true } })
  if (!p) throw new CommandError('Package not found.')
  await settleTarget(prisma, 'package', p.id)
  const fresh = await db.packagePurchase.findUniqueOrThrow({ where: { id: p.id }, select: { status: true, minutesRemaining: true } })
  return { paid: fresh.status !== 'awaiting_payment' && fresh.status !== 'cancelled', status: fresh.status, minutesRemaining: fresh.minutesRemaining }
}

export async function myInvoices(prisma: PrismaClient, session?: Session) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const rows = await db.invoice.findMany({ where: { familyId: f.id, status: { in: ['sent', 'paid', 'void'] } }, select: { id: true, number: true, status: true, issuedAt: true, dueAt: true, totalCents: true, paidCents: true }, orderBy: { createdAt: 'desc' }, take: 200 })
  return iso({ currencyCode: f.profile.currencyCode, invoices: rows.map((i) => ({ ...i, overdue: isOverdue(i), balanceCents: i.status === 'void' ? 0 : i.totalCents - i.paidCents })) })
}

export async function myInvoice(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const inv = await db.invoice.findFirst({ where: { id, familyId: f.id, status: { in: ['sent', 'paid', 'void'] } }, select: { id: true } })
  if (!inv) throw new CommandError('Invoice not found.')
  await settleTarget(prisma, 'invoice', inv.id).catch(() => null)
  return invoiceView(prisma, inv.id)
}

export async function payInvoice(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const inv = await db.invoice.findFirst({ where: { id, familyId: f.id }, select: { id: true } })
  if (!inv) throw new CommandError('Invoice not found.')
  return payInvoiceRow(prisma, inv.id, `${origin()}/account/invoices/${encodeURIComponent(inv.id)}`)
}

export async function confirmInvoicePayment(prisma: PrismaClient, session: Session | undefined, id: string | null, token?: string | null) {
  const db = guarded(prisma)
  let invoiceId: string
  if (token && id) {
    const inv = await db.invoice.findUnique({ where: { id }, select: { id: true, publicAccessTokenHash: true } })
    if (!inv || !publicAccessTokenMatches(token, inv.publicAccessTokenHash)) throw new CommandError('This invoice link is not valid.')
    invoiceId = inv.id
  } else {
    const f = await requireFamily(db, session)
    const inv = await db.invoice.findFirst({ where: { id: id ?? '', familyId: f.id }, select: { id: true } })
    if (!inv) throw new CommandError('Invoice not found.')
    invoiceId = inv.id
  }
  await settleTarget(prisma, 'invoice', invoiceId)
  const fresh = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true, paidCents: true, totalCents: true } })
  return { paid: fresh.status === 'paid', status: fresh.status, balanceCents: fresh.totalCents - fresh.paidCents }
}

/** S17: report a payment made outside (bank, mobile money) with a reference. Target is `session`, `package` or `invoice`. */
export async function reportPayment(prisma: PrismaClient, session: Session | undefined, input: { target: string; targetId: string; amountCents: number; method: string; reference: string }) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  if (!['session', 'package', 'invoice'].includes(input.target)) throw new CommandError('Choose what the payment is for.')
  const r = await reportOffline(prisma, f.profileId, f.id, { target: { kind: input.target as 'invoice', id: input.targetId }, amountCents: input.amountCents, method: input.method, reference: input.reference })
  void notify(prisma, { profileId: f.profileId, kind: 'tutor_payment_reported', to: f.profile.email, subject: `${f.guardianName} reported a payment`, lines: [`${f.guardianName} says they paid ${(input.amountCents / 100).toFixed(2)} ${f.profile.currencyCode} by ${input.method.replace('_', ' ')} (reference ${cleanText(input.reference, 120)}). Confirm it when you see the money.`], link: `${origin()}/dashboard/platform/billing`, linkLabel: 'Open billing' })
  return r
}

export async function myResources(prisma: PrismaClient, session?: Session) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const ids = (await db.student.findMany({ where: { familyId: f.id, status: 'active' }, select: { id: true } })).map((s) => s.id)
  const rows = await db.resource.findMany({ where: { profileId: f.profileId, OR: [{ students: { some: { id: { in: ids } } } }, { students: { none: {} } }] }, select: { id: true, title: true, linkUrl: true, file_filename: true, file_filesize: true, note: true, createdAt: true, students: { where: { familyId: f.id }, select: { id: true, firstName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })
  return iso({ resources: rows.map((r) => ({ ...r, fileUrl: r.file_filename ? `/api/files/resource/${r.id}` : null, file_filename: undefined })) })
}

export async function myProgress(prisma: PrismaClient, session: Session | undefined, studentId: string) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const student = await db.student.findFirst({ where: { id: studentId, familyId: f.id }, select: familyStudentSelect })
  if (!student) throw new CommandError('Student not found.')
  const [marks, notes, homework] = await Promise.all([
    db.progressMark.findMany({ where: { studentId: student.id }, select: { id: true, label: true, takenOn: true, score: true, outOf: true, note: true }, orderBy: { takenOn: 'asc' }, take: 300 }),
    db.sessionNote.findMany({ where: { session: { students: { some: { id: student.id } } }, sharedAt: { not: null } }, select: { covered: true, wentWell: true, workOnNext: true, effort: true, sharedAt: true, session: { select: { id: true, startsAt: true, typeNameSnapshot: true } } }, orderBy: { sharedAt: 'desc' }, take: 100 }),
    db.homework.findMany({ where: { studentId: student.id }, select: familyHomeworkSelect, orderBy: { createdAt: 'desc' }, take: 100 }),
  ])
  return iso({ student, marks: marks.map((m) => ({ ...m, percent: Math.round((m.score / m.outOf) * 100) })), notes, homework })
}

export async function myCalendarFeedUrl(prisma: PrismaClient, session?: Session) {
  const db = guarded(prisma)
  const f = await requireFamily(db, session)
  const { calendarFeedToken } = await import('./family')
  const token = await calendarFeedToken(db, { kind: 'family', id: f.id })
  return { url: `${origin()}/api/calendar/${token}.ics`, webcalUrl: `${origin().replace(/^https?/, 'webcal')}/api/calendar/${token}.ics` }
}

/** Days with at least one open time in a range (for a month picker), as the viewer sees them. */
export async function publicOpenDays(prisma: PrismaClient, input: { slug: string; sessionTypeId: string; from: string; days?: number | null; timezone?: string | null }) {
  const db = guarded(prisma)
  const profile = await profileBySlug(db, input.slug)
  if (!profile.bookingOpen) return { days: [] as string[] }
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: profile.id, active: true } })
  if (!type) throw new CommandError('Choose a kind of session.')
  const n = Math.max(1, Math.min(42, Math.floor(input.days ?? 14)))
  const start = input.from || businessDateKey(new Date(), input.timezone || profile.timezone)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i)
    if ((await slotsForDay(db, profile, type, d, input.timezone)).length) out.push(d)
  }
  return { days: out }
}
