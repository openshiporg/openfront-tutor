import { timingSafeEqual } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

import { keystoneContext } from '../context'
import { releaseUnpaidHolds, topUpAllSeries } from '../utils/booking'
import { guarded, lockTutorBooking, transaction } from '../utils/business'
import { expirePurchases } from '../utils/ledger'
import { notify } from '../utils/notify'
import { trustedOrigin } from '../../shared/trusted-origin'

const same = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

/**
 * D16: the same housekeeping the dashboard does on read, for a host cron:
 * release ended holds, top up series, expire packages, and send reminders
 * 24 hours before (reminders are only on time when a cron calls this).
 */
export async function runJobs(request: Request) {
  const secret = process.env.JOBS_SECRET
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!secret || !given || !same(given, secret)) return Response.json({ success: false, error: 'Not allowed.' }, { status: 401 })
  const prisma = keystoneContext.prisma as PrismaClient
  const db = guarded(prisma)
  const profiles = await db.tutorProfile.findMany({ select: { id: true, timezone: true, businessName: true, email: true }, take: 100 })
  let released = 0, reminders = 0
  for (const p of profiles) {
    released += await releaseUnpaidHolds(prisma, p.id)
    await topUpAllSeries(prisma, p.id)
    await transaction(prisma, async (tx) => { await lockTutorBooking(tx, p.id); await expirePurchases(tx, p.id) })
    const soon = await db.session.findMany({ where: { profileId: p.id, status: 'scheduled', reminderSentAt: null, startsAt: { gt: new Date(), lt: new Date(Date.now() + 24 * 3_600_000) } }, select: { id: true, startsAt: true, typeNameSnapshot: true, family: { select: { email: true, guardianName: true, timezone: true } } }, take: 200 })
    for (const s of soon) {
      const claimed = await db.session.updateMany({ where: { id: s.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } })
      if (!claimed.count) continue
      const when = new Intl.DateTimeFormat('en-US', { timeZone: s.family?.timezone || p.timezone, dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short' }).format(s.startsAt)
      await notify(prisma, { profileId: p.id, kind: 'reminder', to: s.family?.email, subject: `Reminder: ${s.typeNameSnapshot} ${when}`, lines: [`Hi ${s.family?.guardianName ?? ''},`, `${s.typeNameSnapshot} with ${p.businessName} is on ${when}.`], link: `${trustedOrigin()}/account/sessions/${s.id}`, linkLabel: 'Open the session', replyTo: p.email, sessionId: s.id })
      reminders++
    }
  }
  return Response.json({ success: true, released, reminders })
}
