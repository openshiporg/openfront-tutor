import type { PrismaClient } from '@prisma/client'

import type { Session } from '../access'
import { CommandError, cleanEmail, cleanText, cleanUrl, guarded, lockFamily, transaction, validTimeZone, type Db } from './business'
import { createPublicAccessToken, hashPublicAccessToken, publicAccessTokenMatches } from './publicAccessToken'

/**
 * The guardian side. Every operation resolves the family from the signed-in
 * user (or a private token) and filters every read by that family id, so one
 * family can never reach another's records by id (§9.15).
 */

export async function requireFamily(db: Db, session: Session | undefined) {
  if (!session?.itemId) throw new CommandError('Sign in to your family account.')
  const family = await db.family.findFirst({ where: { userId: session.itemId }, include: { profile: true } })
  if (!family) throw new CommandError('This account is not linked to a family. Use the link your tutor sent you.')
  return family
}

/** A visitor's details become (or match) a family and one student. Runs inside the booking lock. */
export async function familyForVisitor(tx: Db, profileId: string, input: { guardianName: string; email: string; phone: string; studentName: string; studentLevel: string; timezone?: string | null; needs?: string }) {
  const email = input.email
  const phone = input.phone
  let family = await tx.family.findFirst({ where: { profileId, OR: [...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []), ...(phone ? [{ phone }] : [])] } })
  if (family?.status === 'blocked') throw new CommandError('This time can’t be booked online. Contact your tutor.')
  family ??= await tx.family.create({ data: { profileId, guardianName: input.guardianName, email, phone, timezone: input.timezone || '', status: 'lead' } })
  const [first, ...rest] = input.studentName.split(/\s+/)
  let student = await tx.student.findFirst({ where: { familyId: family.id, firstName: { equals: first, mode: 'insensitive' } } })
  student ??= await tx.student.create({ data: { profileId, familyId: family.id, firstName: first, lastName: rest.join(' '), level: input.studentLevel, goals: input.needs ?? '' } })
  return { family, student }
}

export function cleanVisitor(input: { guardianName?: unknown; email?: unknown; phone?: unknown; studentName?: unknown; studentLevel?: unknown; needs?: unknown }) {
  const guardianName = cleanText(input.guardianName, 120)
  const email = cleanEmail(input.email)
  const phone = cleanText(input.phone, 40)
  const studentName = cleanText(input.studentName, 120)
  if (!guardianName) throw new CommandError('Enter your name.')
  if (!email && !phone) throw new CommandError('Enter an email or a phone number so your tutor can reach you.')
  if (!studentName) throw new CommandError('Enter the student’s name.')
  return { guardianName, email, phone, studentName, studentLevel: cleanText(input.studentLevel, 80), needs: cleanText(input.needs, 1000) }
}

/** Tutor: a private invite link for a family (a new one replaces the old). */
export async function inviteFamily(db: Db, profileId: string, familyId: string) {
  const family = await db.family.findFirst({ where: { id: familyId, profileId }, select: { id: true, userId: true, email: true, guardianName: true } })
  if (!family) throw new CommandError('Choose a family.')
  if (family.userId) throw new CommandError('This family already has an account. They can reset their password from the sign-in page.')
  const access = createPublicAccessToken()
  await db.family.update({ where: { id: family.id }, data: { inviteTokenHash: access.hash } })
  return { familyId: family.id, token: access.token, email: family.email, guardianName: family.guardianName }
}

type SudoCtx = { sudo(): { db: { User: { createOne(a: { data: Record<string, unknown> }): Promise<{ id: string }> }; Role: { findMany(a: unknown): Promise<Array<{ id: string }>>; createOne(a: unknown): Promise<{ id: string }> } } } }

/**
 * Turns a booking link or an invite into a family account (D3, S7). The role
 * is always `Family`; the password is hashed by Keystone's own password field
 * (Keystone `db` API, sudo because the visitor is not signed in yet: the
 * token is the authority, checked first).
 */
export async function claimFamilyAccount(prisma: PrismaClient, context: SudoCtx, input: { familyId?: string | null; token?: string | null; bookingId?: string | null; bookingToken?: string | null; email?: string | null; password: string; name?: string | null }) {
  const db = guarded(prisma)
  let familyId: string | null = null
  if (input.familyId && input.token) {
    const f = await db.family.findUnique({ where: { id: input.familyId }, select: { id: true, inviteTokenHash: true } })
    if (f && publicAccessTokenMatches(input.token, f.inviteTokenHash)) familyId = f.id
  } else if (input.bookingId && input.bookingToken) {
    const s = await db.session.findUnique({ where: { id: input.bookingId }, select: { familyId: true, publicAccessTokenHash: true } })
    if (s && publicAccessTokenMatches(input.bookingToken, s.publicAccessTokenHash)) familyId = s.familyId
  }
  if (!familyId) throw new CommandError('This link is not valid. Ask your tutor for a new invite.')
  const password = String(input.password || '')
  if (password.length < 8) throw new CommandError('Choose a password of at least 8 characters.')
  const { FAMILY_ROLE } = await import('../access')
  return transaction(prisma, async (tx) => {
    await lockFamily(tx, familyId!)
    const family = await tx.family.findUniqueOrThrow({ where: { id: familyId! } })
    if (family.userId) throw new CommandError('This family already has an account. Sign in, or reset your password.')
    if (family.status === 'blocked') throw new CommandError('Contact your tutor.')
    const email = cleanEmail(input.email || family.email)
    if (!email) throw new CommandError('Enter your email. You sign in with it.')
    if (await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) throw new CommandError('An account with this email already exists. Sign in instead.')
    const sudo = context.sudo()
    const role = (await sudo.db.Role.findMany({ where: { name: { equals: FAMILY_ROLE.name } }, take: 1 }))[0] ?? (await sudo.db.Role.createOne({ data: { ...FAMILY_ROLE } }))
    // The User row is written by Keystone (password hashing) outside this Prisma transaction; the family lock above
    // keeps two claims of one family apart, and the link below is guarded on `userId: null`.
    const user = await sudo.db.User.createOne({ data: { name: cleanText(input.name, 120) || family.guardianName, email, password, role: { connect: { id: role.id } }, onboardingStatus: 'done' } })
    const linked = await tx.family.updateMany({ where: { id: family.id, userId: null }, data: { userId: user.id, inviteTokenHash: '', email, status: family.status === 'lead' ? 'active' : family.status } })
    if (!linked.count) throw new CommandError('This family already has an account.')
    return { email }
  })
}

export async function updateMyContact(db: Db, familyId: string, input: { guardianName?: unknown; phone?: unknown; secondContactName?: unknown; secondContactPhone?: unknown; address?: unknown; timezone?: unknown }) {
  const data: Record<string, string> = {}
  if (input.guardianName !== undefined) { data.guardianName = cleanText(input.guardianName, 120); if (!data.guardianName) throw new CommandError('Enter your name.') }
  if (input.phone !== undefined) data.phone = cleanText(input.phone, 40)
  if (input.secondContactName !== undefined) data.secondContactName = cleanText(input.secondContactName, 120)
  if (input.secondContactPhone !== undefined) data.secondContactPhone = cleanText(input.secondContactPhone, 40)
  if (input.address !== undefined) data.address = cleanText(input.address, 500)
  if (input.timezone !== undefined) data.timezone = validTimeZone(input.timezone)
  await db.family.update({ where: { id: familyId }, data })
  return { saved: true }
}

export async function saveStudent(db: Db, family: { id: string; profileId: string }, input: { id?: string | null; firstName?: unknown; lastName?: unknown; level?: unknown; school?: unknown; goals?: unknown; birthYear?: unknown }) {
  const firstName = cleanText(input.firstName, 80)
  if (!firstName) throw new CommandError('Enter the student’s first name.')
  const birth = input.birthYear == null || input.birthYear === '' ? null : Number(input.birthYear)
  if (birth !== null && (!Number.isInteger(birth) || birth < 1900 || birth > 2100)) throw new CommandError('Enter a valid birth year.')
  const data = { firstName, lastName: cleanText(input.lastName, 80), level: cleanText(input.level, 80), school: cleanText(input.school, 120), goals: cleanText(input.goals, 1000), birthYear: birth }
  if (input.id) {
    const done = await db.student.updateMany({ where: { id: input.id, familyId: family.id }, data })
    if (!done.count) throw new CommandError('Student not found.')
    return { id: input.id }
  }
  if ((await db.student.count({ where: { familyId: family.id } })) >= 12) throw new CommandError('Ask your tutor to add more students.')
  const s = await db.student.create({ data: { ...data, profileId: family.profileId, familyId: family.id } })
  return { id: s.id }
}

export async function handInHomework(db: Db, familyId: string, input: { id: string; comment?: unknown; url?: unknown }) {
  const url = cleanUrl(input.url)
  const done = await db.homework.updateMany({ where: { id: input.id, student: { familyId }, status: 'assigned' }, data: { status: 'handed_in', handedInAt: new Date(), guardianComment: cleanText(input.comment, 1000), handInUrl: url } })
  if (!done.count) throw new CommandError('This homework is not open to hand in.')
  return { id: input.id, status: 'handed_in' }
}

const REVIEW_AFTER = 3

export async function submitReview(prisma: PrismaClient, family: { id: string; profileId: string }, input: { rating: number; body?: unknown; displayName?: unknown }) {
  const rating = Math.floor(Number(input.rating))
  if (!(rating >= 1 && rating <= 5)) throw new CommandError('Choose 1 to 5 stars.')
  return transaction(prisma, async (tx) => {
    await lockFamily(tx, family.id)
    const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: family.profileId }, select: { reviewsEnabled: true } })
    if (!profile.reviewsEnabled) throw new CommandError('Reviews are turned off.')
    if ((await tx.session.count({ where: { familyId: family.id, status: 'completed' } })) < REVIEW_AFTER) throw new CommandError(`You can write a review after ${REVIEW_AFTER} sessions.`)
    if (await tx.review.count({ where: { familyId: family.id } })) throw new CommandError('You already wrote a review. Thank you!')
    const r = await tx.review.create({ data: { profileId: family.profileId, familyId: family.id, rating, body: cleanText(input.body, 2000), displayName: cleanText(input.displayName, 80) || 'A parent', status: 'pending' } })
    return { id: r.id, status: 'pending' }
  })
}

/** A private iCal feed link for a family or the tutor (a new one replaces the old). */
export async function calendarFeedToken(db: Db, who: { kind: 'family' | 'tutor'; id: string }) {
  const access = createPublicAccessToken()
  if (who.kind === 'family') await db.family.update({ where: { id: who.id }, data: { calendarTokenHash: access.hash } })
  else await db.tutorProfile.update({ where: { id: who.id }, data: { calendarTokenHash: access.hash } })
  return `${who.kind === 'family' ? 'f' : 't'}.${who.id}.${access.token}`
}

export async function resolveCalendarFeed(db: Db, raw: string) {
  const [kind, id, token] = raw.replace(/\.ics$/, '').split('.')
  if (!id || !token) return null
  if (kind === 'f') {
    const f = await db.family.findUnique({ where: { id }, select: { id: true, calendarTokenHash: true, profileId: true, guardianName: true } })
    return f && publicAccessTokenMatches(token, f.calendarTokenHash) ? { kind: 'family' as const, familyId: f.id, profileId: f.profileId, name: f.guardianName } : null
  }
  if (kind === 't') {
    const p = await db.tutorProfile.findUnique({ where: { id }, select: { id: true, calendarTokenHash: true, businessName: true } })
    return p && publicAccessTokenMatches(token, p.calendarTokenHash) ? { kind: 'tutor' as const, profileId: p.id, name: p.businessName } : null
  }
  return null
}

export { hashPublicAccessToken }
