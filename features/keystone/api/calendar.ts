import type { PrismaClient } from '@prisma/client'

import { keystoneContext } from '../context'
import { guarded } from '../utils/business'
import { icsCalendar } from '../utils/notify'
import { resolveCalendarFeed } from '../utils/family'
import { publicAccessTokenMatches } from '../utils/publicAccessToken'
import { sessionFor } from './request-session'

const prisma = () => keystoneContext.prisma as PrismaClient
const ics = (body: string, name: string) => new Response(body, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `inline; filename="${name}.ics"`, 'cache-control': 'private, no-store' } })
const notFound = () => new Response('Not found', { status: 404 })

const select = { id: true, startsAt: true, endsAt: true, typeNameSnapshot: true, status: true, mode: true, meetingUrl: true, locationText: true, students: { select: { firstName: true, meetingUrl: true } }, profile: { select: { businessName: true, defaultMeetingUrl: true, inPersonArea: true } } } as const
type Row = { id: string; startsAt: Date; endsAt: Date; typeNameSnapshot: string; status: string; mode: string; meetingUrl: string; locationText: string; students: Array<{ firstName: string; meetingUrl: string }>; profile: { businessName: string; defaultMeetingUrl: string; inPersonArea: string } }

function event(s: Row, forTutor: boolean) {
  const link = s.mode === 'online' ? (s.meetingUrl || s.students.find((x) => x.meetingUrl)?.meetingUrl || s.profile.defaultMeetingUrl) : ''
  const who = s.students.map((x) => x.firstName).join(', ')
  return {
    id: s.id, startsAt: s.startsAt, endsAt: s.endsAt, status: ['cancelled', 'late_cancelled', 'released'].includes(s.status) ? 'cancelled' : 'confirmed',
    title: forTutor ? `${s.typeNameSnapshot}${who ? ` · ${who}` : ''}` : `${s.typeNameSnapshot} · ${s.profile.businessName}`,
    description: link ? `Join: ${link}` : '', location: link || (s.mode === 'in_person' ? (s.locationText || s.profile.inPersonArea) : ''),
  }
}

/** One session's .ics: by booking token, for the signed-in family that owns it, or for its tutor. */
export async function sessionIcs(request: Request, id: string) {
  const db = guarded(prisma())
  const token = new URL(request.url).searchParams.get('t')
  const s = await db.session.findUnique({ where: { id }, select: { ...select, publicAccessTokenHash: true, family: { select: { userId: true } } } }) as (Row & { publicAccessTokenHash: string; family: { userId: string | null } | null }) | null
  if (!s) return notFound()
  let allowed = Boolean(token && publicAccessTokenMatches(token, s.publicAccessTokenHash))
  if (!allowed) {
    const userId = (await sessionFor(request).catch(() => undefined))?.itemId
    if (userId) allowed = s.family?.userId === userId || (await db.session.count({ where: { id, profile: { ownerId: userId } } })) === 1
  }
  if (!allowed) return notFound()
  return ics(icsCalendar(s.profile.businessName, [event(s, false)]), 'session')
}

/** A private read-only feed (S21): a family's sessions, or the tutor's whole calendar. */
export async function feedIcs(raw: string) {
  const db = guarded(prisma())
  const who = await resolveCalendarFeed(db, raw)
  if (!who) return notFound()
  const since = new Date(Date.now() - 60 * 86_400_000)
  const rows = await db.session.findMany({ where: { profileId: who.profileId, ...(who.kind === 'family' ? { familyId: who.familyId } : {}), startsAt: { gt: since }, status: { notIn: ['released', 'pending_payment'] } }, select, orderBy: { startsAt: 'asc' }, take: 1000 })
  return ics(icsCalendar(who.name, rows.map((s) => event(s as Row, who.kind === 'tutor'))), 'lessons')
}
