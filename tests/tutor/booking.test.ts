/** §9 tests 1, 2, 5, 6, 16, 17, 18: booking, the lock, policy, excuse, gates, reschedule, timezones. */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { prisma, assertTestDatabase, makeTutor, makeFamily, slotAt, moveInside, moveToPast, activePackage, refuses, withoutStripe, fakeStripe, ledgerHolds } from './helpers'
import { book, cancelSession, excuseSession, markNoShow, rescheduleSession, slotsForDay, topUpSeries } from '../../features/keystone/utils/booking'
import { bookFirstSession, publicSlots } from '../../features/keystone/utils/publicOps'
import { createInvoice, sendInvoice } from '../../features/keystone/utils/billing'
import { openCheckout, settleTarget } from '../../features/keystone/utils/payments'
import { businessDateKey, businessWallTime } from '../../features/shared/business-time'

let restore: () => void
before(() => { assertTestDatabase(); restore = withoutStripe() })
after(() => restore())

describe('booking', () => {
  test('1. slot race: 10 parallel bookings for one slot, exactly 1 succeeds', async () => {
    const t = await makeTutor()
    const fams = await Promise.all(Array.from({ length: 10 }, () => makeFamily(t)))
    const startsAt = slotAt(t)
    const type = t.type('60-minute lesson')
    const results = await Promise.allSettled(fams.map((f) => book(prisma, { profileId: t.profile.id, familyId: f.family.id, sessionTypeId: type.id, studentIds: f.studentIds, startsAt, actor: 'guardian' })))
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    for (const r of results) if (r.status === 'rejected') assert.match(String(r.reason?.message), /just taken/)
    assert.equal(await prisma.session.count({ where: { profileId: t.profile.id, startsAt, status: { in: ['scheduled', 'pending_payment'] } } }), 1)
  })

  test('2. series against a booking: one wins, the other is skipped or refused', async () => {
    const t = await makeTutor()
    const a = await makeFamily(t)
    const b = await makeFamily(t)
    const type = t.type('60-minute lesson')
    const startsAt = slotAt(t, 17 * 60, 3)
    const date = businessDateKey(startsAt, t.profile.timezone)
    const series = await prisma.recurringSeries.create({ data: { profileId: t.profile.id, familyId: a.family.id, sessionTypeId: type.id, students: { connect: a.studentIds.map((id) => ({ id })) }, dayOfWeek: 3, startMinute: 17 * 60, mode: 'online', startsOn: date, endsOn: date, status: 'active' } })
    const [guardian, gen] = await Promise.allSettled([
      book(prisma, { profileId: t.profile.id, familyId: b.family.id, sessionTypeId: type.id, studentIds: b.studentIds, startsAt, actor: 'guardian' }),
      topUpSeries(prisma, t.profile.id, series.id),
    ])
    assert.equal(gen.status, 'fulfilled')
    const g = gen.status === 'fulfilled' ? gen.value : { created: 0, skipped: [] as string[] }
    const guardianWon = guardian.status === 'fulfilled'
    assert.equal(Number(guardianWon) + g.created, 1, 'exactly one of them takes the slot')
    if (guardianWon) assert.deepEqual(g.skipped, [date])
    else assert.match(String((guardian as PromiseRejectedResult).reason?.message), /just taken/)
    assert.equal(await prisma.session.count({ where: { profileId: t.profile.id, startsAt, status: 'scheduled' } }), 1)
  })

  test('5. cancellation policy: outside, inside, 50%, the setting changes the outcome, the tutor never charges', async () => {
    const t = await makeTutor()
    const type = t.type('60-minute lesson')
    const f = await makeFamily(t, { billingMode: 'invoice' })
    const p = await makeFamily(t)
    const purchase = await activePackage(t, p.family.id)
    const left = async () => (await prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchase.id } })).minutesRemaining
    const bk = (fam: typeof f, minute: number) => book(prisma, { profileId: t.profile.id, familyId: fam.family.id, sessionTypeId: type.id, studentIds: fam.studentIds, startsAt: slotAt(t, minute), actor: 'guardian' }).then((r) => r.session)

    const s1 = await bk(p, 15 * 60)
    assert.equal(s1.funding, 'package')
    assert.equal(await left(), 240)
    assert.equal((await cancelSession(prisma, { sessionId: s1.id, by: 'guardian', profileId: t.profile.id })).status, 'cancelled')
    assert.equal(await left(), 300, 'outside the window the minutes return')

    const s2 = await bk(f, 16 * 60)
    await moveInside(s2.id)
    assert.equal((await cancelSession(prisma, { sessionId: s2.id, by: 'guardian', profileId: t.profile.id })).status, 'late_cancelled')
    const s2a = await prisma.session.findUniqueOrThrow({ where: { id: s2.id } })
    assert.equal(s2a.chargedCents, type.priceCents, 'inside at 100% bills the price')
    assert.equal(s2a.billable, 'yes')

    await prisma.tutorProfile.update({ where: { id: t.profile.id }, data: { lateCancelPercent: 50 } })
    const s3 = await bk(p, 17 * 60)
    await moveInside(s3.id, 2)
    await cancelSession(prisma, { sessionId: s3.id, by: 'guardian', profileId: t.profile.id })
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: s3.id } })).chargedMinutes, 30)
    assert.equal(await left(), 270, '50% debits 30 and releases 30')
    const s4 = await bk(f, 18 * 60)
    await moveInside(s4.id, 4)
    await cancelSession(prisma, { sessionId: s4.id, by: 'guardian', profileId: t.profile.id })
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: s4.id } })).chargedCents, Math.floor(type.priceCents / 2))

    const s5 = await bk(p, 19 * 60)
    await moveInside(s5.id, 1)
    assert.equal((await cancelSession(prisma, { sessionId: s5.id, by: 'tutor', profileId: t.profile.id })).status, 'cancelled')
    assert.equal(await left(), 270, 'the tutor cancel never charges')
    assert.ok((await ledgerHolds(purchase.id)).ok)
  })

  test('5b. card: a late cancel at 50% keeps half and refunds the rest through the Stripe adapter', async () => {
    restore()
    const stripe = fakeStripe()
    try {
      const t = await makeTutor({ patch: { lateCancelPercent: 50 } })
      const type = t.type('60-minute lesson')
      const f = await makeFamily(t)
      const s = (await book(prisma, { profileId: t.profile.id, familyId: f.family.id, sessionTypeId: type.id, studentIds: f.studentIds, startsAt: slotAt(t), actor: 'guardian' })).session
      assert.equal(s.status, 'pending_payment')
      const c = await openCheckout(prisma, { profile: t.profile, target: 'session', targetId: s.id, amountCents: s.priceCents, description: 'Lesson', backUrl: 'https://tutor.invalid/b', holdEndsAt: s.holdEndsAt })
      stripe.pay(c.checkoutId)
      await settleTarget(prisma, 'session', s.id)
      await moveInside(s.id, 3)
      const r = await cancelSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id })
      assert.equal(r.status, 'late_cancelled')
      assert.equal(r.refundedCents, s.priceCents - Math.floor(s.priceCents / 2))
      assert.equal(stripe.refunds.length, 1)
    } finally { stripe.restore(); restore = withoutStripe() }
  })

  test('6. excuse reverses a late cancel for each funding; refused after 30 days or once invoiced', async () => {
    const t = await makeTutor()
    const type = t.type('60-minute lesson')
    const inv = await makeFamily(t, { billingMode: 'invoice' })
    const pk = await makeFamily(t)
    const purchase = await activePackage(t, pk.family.id)
    const bk = (fam: typeof inv, minute: number) => book(prisma, { profileId: t.profile.id, familyId: fam.family.id, sessionTypeId: type.id, studentIds: fam.studentIds, startsAt: slotAt(t, minute), actor: 'guardian' }).then((r) => r.session)

    const a = await bk(pk, 15 * 60)
    await moveInside(a.id)
    await cancelSession(prisma, { sessionId: a.id, by: 'guardian', profileId: t.profile.id })
    assert.equal((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchase.id } })).minutesRemaining, 240)
    await excuseSession(prisma, a.id, t.profile.id)
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: a.id } })).status, 'excused')
    assert.equal((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchase.id } })).minutesRemaining, 300)
    assert.equal(await prisma.creditEntry.count({ where: { sessionId: a.id, kind: 'reversal' } }), 1)
    assert.ok((await ledgerHolds(purchase.id)).ok)

    const b = await bk(inv, 16 * 60)
    await moveToPast(b.id)
    await markNoShow(prisma, b.id, t.profile.id)
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: b.id } })).billable, 'yes')
    await excuseSession(prisma, b.id, t.profile.id)
    const b2 = await prisma.session.findUniqueOrThrow({ where: { id: b.id } })
    assert.equal(b2.billable, 'no'); assert.equal(b2.chargedCents, 0)

    const c = await bk(inv, 17 * 60)
    await moveToPast(c.id)
    await markNoShow(prisma, c.id, t.profile.id)
    const draft = await createInvoice(prisma, t.profile.id, { familyId: inv.family.id, sessionIds: [c.id] })
    await sendInvoice(prisma, t.profile.id, draft.id)
    await refuses(() => excuseSession(prisma, c.id, t.profile.id), /sent invoice/)

    const d = await bk(inv, 18 * 60)
    await moveToPast(d.id)
    await markNoShow(prisma, d.id, t.profile.id)
    await moveToPast(d.id, 31 * 24)
    await refuses(() => excuseSession(prisma, d.id, t.profile.id), /30 days/)
  })

  test('16. new-family gate: a visitor cannot book a type not open to new families; a blocked family cannot book', async () => {
    const t = await makeTutor()
    const closed = t.type('60-minute lesson')
    const open = t.type('Free 20-minute consultation')
    await refuses(() => bookFirstSession(prisma, { slug: t.slug, sessionTypeId: closed.id, startsAt: slotAt(t).toISOString(), guardianName: 'New Parent', email: 'new@tests.invalid', studentName: 'Kid' }), /current families/)
    const ok = await bookFirstSession(prisma, { slug: t.slug, sessionTypeId: open.id, startsAt: slotAt(t).toISOString(), guardianName: 'New Parent', email: 'new@tests.invalid', studentName: 'Kid' })
    assert.equal(ok.status, 'scheduled')
    const blocked = await makeFamily(t, { status: 'blocked' })
    await refuses(() => book(prisma, { profileId: t.profile.id, familyId: blocked.family.id, sessionTypeId: closed.id, studentIds: blocked.studentIds, startsAt: slotAt(t, 18 * 60), actor: 'guardian' }), /can’t be booked online/)
    await refuses(() => bookFirstSession(prisma, { slug: t.slug, sessionTypeId: open.id, startsAt: slotAt(t, 19 * 60).toISOString(), guardianName: 'X', email: blocked.family.email, studentName: 'Kid' }), /can’t be booked online/)
  })

  test('17. reschedule: outside the window up to the limit; funding carries; the old slot is free at once', async () => {
    const t = await makeTutor({ patch: { reschedulesAllowed: 2 } })
    const type = t.type('60-minute lesson')
    const f = await makeFamily(t)
    const other = await makeFamily(t)
    const purchase = await activePackage(t, f.family.id)
    const first = slotAt(t, 15 * 60)
    const s = (await book(prisma, { profileId: t.profile.id, familyId: f.family.id, sessionTypeId: type.id, studentIds: f.studentIds, startsAt: first, actor: 'guardian' })).session
    await rescheduleSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id, startsAt: slotAt(t, 16 * 60) })
    const taken = await book(prisma, { profileId: t.profile.id, familyId: other.family.id, sessionTypeId: type.id, studentIds: other.studentIds, startsAt: first, actor: 'guardian' })
    assert.equal(taken.session.status, 'scheduled', 'the old slot is free at once')
    await rescheduleSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id, startsAt: slotAt(t, 17 * 60) })
    await refuses(() => rescheduleSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id, startsAt: slotAt(t, 18 * 60) }), /most allowed/)
    const moved = await prisma.session.findUniqueOrThrow({ where: { id: s.id } })
    assert.equal(moved.funding, 'package'); assert.equal(moved.rescheduleCount, 2)
    assert.equal((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchase.id } })).minutesRemaining, 240, 'funding carries, nothing doubled')
    const s2 = (await book(prisma, { profileId: t.profile.id, familyId: other.family.id, sessionTypeId: type.id, studentIds: other.studentIds, startsAt: slotAt(t, 19 * 60), actor: 'guardian' })).session
    await moveInside(s2.id)
    await refuses(() => rescheduleSession(prisma, { sessionId: s2.id, by: 'guardian', profileId: t.profile.id, startsAt: slotAt(t, 18 * 60) }), /closes/)
    await rescheduleSession(prisma, { sessionId: s2.id, by: 'tutor', profileId: t.profile.id, startsAt: slotAt(t, 18 * 60) })
    assert.ok((await ledgerHolds(purchase.id)).ok)
  })

  test('18. timezones: Chicago across the March and November 2027 clock changes; Karachi sees the same instant', async () => {
    const t = await makeTutor({ timezone: 'America/Chicago', patch: { maxAdvanceDays: 365 } })
    const type = t.type('60-minute lesson')
    const cases: Array<[string, string]> = [['2027-03-11', '2027-03-11T22:00:00.000Z'], ['2027-03-15', '2027-03-15T21:00:00.000Z'], ['2027-11-04', '2027-11-04T21:00:00.000Z'], ['2027-11-08', '2027-11-08T22:00:00.000Z']]
    for (const [date, utc] of cases) assert.equal(businessWallTime(date, 16 * 60, 'America/Chicago').toISOString(), utc)
    const profile = await prisma.tutorProfile.findUniqueOrThrow({ where: { id: t.profile.id } })
    const now = Date.now()
    const within = (d: string) => Date.parse(`${d}T12:00:00Z`) - now < 360 * 86_400_000
    if (within('2027-03-11')) {
      const before = await slotsForDay(prisma as never, profile, type, '2027-03-11', 'America/Chicago')
      const afterChange = await slotsForDay(prisma as never, profile, type, '2027-03-15', 'America/Chicago')
      assert.equal(before[0], '2027-03-11T21:00:00.000Z', '15:00 CST = 21:00Z')
      assert.equal(afterChange[0], '2027-03-15T20:00:00.000Z', '15:00 CDT = 20:00Z')
      const karachi = [...await slotsForDay(prisma as never, profile, type, '2027-03-15', 'Asia/Karachi'), ...await slotsForDay(prisma as never, profile, type, '2027-03-16', 'Asia/Karachi')]
      for (const iso of afterChange) assert.ok(karachi.includes(iso), `${iso} is offered in Karachi too`)
      const pub = await publicSlots(prisma, { slug: t.slug, sessionTypeId: type.id, date: '2027-03-16', timezone: 'Asia/Karachi' })
      assert.ok(pub.slots.includes('2027-03-15T20:00:00.000Z'), 'Monday 15:00 Chicago is Tuesday 01:00 in Karachi')
    }
    if (within('2027-11-08')) {
      const nov = await slotsForDay(prisma as never, profile, type, '2027-11-08', 'America/Chicago')
      assert.equal(nov[0], '2027-11-08T21:00:00.000Z', '15:00 CST after the November change')
      const novBefore = await slotsForDay(prisma as never, profile, type, '2027-11-04', 'America/Chicago')
      assert.equal(novBefore[0], '2027-11-04T20:00:00.000Z', '15:00 CDT before it')
    }
  })
})
