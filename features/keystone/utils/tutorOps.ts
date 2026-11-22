import type { PrismaClient, TutorProfile } from '@prisma/client'

import type { Session } from '../access'
import { trustedOrigin } from '../../shared/trusted-origin'
import { addDays, businessDateKey, businessDayRange, isDateKey } from './availability'
import * as billing from './billing'
import { book, cancelFutureSeriesSessions, cancelSession, completeInLock, excuseSession as excuse, markNoShow as noShow, releaseUnpaidHolds, reopenSession as reopen, rescheduleSession, topUpAllSeries, topUpSeries } from './booking'
import { CommandError, cleanText, cleanUrl, guarded, lockTutorBooking, parseInstant, requireTutor, transaction, type Db } from './business'
import { calendarFeedToken, inviteFamily as invite } from './family'
import { adjustMinutes as adjust, checkPurchase, expirePurchases } from './ledger'
import { mailConfigured, notify } from './notify'
import { cardProvider, refundPaymentRow, settleTarget, stripeOn } from './payments'
import { isOverdue, iso } from './views'
import { setUpMyBusiness as setup, type SetupInput } from './setup'
import { bookingLink, invoiceLink } from './publicOps'

/**
 * §5.7 tutor operations. Each one resolves the tutor's own profile from the
 * session with the role flag it needs, and filters every read by that profile.
 */

const origin = () => trustedOrigin()
const fmt = (d: Date, tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(d)

export async function setUpMyBusiness(prisma: PrismaClient, session: Session | undefined, input: SetupInput) {
  if (!session?.itemId) throw new CommandError('Sign in first.')
  if (!session.data.role?.canManageBusiness) throw new CommandError('Your role does not allow this.')
  return setup(prisma, session.itemId, input)
}

/** What the dashboard needs before anything else: is the business set up. */
export async function myBusiness(prisma: PrismaClient, session: Session | undefined) {
  if (!session?.itemId) throw new CommandError('Sign in first.')
  const p = await guarded(prisma).tutorProfile.findFirst({ where: { ownerId: session.itemId } })
  if (!p) return { setUp: false, profile: null, stripe: stripeOn(), mail: mailConfigured() }
  const provider = await cardProvider(guarded(prisma), p.id)
  return iso({ setUp: true, profile: { id: p.id, slug: p.slug, businessName: p.businessName, timezone: p.timezone, currencyCode: p.currencyCode, bookingOpen: p.bookingOpen }, stripe: Boolean(provider), mail: mailConfigured(), pageUrl: `${origin()}/t/${p.slug}` })
}

/** D16: the work there is no job runner for, run when the dashboard is read. */
async function housekeeping(prisma: PrismaClient, profileId: string) {
  await releaseUnpaidHolds(prisma, profileId).catch((e) => console.error('[tutor] holds', e instanceof Error ? e.message : e))
  await topUpAllSeries(prisma, profileId).catch((e) => console.error('[tutor] series', e instanceof Error ? e.message : e))
  await transaction(prisma, async (tx) => { await lockTutorBooking(tx, profileId); await expirePurchases(tx, profileId) }).catch((e) => console.error('[tutor] expiry', e instanceof Error ? e.message : e))
}

const tutorSessionSelect = {
  id: true, startsAt: true, endsAt: true, mode: true, meetingUrl: true, status: true, funding: true, paymentStatus: true, typeNameSnapshot: true, priceCents: true, holdEndsAt: true, source: true, seriesId: true,
  family: { select: { id: true, guardianName: true, phone: true, email: true } },
  students: { select: { id: true, firstName: true, lastName: true, level: true, meetingUrl: true } },
} as const

/** P2/P8: Today and the attention list. */
export async function today(prisma: PrismaClient, session: Session | undefined) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  await housekeeping(prisma, p.id)
  const { start, end } = businessDayRange(businessDateKey(new Date(), p.timezone), p.timezone)
  const now = new Date()
  const [sessions, unclosed, reported, invoices, inquiries, reviews, handedIn, series, purchases] = await Promise.all([
    db.session.findMany({ where: { profileId: p.id, startsAt: { gte: start, lt: end }, status: { in: ['scheduled', 'pending_payment', 'completed', 'no_show'] } }, orderBy: { startsAt: 'asc' }, select: tutorSessionSelect, take: 100 }),
    db.session.findMany({ where: { profileId: p.id, status: 'scheduled', endsAt: { lt: start } }, orderBy: { startsAt: 'desc' }, select: tutorSessionSelect, take: 50 }),
    db.payment.findMany({ where: { profileId: p.id, status: 'reported' }, select: { id: true, kind: true, method: true, amountCents: true, reference: true, paidAt: true, family: { select: { id: true, guardianName: true } }, invoiceId: true, purchaseId: true, sessionId: true }, take: 50 }),
    db.invoice.findMany({ where: { profileId: p.id, status: 'sent' }, select: { id: true, number: true, dueAt: true, totalCents: true, paidCents: true, status: true, family: { select: { id: true, guardianName: true } } }, take: 200 }),
    db.inquiry.findMany({ where: { profileId: p.id, status: 'new' }, select: { id: true, name: true, subject: true, studentLevel: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.review.count({ where: { profileId: p.id, status: 'pending' } }),
    db.homework.findMany({ where: { profileId: p.id, status: 'handed_in' }, select: { id: true, title: true, handedInAt: true, student: { select: { id: true, firstName: true } } }, take: 50 }),
    db.recurringSeries.findMany({ where: { profileId: p.id, status: 'active', NOT: { skippedDates: '' } }, select: { id: true, skippedDates: true, family: { select: { guardianName: true } } }, take: 50 }),
    db.packagePurchase.findMany({ where: { profileId: p.id, status: 'active' }, select: { id: true, minutesRemaining: true, nameSnapshot: true, family: { select: { id: true, guardianName: true } } }, take: 300 }),
  ])
  // Last "work on next" and homework due for each student seen today.
  const studentIds = [...new Set(sessions.flatMap((s) => s.students.map((x) => x.id)))]
  const [lastNotes, due] = await Promise.all([
    Promise.all(studentIds.map((id) => db.sessionNote.findFirst({ where: { session: { students: { some: { id } }, status: 'completed' } }, orderBy: { createdAt: 'desc' }, select: { workOnNext: true, createdAt: true } }).then((n) => [id, n] as const))),
    db.homework.findMany({ where: { studentId: { in: studentIds }, status: { in: ['assigned', 'handed_in'] } }, select: { id: true, title: true, dueAt: true, status: true, studentId: true }, take: 200 }),
  ])
  const notes = Object.fromEntries(lastNotes)
  const shortest = await db.sessionType.findFirst({ where: { profileId: p.id, active: true, priceCents: { gt: 0 } }, orderBy: { durationMinutes: 'asc' }, select: { durationMinutes: true } })
  const byFamily = new Map<string, { familyId: string; guardianName: string; minutes: number }>()
  for (const x of purchases) if (x.family) { const e = byFamily.get(x.family.id) ?? { familyId: x.family.id, guardianName: x.family.guardianName, minutes: 0 }; e.minutes += x.minutesRemaining; byFamily.set(x.family.id, e) }
  const link = (s: (typeof sessions)[number]) => s.mode === 'online' ? (s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || p.defaultMeetingUrl) : ''
  return iso({
    date: businessDateKey(now, p.timezone), timezone: p.timezone, currencyCode: p.currencyCode,
    sessions: sessions.map((s) => ({ ...s, joinUrl: link(s), students: s.students.map((x) => ({ ...x, lastWorkOnNext: notes[x.id]?.workOnNext ?? '', homework: due.filter((h) => h.studentId === x.id) })) })),
    attention: {
      sessionsNotClosed: unclosed,
      reportedPayments: reported,
      overdueInvoices: invoices.filter(isOverdue),
      lowBalances: [...byFamily.values()].filter((f) => f.minutes < (shortest?.durationMinutes ?? 60)),
      newInquiries: inquiries,
      reviewsToApprove: reviews,
      homeworkHandedIn: handedIn,
      seriesNeedingTime: series.map((s) => ({ id: s.id, guardianName: s.family?.guardianName ?? '', dates: s.skippedDates.split('\n').filter((d) => d >= businessDateKey(now, p.timezone)) })).filter((s) => s.dates.length),
    },
    setup: { stripe: stripeOn(), mail: mailConfigured(), bookingOpen: p.bookingOpen, hasHours: (await db.weeklyHours.count({ where: { profileId: p.id, isWorking: true } })) > 0, hasTypes: (await db.sessionType.count({ where: { profileId: p.id, active: true } })) > 0, meetingUrl: Boolean(p.defaultMeetingUrl), pageUrl: `${origin()}/t/${p.slug}` },
  })
}

/** P9/P12: the week (or any range up to 62 days): sessions, time off, open hours, series weeks that need a time. */
export async function calendar(prisma: PrismaClient, session: Session | undefined, input: { from: string; to: string }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  if (!isDateKey(input.from) || !isDateKey(input.to) || input.to < input.from || addDays(input.from, 62) < input.to) throw new CommandError('Choose a date range of up to 62 days.')
  await housekeeping(prisma, p.id)
  const start = businessDayRange(input.from, p.timezone).start
  const end = businessDayRange(input.to, p.timezone).end
  const [sessions, off, hours, series] = await Promise.all([
    db.session.findMany({ where: { profileId: p.id, startsAt: { lt: end }, endsAt: { gt: start }, status: { notIn: ['released'] } }, orderBy: { startsAt: 'asc' }, select: tutorSessionSelect, take: 1000 }),
    db.timeOff.findMany({ where: { profileId: p.id, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true, startsAt: true, endsAt: true, reason: true }, take: 200 }),
    db.weeklyHours.findMany({ where: { profileId: p.id }, select: { dayOfWeek: true, isWorking: true, startMinute: true, endMinute: true, breakStartMinute: true, breakEndMinute: true } }),
    db.recurringSeries.findMany({ where: { profileId: p.id, status: { in: ['active', 'paused'] } }, select: { id: true, status: true, dayOfWeek: true, startMinute: true, startsOn: true, endsOn: true, skippedDates: true, mode: true, family: { select: { id: true, guardianName: true } }, sessionType: { select: { id: true, name: true, durationMinutes: true } }, students: { select: { id: true, firstName: true } } }, take: 200 }),
  ])
  // P12: booked sessions inside time off, for the tutor to cancel or move.
  const clashes = sessions.filter((s) => ['scheduled', 'pending_payment'].includes(s.status) && off.some((o) => s.startsAt < o.endsAt && o.startsAt < s.endsAt)).map((s) => s.id)
  return iso({ from: input.from, to: input.to, timezone: p.timezone, sessions, timeOff: off, hours, series, insideTimeOff: clashes })
}

const ownFamily = async (db: Db, p: TutorProfile, id: string) => {
  const f = await db.family.findFirst({ where: { id, profileId: p.id } })
  if (!f) throw new CommandError('Choose a family.')
  return f
}

/** P10: a session by hand for any family. Any time that does not clash; the family's billing mode decides funding. */
export async function createSessionAsTutor(prisma: PrismaClient, session: Session | undefined, input: { familyId: string; sessionTypeId: string; startsAt: string; studentIds: string[]; mode?: string | null; meetingUrl?: string | null; notify?: boolean | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  await ownFamily(db, p, input.familyId)
  const r = await book(prisma, { profileId: p.id, familyId: input.familyId, sessionTypeId: input.sessionTypeId, studentIds: input.studentIds, startsAt: parseInstant(input.startsAt), actor: 'tutor', mode: input.mode })
  if (input.meetingUrl) await db.session.update({ where: { id: r.session.id }, data: { meetingUrl: cleanUrl(input.meetingUrl) } })
  const link = bookingLink(r.session.id, r.token)
  if (input.notify !== false) {
    const f = await db.family.findUniqueOrThrow({ where: { id: input.familyId }, select: { email: true, guardianName: true, timezone: true } })
    void notify(prisma, { profileId: p.id, kind: 'booking_confirmed', to: f.email, subject: `Booked: ${r.session.typeNameSnapshot}`, lines: [`Hi ${f.guardianName},`, `${r.session.typeNameSnapshot} is booked for ${fmt(r.session.startsAt, f.timezone || p.timezone)}.`], link, linkLabel: 'Open the booking', replyTo: p.email, sessionId: r.session.id })
  }
  return { sessionId: r.session.id, status: r.session.status, funding: r.session.funding, bookingUrl: link }
}

type HomeworkInput = { title: string; instructions?: string | null; dueAt?: string | null; linkUrl?: string | null; studentId?: string | null }

/** P3: complete with the note and homework in one form; "share" publishes the note to the family. */
export async function completeSession(prisma: PrismaClient, session: Session | undefined, input: { sessionId: string; note?: { covered?: string | null; wentWell?: string | null; workOnNext?: string | null; effort?: number | null; privateNote?: string | null } | null; homework?: HomeworkInput[] | null; share?: boolean | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const effort = input.note?.effort == null ? null : Math.floor(Number(input.note.effort))
  if (effort !== null && !(effort >= 1 && effort <= 5)) throw new CommandError('Effort is 1 to 5.')
  const hw = (input.homework ?? []).map((h) => ({ title: cleanText(h.title, 200), instructions: cleanText(h.instructions, 3000), dueAt: h.dueAt ? parseInstant(h.dueAt, 'Choose a due date.') : null, linkUrl: cleanUrl(h.linkUrl), studentId: h.studentId || null })).filter((h) => h.title)
  const share = input.share !== false
  const done = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, p.id)
    const s = await completeInLock(tx, input.sessionId, p.id)
    const students = await tx.student.findMany({ where: { sessions: { some: { id: s.id } } }, select: { id: true } })
    const n = input.note ?? {}
    await tx.sessionNote.create({ data: { profileId: p.id, sessionId: s.id, covered: cleanText(n.covered, 5000), wentWell: cleanText(n.wentWell, 5000), workOnNext: cleanText(n.workOnNext, 5000), effort, privateNote: cleanText(n.privateNote, 5000), sharedAt: share ? new Date() : null } })
    for (const h of hw) {
      const targets = h.studentId ? students.filter((x) => x.id === h.studentId) : students
      if (h.studentId && !targets.length) throw new CommandError('Homework must be for a student in this session.')
      for (const t of targets) await tx.homework.create({ data: { profileId: p.id, sessionId: s.id, studentId: t.id, title: h.title, instructions: h.instructions, dueAt: h.dueAt, linkUrl: h.linkUrl } })
    }
    return s
  })
  if (share) {
    const f = done.familyId ? await db.family.findUnique({ where: { id: done.familyId }, select: { email: true, guardianName: true } }) : null
    void notify(prisma, { profileId: p.id, kind: 'note_shared', to: f?.email, subject: `Notes from today’s ${done.typeNameSnapshot}`, lines: [`Hi ${f?.guardianName ?? ''},`, input.note?.covered ? `We covered: ${input.note.covered}` : 'Your tutor shared notes from the session.', input.note?.workOnNext ? `To work on next: ${input.note.workOnNext}` : '', hw.length ? `Homework set: ${hw.map((h) => h.title).join(', ')}` : ''].filter(Boolean), link: `${origin()}/account/sessions/${done.id}`, linkLabel: 'Read the notes', replyTo: p.email, sessionId: done.id })
  }
  return { sessionId: done.id, status: 'completed', homework: hw.length, shared: share }
}

/** Edit or share a note after completing (P22). */
export async function saveSessionNote(prisma: PrismaClient, session: Session | undefined, input: { sessionId: string; covered?: string | null; wentWell?: string | null; workOnNext?: string | null; effort?: number | null; privateNote?: string | null; share?: boolean | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const s = await db.session.findFirst({ where: { id: input.sessionId, profileId: p.id }, select: { id: true, status: true, note: { select: { id: true, sharedAt: true } } } })
  if (!s) throw new CommandError('Session not found.')
  const data = { covered: cleanText(input.covered, 5000), wentWell: cleanText(input.wentWell, 5000), workOnNext: cleanText(input.workOnNext, 5000), effort: input.effort == null ? null : Math.max(1, Math.min(5, Math.floor(input.effort))), privateNote: cleanText(input.privateNote, 5000), ...(input.share && !s.note?.sharedAt ? { sharedAt: new Date() } : {}) }
  if (s.note) await db.sessionNote.update({ where: { id: s.note.id }, data })
  else await db.sessionNote.create({ data: { ...data, profileId: p.id, sessionId: s.id } })
  return { sessionId: s.id }
}

export async function markNoShow(prisma: PrismaClient, session: Session | undefined, sessionId: string) {
  const p = await requireTutor(guarded(prisma), session, 'canManageSessions')
  return noShow(prisma, sessionId, p.id)
}

export async function cancelSessionAsTutor(prisma: PrismaClient, session: Session | undefined, sessionId: string, reason?: string | null, tell?: boolean | null) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const r = await cancelSession(prisma, { sessionId, by: 'tutor', profileId: p.id, reason: cleanText(reason, 300) || 'Cancelled by your tutor' })
  if (tell !== false) {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, select: { startsAt: true, typeNameSnapshot: true, family: { select: { email: true, guardianName: true, timezone: true } } } })
    void notify(prisma, { profileId: p.id, kind: 'session_cancelled', to: s.family?.email, subject: 'Session cancelled', lines: [`Hi ${s.family?.guardianName ?? ''},`, `${s.typeNameSnapshot} on ${fmt(s.startsAt, s.family?.timezone || p.timezone)} is cancelled. You are not charged.`, reason ? `Reason: ${reason}` : ''].filter(Boolean), link: `${origin()}/account/sessions/${sessionId}`, linkLabel: 'Open the session', replyTo: p.email, sessionId })
  }
  return r
}

export async function rescheduleSessionAsTutor(prisma: PrismaClient, session: Session | undefined, sessionId: string, startsAt: string, tell?: boolean | null) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const r = await rescheduleSession(prisma, { sessionId, by: 'tutor', profileId: p.id, startsAt: parseInstant(startsAt) })
  if (tell !== false) {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, select: { startsAt: true, typeNameSnapshot: true, family: { select: { email: true, guardianName: true, timezone: true } } } })
    void notify(prisma, { profileId: p.id, kind: 'session_moved', to: s.family?.email, subject: 'Session moved', lines: [`Hi ${s.family?.guardianName ?? ''},`, `${s.typeNameSnapshot} is now on ${fmt(s.startsAt, s.family?.timezone || p.timezone)}.`], link: `${origin()}/account/sessions/${sessionId}`, linkLabel: 'Open the session', replyTo: p.email, sessionId })
  }
  return r
}

export async function excuseSession(prisma: PrismaClient, session: Session | undefined, sessionId: string) {
  const p = await requireTutor(guarded(prisma), session, 'canManageSessions')
  return excuse(prisma, sessionId, p.id)
}

export async function reopenSession(prisma: PrismaClient, session: Session | undefined, sessionId: string) {
  const p = await requireTutor(guarded(prisma), session, 'canManageSessions')
  return reopen(prisma, sessionId, p.id)
}

/** P22: everything about one session, including the private note and the money trail. */
export async function tutorSession(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  await settleTarget(prisma, 'session', id).catch(() => null)
  const s = await db.session.findFirst({
    where: { id, profileId: p.id },
    include: {
      family: { select: { id: true, guardianName: true, email: true, phone: true, billingMode: true } },
      students: { select: { id: true, firstName: true, lastName: true, level: true, needs: true, goals: true, meetingUrl: true } },
      note: true, homework: { select: { id: true, title: true, status: true, dueAt: true, student: { select: { firstName: true } } } },
      creditEntries: { select: { id: true, kind: true, minutes: true, heldChange: true, note: true, createdAt: true, purchase: { select: { id: true, nameSnapshot: true } } }, orderBy: { createdAt: 'asc' } },
      payments: { select: { id: true, kind: true, method: true, status: true, amountCents: true, refundedCents: true, reference: true, paidAt: true }, orderBy: { createdAt: 'asc' } },
      paymentSessions: { select: { id: true, status: true, amountCents: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: 'asc' } },
      invoiceLines: { select: { invoice: { select: { id: true, number: true, status: true } } } },
      sessionType: { select: { id: true, name: true, durationMinutes: true } },
    },
  })
  if (!s) throw new CommandError('Session not found.')
  const { publicAccessTokenHash: _h, ...rest } = s
  void _h
  const joinUrl = s.mode === 'online' ? (s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || p.defaultMeetingUrl) : ''
  const now = Date.now()
  return iso({
    ...rest, joinUrl, timezone: p.timezone, currencyCode: p.currencyCode,
    can: {
      complete: s.status === 'scheduled' && s.startsAt.getTime() <= now,
      noShow: s.status === 'scheduled' && s.startsAt.getTime() <= now,
      cancel: ['scheduled', 'pending_payment'].includes(s.status),
      move: ['scheduled', 'pending_payment'].includes(s.status),
      excuse: ['late_cancelled', 'no_show'].includes(s.status) && now - s.startsAt.getTime() <= 30 * 86_400_000,
      reopen: s.status === 'completed' && Boolean(s.completedAt) && now - s.completedAt!.getTime() <= 7 * 86_400_000,
      recordPayment: s.funding === 'card' && s.paymentStatus === 'unpaid' && !['cancelled', 'released', 'excused'].includes(s.status),
    },
  })
}

/** A fresh private booking link for the family (copy to send by text or WhatsApp). */
export async function sessionLink(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const { createPublicAccessToken } = await import('./publicAccessToken')
  const access = createPublicAccessToken()
  const done = await db.session.updateMany({ where: { id, profileId: p.id }, data: { publicAccessTokenHash: access.hash } })
  if (!done.count) throw new CommandError('Session not found.')
  return { url: bookingLink(id, access.token) }
}

// ---------- series (P11) ----------

export async function saveSeries(prisma: PrismaClient, session: Session | undefined, input: { id?: string | null; familyId: string; sessionTypeId: string; studentIds: string[]; dayOfWeek: number; startMinute: number; startsOn: string; endsOn?: string | null; mode?: string | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  await ownFamily(db, p, input.familyId)
  const type = await db.sessionType.findFirst({ where: { id: input.sessionTypeId, profileId: p.id, active: true } })
  if (!type) throw new CommandError('Choose a kind of session.')
  const students = await db.student.count({ where: { id: { in: input.studentIds }, familyId: input.familyId } })
  if (!input.studentIds.length || students !== new Set(input.studentIds).size) throw new CommandError('Choose the family’s students.')
  if (!(Number.isInteger(input.dayOfWeek) && input.dayOfWeek >= 0 && input.dayOfWeek <= 6)) throw new CommandError('Choose a day.')
  if (!(Number.isInteger(input.startMinute) && input.startMinute >= 0 && input.startMinute + type.durationMinutes <= 1440)) throw new CommandError('Choose a start time.')
  if (!isDateKey(input.startsOn)) throw new CommandError('Choose a start date.')
  if (input.endsOn && (!isDateKey(input.endsOn) || input.endsOn < input.startsOn)) throw new CommandError('The end date must be after the start date.')
  const mode = type.mode === 'either' ? (input.mode === 'in_person' ? 'in_person' : 'online') : type.mode === 'in_person' ? 'in_person' : 'online'
  if (input.id) {
    // Changing a series ends the old one (future sessions cancelled, no charge) and starts a new one.
    const old = await db.recurringSeries.findFirst({ where: { id: input.id, profileId: p.id } })
    if (!old) throw new CommandError('Series not found.')
    await db.recurringSeries.updateMany({ where: { id: old.id }, data: { status: 'ended', endsOn: businessDateKey(new Date(), p.timezone) } })
    await cancelFutureSeriesSessions(prisma, old.id, p.id)
  }
  const s = await db.recurringSeries.create({ data: { profileId: p.id, familyId: input.familyId, sessionTypeId: type.id, students: { connect: input.studentIds.map((id) => ({ id })) }, dayOfWeek: input.dayOfWeek, startMinute: input.startMinute, startsOn: input.startsOn, endsOn: input.endsOn ?? '', mode, status: 'active' } })
  const g = await topUpSeries(prisma, p.id, s.id)
  return { seriesId: s.id, ...g }
}

export async function pauseSeries(prisma: PrismaClient, session: Session | undefined, id: string, resume?: boolean | null) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  if (resume) {
    const done = await db.recurringSeries.updateMany({ where: { id, profileId: p.id, status: 'paused' }, data: { status: 'active', generatedThrough: businessDateKey(new Date(), p.timezone) } })
    if (!done.count) throw new CommandError('Only a paused series can be resumed.')
    await topUpSeries(prisma, p.id, id)
    return { id, status: 'active' }
  }
  const done = await db.recurringSeries.updateMany({ where: { id, profileId: p.id, status: 'active' }, data: { status: 'paused' } })
  if (!done.count) throw new CommandError('Only an active series can be paused.')
  const cancelled = await cancelFutureSeriesSessions(prisma, id, p.id)
  return { id, status: 'paused', cancelled }
}

export async function endSeries(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const done = await db.recurringSeries.updateMany({ where: { id, profileId: p.id, status: { in: ['active', 'paused'] } }, data: { status: 'ended', endsOn: businessDateKey(new Date(), p.timezone) } })
  if (!done.count) throw new CommandError('This series has already ended.')
  const cancelled = await cancelFutureSeriesSessions(prisma, id, p.id)
  return { id, status: 'ended', cancelled }
}

/** A skipped week the tutor has placed by hand (or given up on) leaves the "Needs a time" list. */
export async function clearSkippedWeek(prisma: PrismaClient, session: Session | undefined, id: string, date: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const s = await db.recurringSeries.findFirst({ where: { id, profileId: p.id }, select: { skippedDates: true } })
  if (!s) throw new CommandError('Series not found.')
  await db.recurringSeries.update({ where: { id }, data: { skippedDates: s.skippedDates.split('\n').filter((d) => d && d !== date).join('\n') } })
  return { id }
}

// ---------- families, students, inquiries, reviews, homework ----------

/** P14: families with balance owing, minutes left and next session. */
export async function familiesOverview(prisma: PrismaClient, session: Session | undefined, input: { status?: string | null; search?: string | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  const q = cleanText(input.search, 80)
  const families = await db.family.findMany({
    where: { profileId: p.id, ...(input.status ? { status: input.status as never } : {}), ...(q ? { OR: [{ guardianName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { students: { some: { firstName: { contains: q, mode: 'insensitive' } } } }] } : {}) },
    select: { id: true, guardianName: true, email: true, phone: true, status: true, billingMode: true, userId: true, students: { select: { id: true, firstName: true, level: true, status: true } } },
    orderBy: { guardianName: 'asc' }, take: 500,
  })
  const ids = families.map((f) => f.id)
  const now = new Date()
  const [purchases, invoices, unpaid, next] = await Promise.all([
    db.packagePurchase.groupBy({ by: ['familyId'], where: { familyId: { in: ids }, status: 'active' }, _sum: { minutesRemaining: true } }),
    db.invoice.findMany({ where: { familyId: { in: ids }, status: 'sent' }, select: { familyId: true, totalCents: true, paidCents: true, dueAt: true, status: true } }),
    db.session.groupBy({ by: ['familyId'], where: { familyId: { in: ids }, funding: 'card', paymentStatus: 'unpaid', status: { in: ['scheduled', 'completed'] } }, _sum: { priceCents: true } }),
    db.session.findMany({ where: { familyId: { in: ids }, status: 'scheduled', startsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, select: { familyId: true, startsAt: true }, take: 2000 }),
  ])
  return iso({
    currencyCode: p.currencyCode, timezone: p.timezone,
    families: families.map((f) => ({
      ...f, hasAccount: Boolean(f.userId), userId: undefined,
      minutesLeft: purchases.find((x) => x.familyId === f.id)?._sum.minutesRemaining ?? 0,
      owingCents: invoices.filter((i) => i.familyId === f.id).reduce((a, i) => a + i.totalCents - i.paidCents, 0) + (unpaid.find((x) => x.familyId === f.id)?._sum.priceCents ?? 0),
      overdue: invoices.some((i) => i.familyId === f.id && isOverdue(i)),
      nextSession: next.find((s) => s.familyId === f.id)?.startsAt ?? null,
    })),
  })
}

/** P15: a family page. */
export async function tutorFamily(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  await ownFamily(db, p, id)
  await transaction(prisma, async (tx) => { await lockTutorBooking(tx, p.id); await expirePurchases(tx, p.id, id) }).catch(() => null)
  const f = await db.family.findUniqueOrThrow({
    where: { id },
    include: {
      students: { orderBy: { createdAt: 'asc' } },
      sessions: { orderBy: { startsAt: 'desc' }, take: 100, select: { id: true, startsAt: true, status: true, funding: true, paymentStatus: true, typeNameSnapshot: true, priceCents: true, chargedCents: true } },
      purchases: { orderBy: { createdAt: 'desc' }, include: { entries: { orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, kind: true, minutes: true, heldChange: true, note: true, createdAt: true, session: { select: { id: true, startsAt: true } } } } } },
      invoices: { orderBy: { createdAt: 'desc' }, select: { id: true, number: true, status: true, totalCents: true, paidCents: true, dueAt: true, issuedAt: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, kind: true, method: true, status: true, amountCents: true, refundedCents: true, reference: true, paidAt: true, reportedByGuardian: true } },
      series: { where: { status: { in: ['active', 'paused'] } }, select: { id: true, status: true, dayOfWeek: true, startMinute: true, startsOn: true, endsOn: true, skippedDates: true, sessionType: { select: { id: true, name: true } }, students: { select: { id: true, firstName: true } } } },
      inquiries: { select: { id: true, message: true, createdAt: true } },
    },
  })
  const { inviteTokenHash, calendarTokenHash, ...rest } = f
  void calendarTokenHash
  const ledger = await Promise.all(f.purchases.map((x) => checkPurchase(db as never, x.id)))
  return iso({ ...rest, hasAccount: Boolean(f.userId), inviteOpen: Boolean(inviteTokenHash), currencyCode: p.currencyCode, timezone: p.timezone, purchases: f.purchases.map((x, i) => ({ ...x, ledgerOk: ledger[i].ok })), invoices: f.invoices.map((i) => ({ ...i, overdue: isOverdue(i) })) })
}

export async function inviteFamily(prisma: PrismaClient, session: Session | undefined, familyId: string, send?: boolean | null) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  const r = await invite(db, p.id, familyId)
  const url = `${origin()}/account/claim?f=${encodeURIComponent(r.familyId)}&t=${encodeURIComponent(r.token)}`
  let mail: { status: string; error: string } | null = null
  if (send !== false) mail = await notify(prisma, { profileId: p.id, kind: 'invite', to: r.email, subject: `${p.businessName}: set up your family account`, lines: [`Hi ${r.guardianName},`, 'Set a password to see your sessions, notes, homework, packages and invoices in one place.'], link: url, linkLabel: 'Create your account', replyTo: p.email })
  return { url, mail }
}

/** Students on the family page or the student page (P18): tutor fields include `needs`. */
export async function saveStudentAsTutor(prisma: PrismaClient, session: Session | undefined, input: { id?: string | null; familyId: string; firstName: string; lastName?: string | null; level?: string | null; school?: string | null; goals?: string | null; needs?: string | null; meetingUrl?: string | null; birthYear?: number | null; status?: string | null; subjectIds?: string[] | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  await ownFamily(db, p, input.familyId)
  const firstName = cleanText(input.firstName, 80)
  if (!firstName) throw new CommandError('Enter the student’s first name.')
  const subjectIds = input.subjectIds ?? null
  if (subjectIds && (await db.subject.count({ where: { id: { in: subjectIds }, profileId: p.id } })) !== new Set(subjectIds).size) throw new CommandError('Choose your own subjects.')
  const status = ['active', 'paused', 'finished'].includes(input.status || '') ? input.status as 'active' : undefined
  const data = { firstName, lastName: cleanText(input.lastName, 80), level: cleanText(input.level, 80), school: cleanText(input.school, 120), goals: cleanText(input.goals, 2000), needs: cleanText(input.needs, 2000), meetingUrl: cleanUrl(input.meetingUrl), birthYear: input.birthYear ?? null, ...(status ? { status } : {}) }
  if (input.id) {
    const s = await db.student.findFirst({ where: { id: input.id, profileId: p.id, familyId: input.familyId } })
    if (!s) throw new CommandError('Student not found.')
    await db.student.update({ where: { id: s.id }, data: { ...data, ...(subjectIds ? { subjects: { set: subjectIds.map((id) => ({ id })) } } : {}) } })
    return { id: s.id }
  }
  const s = await db.student.create({ data: { ...data, profileId: p.id, familyId: input.familyId, ...(subjectIds ? { subjects: { connect: subjectIds.map((id) => ({ id })) } } : {}) } })
  return { id: s.id }
}

/** P18: a student page with notes history, homework and marks. */
export async function tutorStudent(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  const s = await db.student.findFirst({
    where: { id, profileId: p.id },
    include: {
      family: { select: { id: true, guardianName: true } }, subjects: { select: { id: true, name: true } },
      marks: { orderBy: { takenOn: 'asc' } }, homework: { orderBy: { createdAt: 'desc' }, take: 100 },
      sessions: { orderBy: { startsAt: 'desc' }, take: 100, select: { id: true, startsAt: true, status: true, typeNameSnapshot: true, note: true } },
    },
  })
  if (!s) throw new CommandError('Student not found.')
  return iso({ ...s, timezone: p.timezone })
}

export async function convertInquiry(prisma: PrismaClient, session: Session | undefined, input: { id: string; studentName?: string | null; billingMode?: string | null }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  const r = await transaction(prisma, async (tx) => {
    const q = await tx.inquiry.findFirst({ where: { id: input.id, profileId: p.id } })
    if (!q) throw new CommandError('Inquiry not found.')
    if (q.status === 'converted' || q.status === 'closed') throw new CommandError('This inquiry is already closed.')
    const billingMode = ['pay_as_you_book', 'invoice', 'flat_monthly'].includes(input.billingMode || '') ? input.billingMode as 'invoice' : 'pay_as_you_book'
    let family = await tx.family.findFirst({ where: { profileId: p.id, OR: [...(q.email ? [{ email: { equals: q.email, mode: 'insensitive' as const } }] : []), ...(q.phone ? [{ phone: q.phone }] : [])] } })
    family ??= await tx.family.create({ data: { profileId: p.id, guardianName: q.name, email: q.email, phone: q.phone, status: 'active', billingMode, howTheyFoundMe: 'Message from the page' } })
    const studentName = cleanText(input.studentName, 120)
    if (studentName) {
      const [first, ...rest] = studentName.split(/\s+/)
      await tx.student.create({ data: { profileId: p.id, familyId: family.id, firstName: first, lastName: rest.join(' '), level: q.studentLevel, goals: q.message.slice(0, 1000) } })
    }
    const done = await tx.inquiry.updateMany({ where: { id: q.id, status: { in: ['new', 'contacted'] } }, data: { status: 'converted', familyId: family.id } })
    if (!done.count) throw new CommandError('This inquiry was already handled.')
    return { familyId: family.id }
  })
  const inv = await invite(db, p.id, r.familyId).catch(() => null)
  return { familyId: r.familyId, inviteUrl: inv ? `${origin()}/account/claim?f=${encodeURIComponent(inv.familyId)}&t=${encodeURIComponent(inv.token)}` : null }
}

export async function setInquiryStatus(prisma: PrismaClient, session: Session | undefined, id: string, status: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  const next: Record<string, string[]> = { contacted: ['new'], closed: ['new', 'contacted'], new: ['contacted'] }
  if (!next[status]) throw new CommandError('Choose contacted or closed.')
  const done = await db.inquiry.updateMany({ where: { id, profileId: p.id, status: { in: next[status] as never } }, data: { status: status as never } })
  if (!done.count) throw new CommandError('This inquiry cannot move to that step.')
  return { id, status }
}

export async function reviewHomework(prisma: PrismaClient, session: Session | undefined, id: string, feedback?: string | null) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const done = await db.homework.updateMany({ where: { id, profileId: p.id, status: { in: ['assigned', 'handed_in'] } }, data: { status: 'reviewed', feedback: cleanText(feedback, 3000), reviewedAt: new Date() } })
  if (!done.count) throw new CommandError('This homework is already reviewed.')
  return { id, status: 'reviewed' }
}

/** P20: the homework board. */
export async function homeworkBoard(prisma: PrismaClient, session: Session | undefined) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const rows = await db.homework.findMany({ where: { profileId: p.id, OR: [{ status: { in: ['assigned', 'handed_in'] } }, { reviewedAt: { gt: new Date(Date.now() - 30 * 86_400_000) } }] }, select: { id: true, title: true, instructions: true, dueAt: true, linkUrl: true, file_filename: true, status: true, handedInAt: true, guardianComment: true, handInUrl: true, feedback: true, reviewedAt: true, student: { select: { id: true, firstName: true, family: { select: { guardianName: true } } } } }, orderBy: { dueAt: 'asc' }, take: 500 })
  return iso({ timezone: p.timezone, assigned: rows.filter((r) => r.status === 'assigned'), handedIn: rows.filter((r) => r.status === 'handed_in'), reviewed: rows.filter((r) => r.status === 'reviewed') })
}

export async function moderateReview(prisma: PrismaClient, session: Session | undefined, id: string, status: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageFamilies')
  if (!['published', 'hidden'].includes(status)) throw new CommandError('Choose publish or hide.')
  const done = await db.review.updateMany({ where: { id, profileId: p.id }, data: { status: status as never } })
  if (!done.count) throw new CommandError('Review not found.')
  return { id, status }
}

// ---------- money ----------

const pay = async (prisma: PrismaClient, session: Session | undefined) => requireTutor(guarded(prisma), session, 'canManagePayments')

export async function sellPackage(prisma: PrismaClient, session: Session | undefined, input: { familyId: string; packageId: string; method: string; reference?: string | null }) {
  const p = await pay(prisma, session)
  return billing.sellPackage(prisma, p.id, input)
}
export async function cancelPurchase(prisma: PrismaClient, session: Session | undefined, id: string) {
  const p = await pay(prisma, session)
  return billing.cancelPurchase(prisma, p.id, id)
}
export async function refundPackage(prisma: PrismaClient, session: Session | undefined, id: string) {
  const p = await pay(prisma, session)
  return billing.refundPackage(prisma, p.id, id)
}
export async function adjustMinutes(prisma: PrismaClient, session: Session | undefined, input: { purchaseId: string; minutes: number; reason: string }) {
  const p = await pay(prisma, session)
  return transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, p.id)
    const x = await tx.packagePurchase.findFirst({ where: { id: input.purchaseId, profileId: p.id } })
    if (!x) throw new CommandError('Package not found.')
    await adjust(tx, x, Math.trunc(Number(input.minutes)), cleanText(input.reason, 300))
    return { purchaseId: x.id }
  })
}
export async function confirmPayment(prisma: PrismaClient, session: Session | undefined, id: string) {
  const p = await pay(prisma, session)
  return billing.confirmPayment(prisma, p.id, id)
}
export async function rejectPayment(prisma: PrismaClient, session: Session | undefined, id: string, note?: string | null) {
  const p = await pay(prisma, session)
  return billing.rejectPayment(prisma, p.id, id, note ?? '')
}
export async function recordPayment(prisma: PrismaClient, session: Session | undefined, input: { target: string; targetId: string; amountCents?: number | null; method: string; reference?: string | null }) {
  const p = await pay(prisma, session)
  if (!['session', 'package', 'invoice'].includes(input.target)) throw new CommandError('Choose what the payment is for.')
  return billing.recordPayment(prisma, p.id, { target: { kind: input.target as 'invoice', id: input.targetId }, amountCents: input.amountCents, method: input.method, reference: input.reference })
}
export async function refundPayment(prisma: PrismaClient, session: Session | undefined, id: string, amountCents?: number | null, note?: string | null) {
  const p = await pay(prisma, session)
  const own = await guarded(prisma).payment.count({ where: { id, profileId: p.id } })
  if (!own) throw new CommandError('Payment not found.')
  return refundPaymentRow(prisma, id, amountCents ?? null, cleanText(note, 300) || 'Refunded by your tutor')
}
export async function readyToInvoice(prisma: PrismaClient, session: Session | undefined) {
  const p = await pay(prisma, session)
  return iso({ currencyCode: p.currencyCode, families: await billing.readyToInvoice(guarded(prisma), p.id) })
}
export async function createInvoice(prisma: PrismaClient, session: Session | undefined, input: Parameters<typeof billing.createInvoice>[2]) {
  const p = await pay(prisma, session)
  const r = await billing.createInvoice(prisma, p.id, input)
  return { id: r.id, number: r.number }
}
export async function addInvoiceLine(prisma: PrismaClient, session: Session | undefined, invoiceId: string, line: { description: string; quantity?: number | null; unitCents: number }) {
  const p = await pay(prisma, session)
  return billing.addInvoiceLine(prisma, p.id, invoiceId, { ...line, quantity: line.quantity ?? 1 })
}
export async function removeInvoiceLine(prisma: PrismaClient, session: Session | undefined, lineId: string) {
  const p = await pay(prisma, session)
  return billing.removeInvoiceLine(prisma, p.id, lineId)
}
export async function sendInvoice(prisma: PrismaClient, session: Session | undefined, id: string, send?: boolean | null) {
  const p = await pay(prisma, session)
  const inv = await billing.sendInvoice(prisma, p.id, id)
  const url = invoiceLink(inv.id, inv.token)
  let mail: { status: string; error: string } | null = null
  if (send !== false) {
    const f = inv.familyId ? await guarded(prisma).family.findUnique({ where: { id: inv.familyId }, select: { email: true, guardianName: true } }) : null
    mail = await notify(prisma, { profileId: p.id, kind: 'invoice_sent', to: f?.email, subject: `Invoice ${inv.number} from ${p.businessName}`, lines: [`Hi ${f?.guardianName ?? ''},`, `Invoice ${inv.number} for ${(inv.totalCents / 100).toFixed(2)} ${p.currencyCode} is ready.`], link: url, linkLabel: 'View and pay', replyTo: p.email, invoiceId: inv.id })
  }
  return { id: inv.id, number: inv.number, url, mail }
}
export async function invoiceLinkFor(prisma: PrismaClient, session: Session | undefined, id: string) {
  const p = await pay(prisma, session)
  const { createPublicAccessToken } = await import('./publicAccessToken')
  const access = createPublicAccessToken()
  const done = await guarded(prisma).invoice.updateMany({ where: { id, profileId: p.id, status: { in: ['sent', 'paid'] } }, data: { publicAccessTokenHash: access.hash } })
  if (!done.count) throw new CommandError('Send the invoice first.')
  return { url: invoiceLink(id, access.token) }
}
export async function voidInvoice(prisma: PrismaClient, session: Session | undefined, id: string) {
  const p = await pay(prisma, session)
  return billing.voidInvoice(prisma, p.id, id)
}
export async function tutorInvoice(prisma: PrismaClient, session: Session | undefined, id: string) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canReadPayments' as never).catch(() => requireTutor(db, session, 'canManagePayments'))
  await settleTarget(prisma, 'invoice', id).catch(() => null)
  const inv = await db.invoice.findFirst({ where: { id, profileId: p.id }, include: { family: { select: { id: true, guardianName: true, email: true } }, lines: { orderBy: { sortOrder: 'asc' }, include: { session: { select: { id: true, startsAt: true, status: true } } } }, payments: { orderBy: { createdAt: 'asc' } } } })
  if (!inv) throw new CommandError('Invoice not found.')
  const { publicAccessTokenHash: _h, ...rest } = inv
  void _h
  return iso({ ...rest, overdue: isOverdue(inv), currencyCode: p.currencyCode, timezone: p.timezone })
}

/** P35: earnings over a range. */
export async function myEarnings(prisma: PrismaClient, session: Session | undefined, input: { from: string; to: string }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canViewEarnings')
  const from = new Date(input.from); const to = new Date(input.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new CommandError('Choose a valid date range.')
  const paid = { profileId: p.id, status: { in: ['confirmed' as const, 'refunded' as const, 'partially_refunded' as const] }, paidAt: { gte: from, lt: to } }
  const [ins, refunds, byMethod, payments, taught, sold, prepaid, owed, expenses, expByCat] = await Promise.all([
    db.payment.aggregate({ where: { ...paid, kind: { not: 'refund' } }, _sum: { amountCents: true } }),
    db.payment.aggregate({ where: { profileId: p.id, kind: 'refund', status: 'confirmed', paidAt: { gte: from, lt: to } }, _sum: { amountCents: true } }),
    db.payment.groupBy({ by: ['method'], where: { ...paid, kind: { not: 'refund' } }, _sum: { amountCents: true } }),
    db.payment.findMany({ where: { ...paid, kind: { not: 'refund' } }, select: { amountCents: true, paidAt: true }, take: 10000 }),
    db.session.findMany({ where: { profileId: p.id, status: 'completed', startsAt: { gte: from, lt: to } }, select: { startsAt: true, endsAt: true }, take: 10000 }),
    db.packagePurchase.aggregate({ where: { profileId: p.id, purchasedAt: { gte: from, lt: to }, status: { notIn: ['awaiting_payment', 'cancelled'] } }, _count: { _all: true }, _sum: { pricePaidCents: true } }),
    db.packagePurchase.findMany({ where: { profileId: p.id, status: 'active' }, select: { minutesRemaining: true, minutesGranted: true, pricePaidCents: true } }),
    db.invoice.findMany({ where: { profileId: p.id, status: 'sent' }, select: { totalCents: true, paidCents: true } }),
    db.expense.aggregate({ where: { profileId: p.id, spentOn: { gte: from, lt: to } }, _sum: { amountCents: true } }),
    db.expense.groupBy({ by: ['category'], where: { profileId: p.id, spentOn: { gte: from, lt: to } }, _sum: { amountCents: true } }),
  ])
  const month = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: p.timezone, year: 'numeric', month: '2-digit' }).format(d).slice(0, 7)
  const byMonth: Record<string, number> = {}
  for (const x of payments) if (x.paidAt) byMonth[month(x.paidAt)] = (byMonth[month(x.paidAt)] ?? 0) + x.amountCents
  const inCents = (ins._sum.amountCents ?? 0) - (refunds._sum.amountCents ?? 0)
  const exp = expenses._sum.amountCents ?? 0
  return iso({
    from: from.toISOString(), to: to.toISOString(), currencyCode: p.currencyCode,
    inCents, refundsCents: refunds._sum.amountCents ?? 0,
    byMethod: byMethod.map((r) => ({ method: r.method, cents: r._sum.amountCents ?? 0 })),
    byMonth: Object.entries(byMonth).sort().map(([m, cents]) => ({ month: m, cents })),
    sessionsTaught: taught.length, hoursTaught: Math.round(taught.reduce((a, s) => a + (s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000, 0) * 10) / 10,
    packagesSold: sold._count._all, packagesSoldCents: sold._sum.pricePaidCents ?? 0,
    prepaidMinutes: prepaid.reduce((a, x) => a + x.minutesRemaining, 0),
    prepaidUnearnedCents: prepaid.reduce((a, x) => a + (x.minutesGranted ? Math.floor((x.pricePaidCents * x.minutesRemaining) / x.minutesGranted) : 0), 0),
    outstandingCents: owed.reduce((a, i) => a + i.totalCents - i.paidCents, 0),
    expensesCents: exp, expensesByCategory: expByCat.map((r) => ({ category: r.category, cents: r._sum.amountCents ?? 0 })),
    netCents: inCents - exp,
  })
}

/** P42: what Stripe says, read from the provider (not just whether a key is set). */
export async function paymentSettings(prisma: PrismaClient, session: Session | undefined) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManagePayments')
  let stripe: { connected: boolean; account?: string; mode?: string; error?: string } = { connected: false }
  if (stripeOn()) {
    try {
      const res = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, redirect: 'error' })
      const json = await res.json() as { livemode?: boolean; error?: { message?: string } }
      stripe = res.ok ? { connected: true, mode: json.livemode ? 'live' : 'test keys' } : { connected: false, error: json.error?.message || `Stripe answered ${res.status}` }
      if (res.ok) await cardProvider(db, p.id)
    } catch (e) { stripe = { connected: false, error: e instanceof Error ? e.message : 'Stripe could not be reached' } }
  }
  return { stripe, webhookUrl: `${origin()}/api/payment-webhooks/stripe`, webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET), paymentInstructions: p.paymentInstructions, invoiceDueDays: p.invoiceDueDays, currencyCode: p.currencyCode, mail: mailConfigured() }
}

export async function tutorCalendarFeedUrl(prisma: PrismaClient, session: Session | undefined) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canManageSessions')
  const token = await calendarFeedToken(db, { kind: 'tutor', id: p.id })
  return { url: `${origin()}/api/calendar/${token}.ics`, webcalUrl: `${origin().replace(/^https?/, 'webcal')}/api/calendar/${token}.ics` }
}

/** CSV for the accountant (§7): payments, sessions. */
export async function exportCsv(prisma: PrismaClient, session: Session | undefined, input: { kind: string; from: string; to: string }) {
  const db = guarded(prisma)
  const p = await requireTutor(db, session, 'canViewEarnings')
  const from = new Date(input.from); const to = new Date(input.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new CommandError('Choose a valid date range.')
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  if (input.kind === 'sessions') {
    const rows = await db.session.findMany({ where: { profileId: p.id, startsAt: { gte: from, lt: to } }, select: { startsAt: true, typeNameSnapshot: true, status: true, funding: true, priceCents: true, chargedCents: true, chargedMinutes: true, paymentStatus: true, family: { select: { guardianName: true } } }, orderBy: { startsAt: 'asc' }, take: 20000 })
    return { filename: 'sessions.csv', csv: ['date,family,session,status,funding,price,charged,charged_minutes,payment', ...rows.map((r) => [r.startsAt.toISOString(), r.family?.guardianName, r.typeNameSnapshot, r.status, r.funding, (r.priceCents / 100).toFixed(2), (r.chargedCents / 100).toFixed(2), r.chargedMinutes, r.paymentStatus].map(q).join(','))].join('\n') }
  }
  const rows = await db.payment.findMany({ where: { profileId: p.id, paidAt: { gte: from, lt: to } }, select: { paidAt: true, kind: true, method: true, status: true, amountCents: true, refundedCents: true, reference: true, family: { select: { guardianName: true } } }, orderBy: { paidAt: 'asc' }, take: 20000 })
  return { filename: 'payments.csv', csv: ['date,family,kind,method,status,amount,refunded,reference', ...rows.map((r) => [r.paidAt?.toISOString(), r.family?.guardianName, r.kind, r.method, r.status, (r.amountCents / 100).toFixed(2), (r.refundedCents / 100).toFixed(2), r.reference].map(q).join(','))].join('\n') }
}

export { cleanUrl }
