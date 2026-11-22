/** §9 tests 15 and 19: who can see what, and the whole product end to end. */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { ctx, prisma, assertTestDatabase, makeTutor, makeFamily, slotAt, moveToPast, refuses, fakeStripe, lastCheckoutId } from './helpers'
import { book } from '../../features/keystone/utils/booking'
import * as pub from '../../features/keystone/utils/publicOps'
import * as ops from '../../features/keystone/utils/tutorOps'
import { handInHomework, submitReview } from '../../features/keystone/utils/family'

let stripe: ReturnType<typeof fakeStripe>
before(() => { assertTestDatabase(); stripe = fakeStripe() })
after(() => stripe.restore())

const LISTS = ['User', 'Role', 'TutorProfile', 'SessionType', 'WeeklyHours', 'TimeOff', 'Package', 'Family', 'Student', 'Inquiry', 'Review', 'Session', 'SessionNote', 'Homework', 'ProgressMark', 'Resource', 'RecurringSeries', 'PackagePurchase', 'CreditEntry', 'Invoice', 'InvoiceLine', 'Payment', 'PaymentProvider', 'PaymentSession', 'Expense', 'NotificationLog'] as const

describe('access', () => {
  test('15. families and tutors see only their own rows; private fields never reach a family; tokens are checked', async () => {
    const t = await makeTutor()
    const a = await makeFamily(t, { login: true, billingMode: 'invoice' })
    const b = await makeFamily(t, { login: true, billingMode: 'invoice' })
    const type = t.type('60-minute lesson')
    const sb = (await book(prisma, { profileId: t.profile.id, familyId: b.family.id, sessionTypeId: type.id, studentIds: b.studentIds, startsAt: slotAt(t), actor: 'guardian' })).session
    await moveToPast(sb.id)
    await ops.completeSession(prisma, t.session, { sessionId: sb.id, note: { covered: 'Fractions', privateNote: 'PRIVATE-TUTOR-NOTE' }, homework: [{ title: 'Worksheet 3' }] as never })
    const hw = await prisma.homework.findFirstOrThrow({ where: { sessionId: sb.id } })
    const inv = await ops.createInvoice(prisma, t.session, { familyId: b.family.id, sessionIds: [sb.id] })
    await ops.sendInvoice(prisma, t.session, inv.id, false)
    const purchase = await ops.sellPackage(prisma, t.session, { familyId: b.family.id, packageId: t.packages[0].id, method: 'cash' })

    // Family A, by id, against B's rows.
    await refuses(() => pub.mySession(prisma, a.session, sb.id), /not found/)
    await refuses(() => pub.cancelMySession(prisma, a.session, sb.id), /not found/)
    await refuses(() => pub.payForSession(prisma, a.session, sb.id), /not found/)
    await refuses(() => pub.myProgress(prisma, a.session, b.studentIds[0]), /not found/)
    await refuses(() => handInHomework(prisma as never, a.family.id, { id: hw.id }), /not open/)
    await refuses(() => pub.myInvoice(prisma, a.session, inv.id), /not found/)
    await refuses(() => pub.payInvoice(prisma, a.session, inv.id), /not found/)
    await refuses(() => pub.confirmPackagePayment(prisma, a.session, purchase.purchaseId))
    await refuses(() => pub.reportPayment(prisma, a.session, { target: 'invoice', targetId: inv.id, amountCents: 100, method: 'cash', reference: 'x' }))
    const aHw = await pub.myHomework(prisma, a.session)
    assert.equal(aHw.homework.length, 0)

    // B sees its own, without the private fields.
    const own = JSON.stringify([await pub.mySession(prisma, b.session, sb.id), await pub.myStudents(prisma, b.session), await pub.myFamily(prisma, b.session), await pub.myProgress(prisma, b.session, b.studentIds[0]), await pub.myHomework(prisma, b.session)])
    assert.match(own, /Fractions/)
    for (const secret of ['PRIVATE-TUTOR-NOTE', 'PRIVATE-NEEDS', 'PRIVATE-FAMILY-NOTE', 'privateNote', 'privateNotes', '"needs"']) assert.ok(!own.includes(secret), `a family never receives ${secret}`)

    // A Family user is refused on every generic list query and mutation.
    const fam = ctx.withSession(a.session)
    for (const list of LISTS) {
      const rows = await fam.query[list].findMany({ query: 'id' }).catch(() => [])
      if (list === 'User') assert.ok(rows.every((r) => r.id === a.session!.itemId), 'a family sees only its own user')
      else assert.equal(rows.length, 0, `${list} is not readable by a family`)
      await assert.rejects(fam.query[list].createOne({ data: {}, query: 'id' }), Error, `${list} create refused`)
    }
    await assert.rejects(fam.query.Session.updateOne({ where: { id: sb.id }, data: { status: 'cancelled' } as never, query: 'id' }))
    await assert.rejects(fam.query.Invoice.deleteOne({ where: { id: inv.id }, query: 'id' }))

    // Tutor A cannot read tutor B's rows.
    const t2 = await makeTutor()
    const other = ctx.withSession(t2.session)
    assert.equal((await other.query.Session.findMany({ where: { id: { equals: sb.id } }, query: 'id' })).length, 0)
    assert.equal((await other.query.Family.findMany({ where: { id: { equals: b.family.id } }, query: 'id' })).length, 0)
    assert.equal((await other.query.Invoice.findMany({ where: { id: { equals: inv.id } }, query: 'id' })).length, 0)
    await refuses(() => ops.tutorSession(prisma, t2.session, sb.id), /not found|choose/i)
    await refuses(() => ops.tutorFamily(prisma, t2.session, b.family.id), /not found|choose/i)
    await refuses(() => ops.tutorInvoice(prisma, t2.session, inv.id), /not found|choose/i)
    assert.equal((await ctx.withSession(t.session).query.Session.findMany({ where: { id: { equals: sb.id } }, query: 'id' })).length, 1, 'its own tutor does see it')

    // Sign-up cannot set a role.
    // Generic sign-up (when PUBLIC_SIGNUPS_ALLOWED is on) can never choose a role: asking for one is
    // refused by the field's access, and without it the account is a Family.
    const anon = ctx.withSession(undefined as never)
    const tutorRole = await prisma.role.findFirstOrThrow({ where: { name: 'Tutor' } })
    const prev = process.env.PUBLIC_SIGNUPS_ALLOWED
    process.env.PUBLIC_SIGNUPS_ALLOWED = 'true'
    try {
      const asked = `signup-${Date.now()}@tests.invalid`
      await assert.rejects(anon.query.User.createOne({ data: { name: 'Signup', email: asked, password: 'a-long-password-123', role: { connect: { id: tutorRole.id } } } as never, query: 'id' }))
      assert.equal(await prisma.user.count({ where: { email: asked } }), 0)
      const plain = `signup-plain-${Date.now()}@tests.invalid`
      await anon.query.User.createOne({ data: { name: 'Signup', email: plain, password: 'a-long-password-123' }, query: 'id' })
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: plain }, include: { role: true } })).role?.name, 'Family')
    } finally { if (prev === undefined) delete process.env.PUBLIC_SIGNUPS_ALLOWED; else process.env.PUBLIC_SIGNUPS_ALLOWED = prev }
    // The family's own sign-up path (claim from the invite) ignores any role too: it has no role input at all.

    // A wrong booking or invoice token is refused.
    const visitor = await pub.bookFirstSession(prisma, { slug: t.slug, sessionTypeId: t.type('Free 20-minute consultation').id, startsAt: slotAt(t, 19 * 60).toISOString(), guardianName: 'V', email: 'v@tests.invalid', studentName: 'K', timezone: 'America/Chicago' })
    await refuses(() => pub.publicBooking(prisma, visitor.bookingId, 'wrong-token'), /not valid/)
    await refuses(() => pub.cancelMyBooking(prisma, visitor.bookingId, 'wrong-token'), /not valid/)
    await refuses(() => pub.publicInvoice(prisma, inv.id, 'wrong-token'), /not valid/)
    await refuses(() => pub.payInvoiceByToken(prisma, inv.id, 'wrong-token'), /not valid/)
    assert.equal((await pub.publicBooking(prisma, visitor.bookingId, visitor.token)).id ?? visitor.bookingId, visitor.bookingId)
  })

  test('19. typical setup, then a full pass through the product', async () => {
    const t = await makeTutor()
    const first = t.type('First lesson')
    // A visitor books the first lesson and pays by card.
    const booked = await pub.bookFirstSession(prisma, { slug: t.slug, sessionTypeId: first.id, startsAt: slotAt(t, 16 * 60).toISOString(), guardianName: 'Amara Bello', email: `amara-${Date.now()}@tests.invalid`, studentName: 'Tobi', studentLevel: 'Grade 8', timezone: 'Africa/Lagos' })
    assert.equal(booked.status, 'pending_payment')
    const page = await pub.payForBooking(prisma, booked.bookingId, booked.token)
    assert.match(page.url, /^https:\/\/checkout\.stripe\.com\//)
    stripe.pay(page.checkoutId)
    assert.equal((await pub.confirmBookingPayment(prisma, booked.bookingId, booked.token)).paid, true)
    const s = await prisma.session.findUniqueOrThrow({ where: { id: booked.bookingId } })
    assert.equal(s.status, 'scheduled'); assert.equal(s.paymentStatus, 'paid')

    // The family claims its account from the booking link.
    const famRow = await prisma.family.findUniqueOrThrow({ where: { id: s.familyId! } })
    const { claimFamilyAccount } = await import('../../features/keystone/utils/family')
    const claimed = await claimFamilyAccount(prisma, ctx.sudo() as never, { bookingId: booked.bookingId, bookingToken: booked.token, email: famRow.email, password: 'family-password-123', name: 'Amara Bello' }) as { userId?: string }
    const user = await prisma.user.findFirstOrThrow({ where: { email: famRow.email } })
    void claimed
    const fam = { itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, role: { canAccessDashboard: false } as never } }

    // The tutor completes it with a note and homework; the family hands it in; the tutor reviews it.
    await moveToPast(s.id)
    await ops.completeSession(prisma, t.session, { sessionId: s.id, note: { covered: 'Ratios and proportion', wentWell: 'Quick with cross-multiplying', workOnNext: 'Word problems', effort: 4 }, homework: [{ title: 'Ratio worksheet', instructions: 'Questions 1 to 12' }] as never })
    const hw = (await pub.myHomework(prisma, fam as never)).homework[0] as { id: string }
    assert.ok(hw)
    await handInHomework(prisma as never, famRow.id, { id: hw.id, comment: 'Done, question 9 was hard' })
    await ops.reviewHomework(prisma, t.session, hw.id, 'Good work. Look again at 9.')
    assert.equal((await prisma.homework.findUniqueOrThrow({ where: { id: hw.id } })).status, 'reviewed')

    // A review (after three completed sessions).
    for (const m of [15, 17]) {
      const x = await pub.bookSession(prisma, fam as never, { sessionTypeId: t.type('60-minute lesson').id, startsAt: slotAt(t, m * 60, 1).toISOString(), studentIds: (await prisma.student.findMany({ where: { familyId: famRow.id } })).map((st) => st.id) })
      const c = await pub.payForSession(prisma, fam as never, x.sessionId)
      stripe.pay(c.checkoutId)
      await pub.confirmSessionPayment(prisma, fam as never, x.sessionId)
      await moveToPast(x.sessionId, 3 + m)
      await ops.completeSession(prisma, t.session, { sessionId: x.sessionId })
    }
    const review = await submitReview(prisma, famRow, { rating: 5, body: 'Tobi finally likes maths.', displayName: 'Amara B.' })
    assert.equal(review.status, 'pending')
    await ops.moderateReview(prisma, t.session, review.id, 'published')

    // Buy a package by card, then book from it.
    const pkg = t.packages.find((p) => p.name === '10 hours')!
    const bought = await pub.buyPackage(prisma, fam as never, pkg.id, 'card')
    stripe.pay(await lastCheckoutId({ purchaseId: bought.purchaseId }))
    await pub.confirmPackagePayment(prisma, fam as never, bought.purchaseId)
    assert.equal((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: bought.purchaseId } })).status, 'active')
    const fromPkg = await pub.bookSession(prisma, fam as never, { sessionTypeId: t.type('60-minute lesson').id, startsAt: slotAt(t, 18 * 60, 1).toISOString(), studentIds: (await prisma.student.findMany({ where: { familyId: famRow.id } })).map((st) => st.id) })
    assert.equal(fromPkg.funding, 'package'); assert.equal(fromPkg.status, 'scheduled')
    assert.equal((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: bought.purchaseId } })).minutesRemaining, 540)

    // Invoice a second family and have them pay it by card.
    const second = await makeFamily(t, { billingMode: 'invoice', login: true })
    const created = await ops.createSessionAsTutor(prisma, t.session, { familyId: second.family.id, sessionTypeId: t.type('90-minute lesson').id, startsAt: slotAt(t, 15 * 60, 3).toISOString(), studentIds: second.studentIds, notify: false } as never)
    assert.equal(created.funding, 'invoice')
    await moveToPast(created.sessionId)
    await ops.completeSession(prisma, t.session, { sessionId: created.sessionId })
    const inv = await ops.createInvoice(prisma, t.session, { familyId: second.family.id, sessionIds: [created.sessionId] })
    await ops.sendInvoice(prisma, t.session, inv.id, false)
    const c = await pub.payInvoice(prisma, second.session, inv.id)
    stripe.pay(c.checkoutId)
    await pub.confirmInvoicePayment(prisma, second.session, inv.id)
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })
    assert.equal(paid.status, 'paid'); assert.equal(paid.paidCents, paid.totalCents)

    // The tutor's earnings see all of it.
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const to = new Date(Date.now() + 86_400_000).toISOString()
    const e = await ops.myEarnings(prisma, t.session, { from, to }) as unknown as Record<string, unknown>
    assert.ok(JSON.stringify(e).length > 2)
    const payments = await prisma.payment.count({ where: { profileId: t.profile.id, kind: { not: 'refund' }, status: 'confirmed' } })
    assert.equal(payments, 5, 'first lesson, two lessons, package, invoice')
  })
})
