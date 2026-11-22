/** §9 tests 3, 4, 7–14: the minutes ledger, card settlement and refunds, packages, invoices, flat fees, reported payments. */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import { prisma, assertTestDatabase, makeTutor, makeFamily, slotAt, moveInside, moveToPast, activePackage, refuses, fakeStripe, lastCheckoutId, ledgerHolds, type Tutor } from './helpers'
import { book, cancelSession, excuseSession, markNoShow, reopenSession, rescheduleSession, releaseUnpaidHolds, completeInLock } from '../../features/keystone/utils/booking'
import { lockTutorBooking, transaction } from '../../features/keystone/utils/business'
import { addInvoiceLine, confirmPayment, createInvoice, recordPayment, refundPackage, rejectPayment, reportPayment, sendInvoice, startPurchase, voidInvoice } from '../../features/keystone/utils/billing'
import { openCheckout, refundPaymentRow, settleCheckoutById, settleTarget } from '../../features/keystone/utils/payments'
import { expirePurchases } from '../../features/keystone/utils/ledger'
import { handlePaymentWebhook } from '../../features/keystone/api/payment-webhook'

let stripe: ReturnType<typeof fakeStripe>
before(() => { assertTestDatabase(); stripe = fakeStripe() })
after(() => stripe.restore())

const bookAs = (t: Tutor, f: { family: { id: string }; studentIds: string[] }, startsAt: Date, typeName = '60-minute lesson') =>
  book(prisma, { profileId: t.profile.id, familyId: f.family.id, sessionTypeId: t.type(typeName).id, studentIds: f.studentIds, startsAt, actor: 'guardian' }).then((r) => r.session)
const complete = (t: Tutor, id: string) => transaction(prisma, async (tx) => { await lockTutorBooking(tx, t.profile.id); return completeInLock(tx, id, t.profile.id) })

/** Opens a card page for an unpaid card session, exactly as the booking page does. */
async function cardCheckout(t: Tutor, sessionId: string) {
  const s = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })
  return openCheckout(prisma, { profile: t.profile, target: 'session', targetId: s.id, amountCents: s.priceCents, description: 'Lesson', backUrl: 'https://tutor.invalid/b', holdEndsAt: s.holdEndsAt })
}

describe('money', () => {
  test('3. credit race: two parallel bookings, minutes for one; one uses the package, the other falls back', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { billingMode: 'invoice' })
    const purchase = await activePackage(t, f.family.id)
    await prisma.packagePurchase.update({ where: { id: purchase.id }, data: { minutesRemaining: 60 } })
    await prisma.creditEntry.create({ data: { profileId: t.profile.id, purchaseId: purchase.id, kind: 'adjustment', minutes: -240, note: 'Set up for one lesson', key: `${purchase.id}:race-setup` } })
    const [a, b] = await Promise.all([bookAs(t, f, slotAt(t, 15 * 60)), bookAs(t, f, slotAt(t, 17 * 60))])
    assert.deepEqual([a.funding, b.funding].sort(), ['invoice', 'package'])
    const after = await ledgerHolds(purchase.id)
    assert.equal(after.stored, 0); assert.ok(after.ok)
  })

  test('4. ledger invariant after a random run of every action', async () => {
    const t = await makeTutor({ patch: { lateCancelPercent: 50, reschedulesAllowed: 50 } })
    const f = await makeFamily(t)
    const purchase = await activePackage(t, f.family.id, '20 hours')
    let seed = 7
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n }
    let minute = 15 * 60
    let week = 0
    const next = () => { minute += 60; if (minute > 19 * 60) { minute = 15 * 60; week++ } return slotAt(t, minute, 1 + (week % 4), Math.floor(week / 4)) }
    for (let i = 0; i < 24; i++) {
      const s = await bookAs(t, f, next())
      assert.equal(s.funding, 'package')
      const action = rnd(7)
      try {
        if (action === 0) await cancelSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id })
        if (action === 1) { await moveInside(s.id, 2 + rnd(10)); await cancelSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id }); if (rnd(2)) await excuseSession(prisma, s.id, t.profile.id) }
        if (action === 2) { await moveToPast(s.id); await complete(t, s.id); if (rnd(2)) await reopenSession(prisma, s.id, t.profile.id); if (rnd(2)) await complete(t, s.id).catch(() => null) }
        if (action === 3) { await moveToPast(s.id); await markNoShow(prisma, s.id, t.profile.id); if (rnd(2)) await excuseSession(prisma, s.id, t.profile.id) }
        if (action === 4) await rescheduleSession(prisma, { sessionId: s.id, by: 'guardian', profileId: t.profile.id, startsAt: next() })
        if (action === 5) { await moveInside(s.id, 1); await cancelSession(prisma, { sessionId: s.id, by: 'tutor', profileId: t.profile.id }) }
      } catch (e) { throw new Error(`step ${i} action ${action}: ${(e as Error).message}`) }
      const h = await ledgerHolds(purchase.id)
      assert.ok(h.ok, `step ${i}: stored ${h.stored} ledger ${h.ledger}`)
    }
    // Every hold is closed (debit/release) once, or still open on a live session.
    const sessions = await prisma.session.findMany({ where: { familyId: f.family.id }, select: { id: true, status: true } })
    for (const s of sessions) {
      const rows = await prisma.creditEntry.findMany({ where: { sessionId: s.id } })
      const held = rows.reduce((n, r) => n + r.heldChange, 0)
      if (s.status === 'scheduled') assert.equal(held, 60, `live session ${s.id} still holds its minutes`)
      else assert.equal(held, 0, `${s.status} session ${s.id} has no open hold`)
      assert.ok(held >= 0)
    }
  })

  test('7. hold release: unpaid past the hold is released; a payment first confirms; a payment after release is refunded', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t)
    const startsAt = slotAt(t)
    const s = await bookAs(t, f, startsAt)
    assert.equal(s.status, 'pending_payment')
    await cardCheckout(t, s.id)
    await prisma.session.update({ where: { id: s.id }, data: { holdEndsAt: new Date(Date.now() - 1000) } })
    assert.equal(await releaseUnpaidHolds(prisma, t.profile.id), 1)
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: s.id } })).status, 'released')
    const other = await makeFamily(t)
    assert.equal((await bookAs(t, other, startsAt)).status, 'pending_payment', 'the slot reopened')

    // A payment that arrived before the release confirms the booking.
    const s2 = await bookAs(t, f, slotAt(t, 18 * 60))
    const c2 = await cardCheckout(t, s2.id)
    stripe.pay(c2.checkoutId)
    await prisma.session.update({ where: { id: s2.id }, data: { holdEndsAt: new Date(Date.now() - 1000) } })
    assert.equal(await releaseUnpaidHolds(prisma, t.profile.id, s2.id), 0)
    const s2a = await prisma.session.findUniqueOrThrow({ where: { id: s2.id } })
    assert.equal(s2a.status, 'scheduled'); assert.equal(s2a.paymentStatus, 'paid')

    // Paid at Stripe after the release: recorded, then refunded.
    const before = stripe.refunds.length
    const id = await lastCheckoutId({ sessionId: s.id })
    stripe.pay(id)
    assert.equal(await settleCheckoutById(prisma, id), true)
    assert.equal(stripe.refunds.length, before + 1)
    const pay = await prisma.payment.findFirstOrThrow({ where: { sessionId: s.id, kind: 'session' } })
    assert.equal(pay.status, 'refunded')
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: s.id } })).status, 'released')
  })

  test('8. settle once: the webhook and the browser return together make one Payment', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t)
    const s = await bookAs(t, f, slotAt(t))
    const c = await cardCheckout(t, s.id)
    stripe.pay(c.checkoutId)
    const secret = 'whsec_tests_only'
    process.env.STRIPE_WEBHOOK_SECRET = secret
    try {
      const body = JSON.stringify({ id: `evt_${c.checkoutId}`, type: 'checkout.session.completed', data: { object: { id: c.checkoutId, object: 'checkout.session' } } })
      const ts = Math.floor(Date.now() / 1000)
      const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
      const hook = () => handlePaymentWebhook(new Request('https://tutor.invalid/api/payment-webhooks/stripe', { method: 'POST', body, headers: { 'stripe-signature': `t=${ts},v1=${sig}`, 'content-type': 'application/json' } }), 'stripe')
      const bad = await handlePaymentWebhook(new Request('https://tutor.invalid/x', { method: 'POST', body, headers: { 'stripe-signature': `t=${ts},v1=${'0'.repeat(64)}` } }), 'stripe')
      assert.equal(bad.status, 400, 'a wrong signature is refused')
      const results = await Promise.all([hook(), settleTarget(prisma, 'session', s.id), hook(), settleTarget(prisma, 'session', s.id)])
      assert.ok((results[0] as Response).ok)
      assert.equal(await prisma.payment.count({ where: { sessionId: s.id, kind: 'session' } }), 1)
      assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: s.id } })).status, 'scheduled')
    } finally { delete process.env.STRIPE_WEBHOOK_SECRET }
  })

  test('9. a wrong amount or currency from the provider is not accepted', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t)
    const s = await bookAs(t, f, slotAt(t))
    const c = await cardCheckout(t, s.id)
    stripe.pay(c.checkoutId, 100)
    assert.equal(await settleCheckoutById(prisma, c.checkoutId), false)
    const s2 = await bookAs(t, f, slotAt(t, 18 * 60))
    const c2 = await cardCheckout(t, s2.id)
    stripe.pay(c2.checkoutId, s2.priceCents, 'eur')
    assert.equal(await settleCheckoutById(prisma, c2.checkoutId), false)
    assert.equal(await prisma.payment.count({ where: { sessionId: { in: [s.id, s2.id] } } }), 0)
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: s.id } })).status, 'pending_payment')
  })

  test('10. a refund cannot exceed what was captured; a Stripe failure restores the payment row', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t)
    const s = await bookAs(t, f, slotAt(t))
    const c = await cardCheckout(t, s.id)
    stripe.pay(c.checkoutId)
    await settleTarget(prisma, 'session', s.id)
    const pay = await prisma.payment.findFirstOrThrow({ where: { sessionId: s.id, kind: 'session' } })
    await refuses(() => refundPaymentRow(prisma, pay.id, pay.amountCents + 1, 'too much'), /more than what was paid/)
    await refundPaymentRow(prisma, pay.id, 1000, 'part')
    await refuses(() => refundPaymentRow(prisma, pay.id, pay.amountCents - 999, 'too much now'), /more than what was paid/)
    stripe.restore()
    stripe = fakeStripe({ refuseRefunds: true })
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })
    await refuses(() => refundPaymentRow(prisma, pay.id, 500, 'declined'), /did not accept/)
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })
    assert.equal(after.refundedCents, before.refundedCents); assert.equal(after.refundPendingCents, 0); assert.equal(after.status, before.status)
    stripe.restore()
    stripe = fakeStripe()
  })

  test('11. package: awaiting minutes cannot be spent; active on confirm; expiry writes one entry; pro-rata refund to the cent', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { billingMode: 'invoice' })
    const pkg = t.packages.find((p) => p.name === '5 hours')!
    const waiting = await startPurchase(prisma, t.profile.id, f.family.id, pkg.id)
    assert.equal(waiting.status, 'awaiting_payment')
    const s = await bookAs(t, f, slotAt(t, 15 * 60))
    assert.equal(s.funding, 'invoice', 'awaiting minutes are not spent')
    await reportPayment(prisma, t.profile.id, f.family.id, { target: { kind: 'package', id: waiting.id }, amountCents: waiting.pricePaidCents, method: 'bank_transfer', reference: 'TRX-1' })
    assert.equal((await prisma.packagePurchase.findUniqueOrThrow({ where: { id: waiting.id } })).status, 'awaiting_payment', 'reported is not paid')
    const reported = await prisma.payment.findFirstOrThrow({ where: { purchaseId: waiting.id, status: 'reported' } })
    await confirmPayment(prisma, t.profile.id, reported.id)
    const active = await prisma.packagePurchase.findUniqueOrThrow({ where: { id: waiting.id } })
    assert.equal(active.status, 'active'); assert.equal(active.minutesRemaining, 300)

    // Expiry: held minutes wait for their session; one expire entry for the free minutes.
    const held = await bookAs(t, f, slotAt(t, 17 * 60))
    assert.equal(held.funding, 'package')
    await prisma.packagePurchase.update({ where: { id: active.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    await transaction(prisma, async (tx) => { await lockTutorBooking(tx, t.profile.id); await expirePurchases(tx, t.profile.id); await expirePurchases(tx, t.profile.id) })
    assert.equal(await prisma.creditEntry.count({ where: { purchaseId: active.id, kind: 'expire' } }), 1)
    const exp = await prisma.packagePurchase.findUniqueOrThrow({ where: { id: active.id } })
    assert.equal(exp.status, 'expired'); assert.equal(exp.minutesRemaining, 0)
    assert.equal((await prisma.creditEntry.aggregate({ where: { sessionId: held.id }, _sum: { heldChange: true } }))._sum.heldChange, 60, 'the held minutes stay with the session')
    assert.ok((await ledgerHolds(active.id)).ok)

    // Pro rata: a 10-hour package with 7h13m left refunds floor(price × 433 / 600).
    const ten = await activePackage(t, f.family.id, '10 hours')
    await prisma.packagePurchase.update({ where: { id: ten.id }, data: { minutesRemaining: 433 } })
    await prisma.creditEntry.create({ data: { profileId: t.profile.id, purchaseId: ten.id, kind: 'adjustment', minutes: -167, note: 'Used', key: `${ten.id}:used` } })
    const r = await refundPackage(prisma, t.profile.id, ten.id)
    assert.equal(r.refundedCents, Math.floor((ten.pricePaidCents * 433) / 600))
    assert.equal(r.refundedCents, 38970, '54000 × 433 ÷ 600 = 38970')
  })

  test('12. invoice: one live invoice per session; sent cannot be edited; void frees; paid at total; no overpayment; unique numbers', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { billingMode: 'invoice' })
    const s = await bookAs(t, f, slotAt(t, 15 * 60))
    await moveToPast(s.id); await complete(t, s.id)
    const inv = await createInvoice(prisma, t.profile.id, { familyId: f.family.id, sessionIds: [s.id] })
    await refuses(() => createInvoice(prisma, t.profile.id, { familyId: f.family.id, sessionIds: [s.id] }), /already on an invoice/)
    await sendInvoice(prisma, t.profile.id, inv.id)
    await refuses(() => addInvoiceLine(prisma, t.profile.id, inv.id, { description: 'Extra', unitCents: 100 }), /cannot be changed/)
    await voidInvoice(prisma, t.profile.id, inv.id)
    const again = await createInvoice(prisma, t.profile.id, { familyId: f.family.id, sessionIds: [s.id] })
    await sendInvoice(prisma, t.profile.id, again.id)
    const total = (await prisma.invoice.findUniqueOrThrow({ where: { id: again.id } })).totalCents
    await refuses(() => recordPayment(prisma, t.profile.id, { target: { kind: 'invoice', id: again.id }, amountCents: total + 1, method: 'cash' }), /up to what is owed/)
    await recordPayment(prisma, t.profile.id, { target: { kind: 'invoice', id: again.id }, amountCents: total - 500, method: 'cash' })
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: again.id } })).status, 'sent')
    await refuses(() => recordPayment(prisma, t.profile.id, { target: { kind: 'invoice', id: again.id }, amountCents: 501, method: 'cash' }), /up to what is owed/)
    await recordPayment(prisma, t.profile.id, { target: { kind: 'invoice', id: again.id }, amountCents: 500, method: 'cash' })
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: again.id } })
    assert.equal(paid.status, 'paid'); assert.equal(paid.paidCents, total)

    // Parallel creates get unique numbers.
    const fams = await Promise.all(Array.from({ length: 6 }, () => makeFamily(t, { billingMode: 'invoice' })))
    const made = await Promise.allSettled(fams.map((x) => createInvoice(prisma, t.profile.id, { familyId: x.family.id, extraLines: [{ description: 'Materials', unitCents: 1500 }] })))
    const ok = made.filter((m) => m.status === 'fulfilled').length
    assert.equal(ok, 6, 'the billing lock serialises them; none fails')
    const numbers = (await prisma.invoice.findMany({ where: { profileId: t.profile.id }, select: { number: true } })).map((i) => i.number)
    assert.equal(new Set(numbers).size, numbers.length, 'numbers are unique')
  })

  test('13. flat monthly: one line for the month whatever the session count; never billed twice', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { billingMode: 'flat_monthly', monthlyFeeCents: 32000 })
    for (const m of [15, 16, 17]) { const s = await bookAs(t, f, slotAt(t, m * 60)); assert.equal(s.funding, 'flat'); await moveToPast(s.id, 2 + m); await complete(t, s.id) }
    const inv = await createInvoice(prisma, t.profile.id, { familyId: f.family.id, includeFlatFee: true })
    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId: inv.id } })
    assert.equal(lines.length, 1); assert.equal(lines[0].totalCents, 32000)
    await refuses(() => createInvoice(prisma, t.profile.id, { familyId: f.family.id, includeFlatFee: true }), /nothing to invoice|already/)
  })

  test('14. a reported payment changes nothing until confirmed; reject leaves the invoice unpaid', async () => {
    const t = await makeTutor()
    const f = await makeFamily(t, { billingMode: 'invoice' })
    const inv = await createInvoice(prisma, t.profile.id, { familyId: f.family.id, extraLines: [{ description: 'Four lessons', unitCents: 24000 }] })
    await sendInvoice(prisma, t.profile.id, inv.id)
    const r1 = await reportPayment(prisma, t.profile.id, f.family.id, { target: { kind: 'invoice', id: inv.id }, amountCents: 24000, method: 'bank_transfer', reference: 'BANK-88' })
    let row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })
    assert.equal(row.status, 'sent'); assert.equal(row.paidCents, 0)
    await rejectPayment(prisma, t.profile.id, r1.id, 'Not in the bank')
    row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })
    assert.equal(row.status, 'sent'); assert.equal(row.paidCents, 0)
    const r2 = await reportPayment(prisma, t.profile.id, f.family.id, { target: { kind: 'invoice', id: inv.id }, amountCents: 24000, method: 'bank_transfer', reference: 'BANK-89' })
    await confirmPayment(prisma, t.profile.id, r2.id)
    row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })
    assert.equal(row.status, 'paid'); assert.equal(row.paidCents, 24000)
  })
})
