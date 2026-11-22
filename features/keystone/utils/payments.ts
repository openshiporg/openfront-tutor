import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

import { createPayment, getPaymentStatus, refundPayment as adapterRefund } from './paymentProviderAdapter'
import { CommandError, guarded, lockTutorBilling, lockTutorBooking, transaction, type Db } from './business'
import { grantMinutes } from './ledger'

/**
 * Card money (Barber `settleDeposit` / `refundDeposit`, adapted to three
 * targets). Amounts are read back from Stripe, never from the browser; a
 * PaymentSession is claimed with a guarded update so a webhook and a browser
 * return can never both record it; refunds claim first, call Stripe, and
 * restore the row if Stripe refuses.
 */

export type Target = 'session' | 'package' | 'invoice'

export function stripeOn() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** The tutor's card provider when the Stripe key is set. Created on first use, like setup does. */
export async function cardProvider(db: Db, profileId: string) {
  if (!stripeOn()) return null
  const found = await db.paymentProvider.findFirst({ where: { profileId, code: 'pp_stripe' } })
  if (found) return found.isInstalled ? found : null
  return db.paymentProvider.create({ data: { profileId, ...STRIPE_PROVIDER } })
}

const fns = (code: string) => ({ createPaymentFunction: code, capturePaymentFunction: code, refundPaymentFunction: code, getPaymentStatusFunction: code, generatePaymentLinkFunction: code, handleWebhookFunction: code })
export const MANUAL_PROVIDER = { name: 'Paid to the tutor directly', code: 'pp_manual', isInstalled: true, ...fns('manual') }
export const STRIPE_PROVIDER = { name: 'Card (Stripe)', code: 'pp_stripe', isInstalled: true, ...fns('stripe') }

/** Opens a Stripe Checkout for one target and records its PaymentSession. Network call: never inside a transaction. */
export async function openCheckout(prisma: PrismaClient, input: {
  profile: { id: string; currencyCode: string }
  target: Target
  targetId: string
  amountCents: number
  description: string
  email?: string | null
  backUrl: string
  holdEndsAt?: Date | null
}) {
  const db = guarded(prisma)
  if (input.amountCents <= 0) throw new CommandError('There is nothing to pay.')
  const provider = await cardProvider(db, input.profile.id)
  if (!provider) throw new CommandError('Card payments are not set up. Pay your tutor directly.')
  // Stripe allows 30 minutes to 24 hours; a held session's page closes when the hold ends.
  const end = input.holdEndsAt ? input.holdEndsAt.getTime() : Date.now() + 23.5 * 3_600_000
  const expiresAt = new Date(Math.min(Math.max(end, Date.now() + 31 * 60_000), Date.now() + 23.5 * 3_600_000))
  const join = input.backUrl.includes('?') ? '&' : '?'
  const result = await createPayment({
    provider: { code: provider.code }, amount: input.amountCents, currency: input.profile.currencyCode.toLowerCase(),
    description: input.description.slice(0, 200), idempotencyKey: randomUUID(), customerEmail: input.email ?? '',
    successUrl: `${input.backUrl}${join}paid=1`, cancelUrl: `${input.backUrl}${join}paid=0`,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
    metadata: { target: input.target, targetId: input.targetId, profileId: input.profile.id },
  }) as { id?: string; url?: string | null }
  if (!result.id || !result.url) throw new CommandError('The card page did not open. Try again.')
  await db.paymentSession.create({
    data: {
      profileId: input.profile.id, target: input.target, paymentProviderId: provider.id, amountCents: input.amountCents,
      currencyCode: input.profile.currencyCode, providerPaymentId: result.id, expiresAt,
      ...(input.target === 'session' ? { sessionId: input.targetId } : input.target === 'package' ? { purchaseId: input.targetId } : { invoiceId: input.targetId }),
    },
  })
  return { url: result.url, checkoutId: result.id }
}

type PendingRow = { id: string; profileId: string; target: string; amountCents: number; currencyCode: string; providerPaymentId: string; sessionId: string | null; purchaseId: string | null; invoiceId: string | null; paymentProvider: { code: string } | null }

/** Reads every open Checkout of one target back from Stripe and records what was paid. */
export async function settleTarget(prisma: PrismaClient, target: Target, targetId: string) {
  if (!stripeOn()) return { paid: false }
  const db = guarded(prisma)
  const where = target === 'session' ? { sessionId: targetId } : target === 'package' ? { purchaseId: targetId } : { invoiceId: targetId }
  // A Checkout we closed early can still be paid at Stripe until it expires there.
  const rows = await db.paymentSession.findMany({ where: { ...where, OR: [{ status: 'pending' }, { status: 'cancelled', expiresAt: { gt: new Date(Date.now() - 3_600_000) } }] }, include: { paymentProvider: { select: { code: true } } }, take: 10 })
  let paid = false
  for (const row of rows as PendingRow[]) {
    if (await settleCheckout(prisma, row).catch((e) => { console.error('[tutor] settle failed', e instanceof Error ? e.message : e); return false })) paid = true
  }
  return { paid }
}

/** Settles one Checkout by its Stripe id (webhook and browser return use this). */
export async function settleCheckoutById(prisma: PrismaClient, checkoutId: string) {
  const db = guarded(prisma)
  const row = await db.paymentSession.findFirst({ where: { providerPaymentId: checkoutId }, include: { paymentProvider: { select: { code: true } } } })
  if (!row) return false
  if (row.status === 'captured' || row.status === 'refunded') return true
  // A Checkout we closed (hold ended, booking cancelled) can still be paid at Stripe; record it and refund it.
  return settleCheckout(prisma, row as PendingRow)
}

async function settleCheckout(prisma: PrismaClient, row: PendingRow): Promise<boolean> {
  if (!row.providerPaymentId || !row.paymentProvider) return false
  const result = await getPaymentStatus({ provider: { code: row.paymentProvider.code }, paymentId: row.providerPaymentId }) as { status?: string; amount?: number; currency?: string | null }
  if (result.status === 'expired') {
    await guarded(prisma).paymentSession.updateMany({ where: { id: row.id, status: { in: ['pending', 'cancelled'] } }, data: { status: 'expired' } })
    return false
  }
  if (result.status !== 'captured') return false
  // §9.9: the amount and currency must be the ones we asked for.
  if (Number(result.amount) !== row.amountCents || String(result.currency || '').toLowerCase() !== row.currencyCode.toLowerCase()) {
    console.error('[tutor] checkout amount or currency mismatch', row.id)
    return false
  }
  let refundAfter: string | null = null
  const recorded = await transaction(prisma, async (tx) => {
    // Same lock order as booking and billing, so settlement never races a cancel or an invoice payment.
    await lockTutorBooking(tx, row.profileId)
    await lockTutorBilling(tx, row.profileId)
    const claimed = await tx.paymentSession.updateMany({ where: { id: row.id, status: { in: ['pending', 'expired', 'cancelled'] } }, data: { status: 'captured', capturedAt: new Date() } })
    if (!claimed.count) return false
    const base = { profileId: row.profileId, method: 'stripe' as const, status: 'confirmed' as const, amountCents: row.amountCents, currencyCode: row.currencyCode, providerReference: row.providerPaymentId, paidAt: new Date(), decidedAt: new Date() }
    if (row.target === 'session' && row.sessionId) {
      const s = await tx.session.findUnique({ where: { id: row.sessionId }, select: { id: true, status: true, familyId: true } })
      if (!s) return false
      const payment = await tx.payment.create({ data: { ...base, kind: 'session', sessionId: s.id, familyId: s.familyId } })
      if (s.status === 'pending_payment' || s.status === 'scheduled' || s.status === 'completed') {
        await tx.session.update({ where: { id: s.id }, data: { paymentStatus: 'paid', ...(s.status === 'pending_payment' ? { status: 'scheduled', holdEndsAt: null } : {}) } })
      } else {
        // Paid after the hold released or the session was cancelled: record it, then refund it.
        await tx.session.update({ where: { id: s.id }, data: { paymentStatus: 'paid' } })
        refundAfter = payment.id
      }
      return true
    }
    if (row.target === 'package' && row.purchaseId) {
      const p = await tx.packagePurchase.findUnique({ where: { id: row.purchaseId }, include: { package: { select: { validMonths: true } } } })
      if (!p) return false
      const payment = await tx.payment.create({ data: { ...base, kind: 'package', purchaseId: p.id, familyId: p.familyId } })
      const activated = await activatePurchase(tx, p, row.amountCents)
      if (!activated) refundAfter = payment.id
      return true
    }
    if (row.target === 'invoice' && row.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: row.invoiceId } })
      if (!inv) return false
      const payment = await tx.payment.create({ data: { ...base, kind: 'invoice', invoiceId: inv.id, familyId: inv.familyId } })
      const applied = await applyInvoicePayment(tx, inv.id, row.amountCents)
      if (!applied) refundAfter = payment.id
      return true
    }
    return false
  })
  if (refundAfter) await refundPaymentRow(prisma, refundAfter, null, 'Paid after it was no longer due').catch((e) => console.error('[tutor] late payment refund failed', e instanceof Error ? e.message : e))
  return recorded
}

/** An awaiting purchase becomes active with its minutes. Returns false if it can no longer be activated. */
export async function activatePurchase(tx: Parameters<Parameters<typeof transaction>[1]>[0], p: { id: string; profileId: string; minutesGranted: number; package?: { validMonths: number } | null }, paidCents: number) {
  const months = p.package?.validMonths ?? 12
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months)
  const done = await tx.packagePurchase.updateMany({ where: { id: p.id, status: 'awaiting_payment' }, data: { status: 'active', minutesRemaining: p.minutesGranted, pricePaidCents: paidCents, purchasedAt: now, expiresAt } })
  if (!done.count) return false
  await grantMinutes(tx, p)
  return true
}

/** Adds a confirmed payment to an invoice. Refuses overpayment and a voided or draft invoice. */
export async function applyInvoicePayment(tx: Parameters<Parameters<typeof transaction>[1]>[0], invoiceId: string, cents: number) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true, totalCents: true, paidCents: true } })
  if (!inv || inv.status !== 'sent' || inv.paidCents + cents > inv.totalCents) return false
  const paid = inv.paidCents + cents
  const done = await tx.invoice.updateMany({ where: { id: inv.id, status: 'sent', paidCents: inv.paidCents }, data: { paidCents: paid, ...(paid >= inv.totalCents ? { status: 'paid' } : {}) } })
  return done.count === 1
}

/**
 * Refunds part or all of a confirmed payment. Card refunds go through Stripe:
 * claim the amount first, call Stripe, restore on failure. Other methods are
 * recorded (the tutor gave the money back by hand).
 */
export async function refundPaymentRow(prisma: PrismaClient, paymentId: string, amountCents: number | null, note: string) {
  const db = guarded(prisma)
  const p = await db.payment.findUnique({ where: { id: paymentId } })
  if (!p || p.kind === 'refund') throw new CommandError('Choose a payment to refund.')
  if (!['confirmed', 'partially_refunded'].includes(p.status)) throw new CommandError('Only a confirmed payment can be refunded.')
  const left = p.amountCents - p.refundedCents - p.refundPendingCents
  const amount = amountCents == null ? left : amountCents
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new CommandError('There is nothing left to refund on this payment.')
  if (amount > left) throw new CommandError('A refund cannot be more than what was paid.')
  const n = p.refundCount + 1
  const claimed = await db.payment.updateMany({ where: { id: p.id, refundedCents: p.refundedCents, refundPendingCents: p.refundPendingCents, refundCount: p.refundCount }, data: { refundPendingCents: { increment: amount }, refundCount: n } })
  if (!claimed.count) throw new CommandError('This payment changed. Refresh and try again.')
  let providerReference = ''
  if (p.method === 'stripe') {
    try {
      const r = await adapterRefund({ provider: { code: 'pp_stripe' }, paymentId: p.providerReference, amount, idempotencyKey: `refund-${p.id}-${n}` }) as { data?: { id?: string } }
      providerReference = r?.data?.id ?? ''
    } catch (error) {
      await db.payment.updateMany({ where: { id: p.id }, data: { refundPendingCents: { decrement: amount } } })
      console.error('[tutor] stripe refund failed', error instanceof Error ? error.message : error)
      throw new CommandError('Stripe did not accept the refund. Nothing was changed; try again.')
    }
  }
  const refunded = p.refundedCents + amount
  await transaction(prisma, async (tx) => {
    await tx.payment.update({ where: { id: p.id }, data: { refundPendingCents: { decrement: amount }, refundedCents: { increment: amount }, status: refunded >= p.amountCents ? 'refunded' : 'partially_refunded' } })
    await tx.payment.create({ data: { profileId: p.profileId, familyId: p.familyId, sessionId: p.sessionId, purchaseId: p.purchaseId, invoiceId: p.invoiceId, refundOfId: p.id, kind: 'refund', method: p.method, status: 'confirmed', amountCents: amount, currencyCode: p.currencyCode, providerReference, paidAt: new Date(), decidedAt: new Date(), note: note.slice(0, 300) } })
    if (p.sessionId) await tx.session.update({ where: { id: p.sessionId }, data: { paymentStatus: refunded >= p.amountCents ? 'refunded' : 'part_refunded' } })
    if (p.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: p.invoiceId }, select: { paidCents: true, totalCents: true, status: true } })
      if (inv && inv.status !== 'void') await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidCents: Math.max(0, inv.paidCents - amount), ...(inv.status === 'paid' ? { status: 'sent' } : {}) } })
    }
  })
  return { refundedCents: amount, method: p.method }
}

/** Card money a session has taken and not yet refunded. */
export async function sessionCardPayment(db: Db, sessionId: string) {
  return db.payment.findFirst({ where: { sessionId, kind: 'session', method: 'stripe', status: { in: ['confirmed', 'partially_refunded'] } }, orderBy: { createdAt: 'asc' } })
}

/** Closes open Checkouts of a target (the hold ended or the booking was cancelled). */
export async function expireOpenCheckouts(db: Db, target: Target, targetId: string) {
  const where = target === 'session' ? { sessionId: targetId } : target === 'package' ? { purchaseId: targetId } : { invoiceId: targetId }
  await db.paymentSession.updateMany({ where: { ...where, status: 'pending' }, data: { status: 'cancelled' } })
}
