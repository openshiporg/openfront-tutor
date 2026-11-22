import type { PrismaClient } from '@prisma/client'

import { CommandError, cleanText, guarded, lockTutorBilling, lockTutorBooking, transaction, wholeCents, type Db, type Tx } from './business'
import { refundRemaining } from './ledger'
import { activatePurchase, applyInvoicePayment, refundPaymentRow } from './payments'
import { createPublicAccessToken } from './publicAccessToken'

/**
 * Invoices (§4.3, D8) and payments made outside the card (§4.4, D9). An
 * invoice is fixed once sent; a mistake is voided and issued again. Numbers,
 * lines and invoice payments are serialised by the tutor billing lock.
 */

const monthKey = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(d).slice(0, 7)

/** Sessions charged to the invoice and not on any live invoice, plus flat fees not yet billed, per family. */
export async function readyToInvoice(db: Db, profileId: string, familyId?: string) {
  const profile = await db.tutorProfile.findUniqueOrThrow({ where: { id: profileId } })
  const sessions = await db.session.findMany({
    where: { profileId, ...(familyId ? { familyId } : {}), funding: 'invoice', billable: 'yes', chargedCents: { gt: 0 }, invoiceLines: { none: { invoice: { status: { in: ['draft', 'sent', 'paid'] } } } } },
    select: { id: true, familyId: true, startsAt: true, typeNameSnapshot: true, chargedCents: true, status: true },
    orderBy: { startsAt: 'asc' }, take: 500,
  })
  const flat = await db.family.findMany({ where: { profileId, ...(familyId ? { id: familyId } : {}), billingMode: 'flat_monthly', monthlyFeeCents: { gt: 0 }, status: { in: ['active', 'paused'] } }, select: { id: true, monthlyFeeCents: true }, take: 500 })
  const month = monthKey(new Date(), profile.timezone)
  const billedFlat = new Set((await db.invoice.findMany({ where: { profileId, periodMonth: month, status: { in: ['draft', 'sent', 'paid'] } }, select: { familyId: true }, take: 1000 })).map((i) => i.familyId))
  const families = new Map<string, { familyId: string; sessions: typeof sessions; flatMonth: string | null; flatCents: number; totalCents: number }>()
  const entry = (id: string) => { if (!families.has(id)) families.set(id, { familyId: id, sessions: [], flatMonth: null, flatCents: 0, totalCents: 0 }); return families.get(id)! }
  for (const s of sessions) if (s.familyId) { const e = entry(s.familyId); e.sessions.push(s); e.totalCents += s.chargedCents }
  for (const f of flat) if (!billedFlat.has(f.id)) { const e = entry(f.id); e.flatMonth = month; e.flatCents = f.monthlyFeeCents; e.totalCents += f.monthlyFeeCents }
  const names = await db.family.findMany({ where: { id: { in: [...families.keys()] } }, select: { id: true, guardianName: true, billingMode: true } })
  return [...families.values()].map((e) => ({ ...e, guardianName: names.find((n) => n.id === e.familyId)?.guardianName ?? '', billingMode: names.find((n) => n.id === e.familyId)?.billingMode ?? '', sessions: e.sessions.map((s) => ({ ...s, startsAt: s.startsAt.toISOString() })) }))
}

async function recomputeTotals(tx: Tx, invoiceId: string) {
  const lines = await tx.invoiceLine.aggregate({ where: { invoiceId }, _sum: { totalCents: true } })
  const total = lines._sum.totalCents ?? 0
  await tx.invoice.updateMany({ where: { id: invoiceId, status: 'draft' }, data: { subtotalCents: total, totalCents: total } })
}

/** Draft totals after excuse or reopen removed a line. */
export async function recomputeDrafts(prisma: PrismaClient, profileId: string) {
  await transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const drafts = await tx.invoice.findMany({ where: { profileId, status: 'draft' }, select: { id: true }, take: 200 })
    for (const d of drafts) await recomputeTotals(tx, d.id)
  })
}

type ExtraLine = { description: string; quantity?: number; unitCents: number }

/** A draft for one family from what is ready: its sessions, the month's flat fee, and free lines. */
export async function createInvoice(prisma: PrismaClient, profileId: string, input: { familyId: string; sessionIds?: string[] | null; includeFlatFee?: boolean | null; extraLines?: ExtraLine[] | null; dueDays?: number | null; note?: string | null }) {
  return transaction(prisma, async (tx) => {
    // Booking first, then billing: the same order as settlement, so no deadlock.
    await lockTutorBooking(tx, profileId)
    await lockTutorBilling(tx, profileId)
    const profile = await tx.tutorProfile.findUniqueOrThrow({ where: { id: profileId } })
    const family = await tx.family.findFirst({ where: { id: input.familyId, profileId } })
    if (!family) throw new CommandError('Choose a family.')
    const ready = (await readyToInvoice(tx, profileId, family.id))[0]
    const wanted = input.sessionIds?.length ? new Set(input.sessionIds) : null
    const sessions = (ready?.sessions ?? []).filter((s) => !wanted || wanted.has(s.id))
    if (wanted && sessions.length !== wanted.size) throw new CommandError('One of those sessions is already on an invoice or is not charged.')
    const flat = input.includeFlatFee !== false && ready?.flatMonth ? { month: ready.flatMonth, cents: ready.flatCents } : null
    const extras = (input.extraLines ?? []).map((l) => {
      const description = cleanText(l.description, 200)
      if (!description) throw new CommandError('Each extra line needs a description.')
      const quantity = Math.floor(Number(l.quantity ?? 1))
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new CommandError('Quantity must be 1 or more.')
      const unit = wholeCents(l.unitCents, 'Line price')
      return { description, quantity, unitCents: unit, totalCents: unit * quantity }
    })
    if (!sessions.length && !flat && !extras.length) throw new CommandError('There is nothing to invoice for this family.')
    const counter = profile.invoiceCounter + 1
    const bumped = await tx.tutorProfile.updateMany({ where: { id: profileId, invoiceCounter: profile.invoiceCounter }, data: { invoiceCounter: counter } })
    if (!bumped.count) throw new CommandError('Try again.')
    const dueDays = input.dueDays == null ? profile.invoiceDueDays : Math.max(0, Math.min(90, Math.floor(input.dueDays)))
    const access = createPublicAccessToken()
    const invoice = await tx.invoice.create({
      data: {
        profileId, familyId: family.id, number: `INV-${String(counter).padStart(4, '0')}`, status: 'draft',
        dueAt: new Date(Date.now() + dueDays * 86_400_000), periodMonth: flat?.month ?? '', note: cleanText(input.note, 1000), publicAccessTokenHash: access.hash,
      },
    })
    let order = 0
    const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone, dateStyle: 'medium' }).format(new Date(d))
    for (const s of sessions) {
      await tx.invoiceLine.create({ data: { profileId, invoiceId: invoice.id, sessionId: s.id, description: `${s.typeNameSnapshot} · ${fmt(s.startsAt)}${s.status !== 'completed' ? ` (${s.status === 'no_show' ? 'no-show' : 'late cancellation'})` : ''}`, quantity: 1, unitCents: s.chargedCents, totalCents: s.chargedCents, sortOrder: order++ } })
    }
    if (flat) await tx.invoiceLine.create({ data: { profileId, invoiceId: invoice.id, description: `Monthly tutoring fee · ${flat.month}`, quantity: 1, unitCents: flat.cents, totalCents: flat.cents, sortOrder: order++ } })
    for (const l of extras) await tx.invoiceLine.create({ data: { profileId, invoiceId: invoice.id, ...l, sortOrder: order++ } })
    // §9.12: a session on two live invoices is refused even if two creates raced past the read.
    if (sessions.length) {
      const twice = await tx.invoiceLine.groupBy({ by: ['sessionId'], where: { sessionId: { in: sessions.map((s) => s.id) }, invoice: { status: { in: ['draft', 'sent', 'paid'] } } }, _count: { _all: true } })
      if (twice.some((g) => g._count._all > 1)) throw new CommandError('One of those sessions is already on an invoice.')
    }
    await recomputeTotals(tx, invoice.id)
    return { id: invoice.id, number: invoice.number, token: access.token }
  })
}

export async function addInvoiceLine(prisma: PrismaClient, profileId: string, invoiceId: string, line: ExtraLine) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const inv = await tx.invoice.findFirst({ where: { id: invoiceId, profileId } })
    if (!inv) throw new CommandError('Invoice not found.')
    if (inv.status !== 'draft') throw new CommandError('A sent invoice cannot be changed. Void it and issue a new one.')
    const description = cleanText(line.description, 200)
    if (!description) throw new CommandError('Enter a description.')
    const quantity = Math.max(1, Math.floor(Number(line.quantity ?? 1)))
    const unit = wholeCents(line.unitCents, 'Line price')
    const order = await tx.invoiceLine.count({ where: { invoiceId } })
    await tx.invoiceLine.create({ data: { profileId, invoiceId, description, quantity, unitCents: unit, totalCents: unit * quantity, sortOrder: order } })
    await recomputeTotals(tx, invoiceId)
    return { id: invoiceId }
  })
}

export async function removeInvoiceLine(prisma: PrismaClient, profileId: string, lineId: string) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const line = await tx.invoiceLine.findFirst({ where: { id: lineId, profileId }, include: { invoice: { select: { id: true, status: true } } } })
    if (!line?.invoice) throw new CommandError('Line not found.')
    if (line.invoice.status !== 'draft') throw new CommandError('A sent invoice cannot be changed. Void it and issue a new one.')
    await tx.invoiceLine.delete({ where: { id: line.id } })
    await recomputeTotals(tx, line.invoice.id)
    return { id: line.invoice.id }
  })
}

/** Sends a draft: its lines and total are now fixed. Returns a fresh private link. */
export async function sendInvoice(prisma: PrismaClient, profileId: string, invoiceId: string) {
  const access = createPublicAccessToken()
  const inv = await transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const inv = await tx.invoice.findFirst({ where: { id: invoiceId, profileId } })
    if (!inv) throw new CommandError('Invoice not found.')
    if (inv.status !== 'draft') throw new CommandError('This invoice was already sent.')
    if (inv.totalCents <= 0) throw new CommandError('An invoice must be for more than zero.')
    await tx.invoice.updateMany({ where: { id: inv.id, status: 'draft' }, data: { status: 'sent', issuedAt: new Date(), publicAccessTokenHash: access.hash } })
    return inv
  })
  return { ...inv, token: access.token }
}

/** Voids a draft or sent invoice with no confirmed payment. Its sessions can be invoiced again. */
export async function voidInvoice(prisma: PrismaClient, profileId: string, invoiceId: string) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const inv = await tx.invoice.findFirst({ where: { id: invoiceId, profileId } })
    if (!inv) throw new CommandError('Invoice not found.')
    if (!['draft', 'sent'].includes(inv.status)) throw new CommandError('Only an unpaid invoice can be voided.')
    if (inv.paidCents > 0) throw new CommandError('This invoice has payments on it. Refund them first.')
    await tx.invoice.updateMany({ where: { id: inv.id, status: inv.status }, data: { status: 'void', voidedAt: new Date() } })
    await tx.payment.updateMany({ where: { invoiceId: inv.id, status: 'reported' }, data: { status: 'rejected', decidedAt: new Date(), note: 'Invoice voided' } })
    return { id: inv.id, status: 'void' }
  })
}

// ---------- payments made outside the card ----------

const METHODS = ['cash', 'bank_transfer', 'mobile_money', 'other'] as const
type OfflineMethod = (typeof METHODS)[number]
export function offlineMethod(value: unknown): OfflineMethod {
  if (!METHODS.includes(value as OfflineMethod)) throw new CommandError('Choose how it was paid: cash, bank transfer, mobile money or other.')
  return value as OfflineMethod
}

type PayTarget = { kind: 'session' | 'package' | 'invoice'; id: string }

async function targetFor(tx: Tx, profileId: string, familyId: string | null, t: PayTarget) {
  if (t.kind === 'invoice') {
    const inv = await tx.invoice.findFirst({ where: { id: t.id, profileId, ...(familyId ? { familyId } : {}) } })
    if (!inv || inv.status !== 'sent') throw new CommandError('This invoice is not open for payment.')
    return { familyId: inv.familyId, invoiceId: inv.id, due: inv.totalCents - inv.paidCents }
  }
  if (t.kind === 'package') {
    const p = await tx.packagePurchase.findFirst({ where: { id: t.id, profileId, ...(familyId ? { familyId } : {}) } })
    if (!p || p.status !== 'awaiting_payment') throw new CommandError('This package is not waiting for payment.')
    return { familyId: p.familyId, purchaseId: p.id, due: p.pricePaidCents }
  }
  const s = await tx.session.findFirst({ where: { id: t.id, profileId, ...(familyId ? { familyId } : {}) } })
  if (!s || s.funding !== 'card' || s.paymentStatus !== 'unpaid' || !['scheduled', 'completed', 'late_cancelled', 'no_show'].includes(s.status)) throw new CommandError('This session has nothing to pay.')
  const due = ['late_cancelled', 'no_show'].includes(s.status) ? s.chargedCents : s.priceCents
  if (due <= 0) throw new CommandError('This session has nothing to pay.')
  return { familyId: s.familyId, sessionId: s.id, due }
}

/** Guardian says they paid (bank, mobile money). Changes nothing until the tutor confirms (§9.14). */
export async function reportPayment(prisma: PrismaClient, profileId: string, familyId: string, input: { target: PayTarget; amountCents: number; method: unknown; reference: string }) {
  const method = offlineMethod(input.method)
  const amount = wholeCents(input.amountCents, 'Amount')
  if (amount <= 0) throw new CommandError('Enter the amount you paid.')
  const reference = cleanText(input.reference, 120)
  if (!reference) throw new CommandError('Enter the reference from your bank or app so your tutor can find it.')
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const t = await targetFor(tx, profileId, familyId, input.target)
    if (amount > t.due) throw new CommandError('That is more than what is owed.')
    const open = await tx.payment.count({ where: { profileId, familyId, status: 'reported', ...(t.invoiceId ? { invoiceId: t.invoiceId } : t.purchaseId ? { purchaseId: t.purchaseId } : { sessionId: t.sessionId }) } })
    if (open >= 3) throw new CommandError('Your tutor has not yet checked your earlier reports.')
    const kind = input.target.kind
    const p = await tx.payment.create({ data: { profileId, familyId, invoiceId: t.invoiceId ?? null, purchaseId: t.purchaseId ?? null, sessionId: t.sessionId ?? null, kind, method, status: 'reported', amountCents: amount, reference, reportedByGuardian: true, paidAt: new Date() } })
    return { id: p.id, status: 'reported' }
  })
}

async function applyConfirmed(tx: Tx, p: { id: string; amountCents: number; invoiceId: string | null; purchaseId: string | null; sessionId: string | null }) {
  if (p.invoiceId) {
    if (!(await applyInvoicePayment(tx, p.invoiceId, p.amountCents))) throw new CommandError('That is more than what is owed on this invoice, or it is no longer open.')
  } else if (p.purchaseId) {
    const purchase = await tx.packagePurchase.findUnique({ where: { id: p.purchaseId }, include: { package: { select: { validMonths: true } } } })
    if (!purchase || p.amountCents < purchase.pricePaidCents) throw new CommandError('A package is activated when its full price is paid.')
    if (!(await activatePurchase(tx, purchase, p.amountCents))) throw new CommandError('This package is not waiting for payment.')
  } else if (p.sessionId) {
    await tx.session.update({ where: { id: p.sessionId }, data: { paymentStatus: 'paid' } })
  }
}

export async function confirmPayment(prisma: PrismaClient, profileId: string, paymentId: string) {
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const p = await tx.payment.findFirst({ where: { id: paymentId, profileId } })
    if (!p || p.status !== 'reported') throw new CommandError('This payment is not waiting for you.')
    const done = await tx.payment.updateMany({ where: { id: p.id, status: 'reported' }, data: { status: 'confirmed', decidedAt: new Date() } })
    if (!done.count) throw new CommandError('Already handled.')
    await applyConfirmed(tx, p)
    return { id: p.id, status: 'confirmed' }
  })
}

export async function rejectPayment(prisma: PrismaClient, profileId: string, paymentId: string, note: string) {
  const db = guarded(prisma)
  const done = await db.payment.updateMany({ where: { id: paymentId, profileId, status: 'reported' }, data: { status: 'rejected', decidedAt: new Date(), note: cleanText(note, 300) } })
  if (!done.count) throw new CommandError('This payment is not waiting for you.')
  return { id: paymentId, status: 'rejected' }
}

/** Tutor records money received by hand against a session, package or invoice. */
export async function recordPayment(prisma: PrismaClient, profileId: string, input: { target: PayTarget; amountCents?: number | null; method: unknown; reference?: string | null }) {
  const method = offlineMethod(input.method)
  return transaction(prisma, async (tx) => {
    await lockTutorBilling(tx, profileId)
    const t = await targetFor(tx, profileId, null, input.target)
    const amount = input.amountCents == null ? t.due : wholeCents(input.amountCents, 'Amount')
    if (amount <= 0 || amount > t.due) throw new CommandError('Enter an amount up to what is owed.')
    const p = await tx.payment.create({ data: { profileId, familyId: t.familyId, invoiceId: t.invoiceId ?? null, purchaseId: t.purchaseId ?? null, sessionId: t.sessionId ?? null, kind: input.target.kind, method, status: 'confirmed', amountCents: amount, reference: cleanText(input.reference, 120), paidAt: new Date(), decidedAt: new Date() } })
    await applyConfirmed(tx, p)
    return { id: p.id, status: 'confirmed', amountCents: amount }
  })
}

// ---------- packages ----------

/** A purchase waiting for payment (card or direct). Price and minutes are copied from the package now. */
export async function startPurchase(prisma: PrismaClient, profileId: string, familyId: string, packageId: string) {
  return transaction(prisma, async (tx) => {
    const pkg = await tx.package.findFirst({ where: { id: packageId, profileId, active: true }, include: { appliesTo: { select: { id: true } } } })
    if (!pkg) throw new CommandError('Choose a package.')
    const family = await tx.family.findFirst({ where: { id: familyId, profileId } })
    if (!family) throw new CommandError('Choose a family.')
    if (family.status === 'blocked') throw new CommandError('Contact your tutor to buy a package.')
    const waiting = await tx.packagePurchase.count({ where: { familyId, status: 'awaiting_payment' } })
    if (waiting >= 3) throw new CommandError('You have packages waiting for payment. Pay or ask your tutor to cancel them first.')
    return tx.packagePurchase.create({ data: { profileId, familyId, packageId: pkg.id, nameSnapshot: pkg.name, appliesToIds: pkg.appliesTo.map((t) => t.id).join(','), minutesGranted: pkg.minutes, minutesRemaining: 0, pricePaidCents: pkg.priceCents, status: 'awaiting_payment' } })
  })
}

/** Tutor sells a package by hand: paid now in cash or another way, active at once. */
export async function sellPackage(prisma: PrismaClient, profileId: string, input: { familyId: string; packageId: string; method: unknown; reference?: string | null }) {
  offlineMethod(input.method)
  const purchase = await startPurchase(prisma, profileId, input.familyId, input.packageId)
  if (purchase.pricePaidCents === 0) {
    await transaction(prisma, async (tx) => { await lockTutorBilling(tx, profileId); await activatePurchase(tx, { ...purchase, package: await tx.package.findUnique({ where: { id: input.packageId }, select: { validMonths: true } }) }, 0) })
    return { purchaseId: purchase.id }
  }
  await recordPayment(prisma, profileId, { target: { kind: 'package', id: purchase.id }, method: input.method, reference: input.reference })
  return { purchaseId: purchase.id }
}

/** Tutor cancels a package nobody paid for. */
export async function cancelPurchase(prisma: PrismaClient, profileId: string, purchaseId: string) {
  const db = guarded(prisma)
  const done = await db.packagePurchase.updateMany({ where: { id: purchaseId, profileId, status: 'awaiting_payment' }, data: { status: 'cancelled' } })
  if (!done.count) throw new CommandError('Only a package waiting for payment can be cancelled.')
  await db.payment.updateMany({ where: { purchaseId, status: 'reported' }, data: { status: 'rejected', decidedAt: new Date(), note: 'Package cancelled' } })
  await db.paymentSession.updateMany({ where: { purchaseId, status: 'pending' }, data: { status: 'cancelled' } })
  return { id: purchaseId }
}

/**
 * Refund of unused minutes, pro rata, rounded down (§4.2):
 * refundCents = pricePaid × minutesRemaining ÷ minutesGranted. Minutes held
 * by booked sessions are not refundable until those sessions settle.
 */
export async function refundPackage(prisma: PrismaClient, profileId: string, purchaseId: string) {
  // Claim: inside the booking lock the remaining minutes close (a `refund` entry), so no booking can take them.
  const claim = await transaction(prisma, async (tx) => {
    await lockTutorBooking(tx, profileId)
    const p = await tx.packagePurchase.findFirst({ where: { id: purchaseId, profileId } })
    if (!p || !['active', 'used_up', 'expired'].includes(p.status)) throw new CommandError('Only a paid package can be refunded.')
    const held = await tx.creditEntry.aggregate({ where: { purchaseId, sessionId: { not: null } }, _sum: { heldChange: true } })
    if ((held._sum.heldChange ?? 0) > 0) throw new CommandError('Some of these minutes are booked. Cancel or complete those sessions first.')
    const refundCents = p.minutesGranted > 0 ? Math.floor(((p.pricePaidCents - p.refundedCents) * p.minutesRemaining) / p.minutesGranted) : 0
    await refundRemaining(tx, p, 'Unused minutes refunded')
    return { p, refundCents }
  })
  const { p, refundCents } = claim
  // Call: the money moves (card through Stripe). Restore the minutes if it fails.
  const payments = await guarded(prisma).payment.findMany({ where: { purchaseId, kind: 'package', status: { in: ['confirmed', 'partially_refunded'] } }, orderBy: { createdAt: 'asc' }, take: 10 })
  let left = refundCents
  try {
    for (const pay of payments) {
      if (left <= 0) break
      const amount = Math.min(pay.amountCents - pay.refundedCents - pay.refundPendingCents, left)
      if (amount <= 0) continue
      await refundPaymentRow(prisma, pay.id, amount, `Unused package minutes (${p.minutesRemaining} of ${p.minutesGranted})`)
      left -= amount
    }
  } catch (error) {
    if (left === refundCents) {
      await transaction(prisma, async (tx) => {
        await lockTutorBooking(tx, profileId)
        await tx.packagePurchase.update({ where: { id: purchaseId }, data: { status: p.status, minutesRemaining: { increment: p.minutesRemaining } } })
        if (p.minutesRemaining > 0) await tx.creditEntry.create({ data: { profileId, purchaseId, kind: 'adjustment', minutes: p.minutesRemaining, note: 'Refund did not go through; minutes restored', key: `${purchaseId}:restore:${Date.now()}` } })
      })
    }
    throw error
  }
  await guarded(prisma).packagePurchase.update({ where: { id: purchaseId }, data: { refundedCents: { increment: refundCents - left } } })
  return { refundedCents: refundCents - left, minutes: p.minutesRemaining }
}
