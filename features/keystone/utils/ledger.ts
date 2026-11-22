import { CommandError, type Tx } from './business'

/**
 * The prepaid minutes ledger (§4.2), composed from Gym's membership-credits
 * (reserve, commit, release, reverse; keyed entries; never a decrement-only
 * counter). Every function runs inside the caller's tutor-locked transaction
 * and makes no provider call.
 *
 * Each `CreditEntry` carries two signed numbers:
 *   minutes     the change to the purchase balance (sum = minutesRemaining)
 *   heldChange  the change to what its session holds (+ hold, − release/debit)
 *
 *   hold      minutes −m  heldChange +m
 *   release   minutes +m  heldChange −m
 *   debit     minutes  0  heldChange −m
 *   reversal  minutes +m  heldChange  0   (excused charge returned)
 *   reopen    kind hold, minutes 0, heldChange +m  (debit back to a hold)
 *   expire / refund / adjustment: balance only, heldChange 0
 */

type Purchase = { id: string; profileId: string; minutesRemaining: number; status: string; expiresAt: Date | null }

async function entryKey(tx: Tx, sessionId: string | null, purchaseId: string, kind: string) {
  const n = await tx.creditEntry.count({ where: { purchaseId, ...(sessionId ? { sessionId } : { sessionId: null }) } })
  return `${purchaseId}:${sessionId ?? 'none'}:${kind}:${n + 1}`
}

async function write(tx: Tx, p: { profileId: string; purchaseId: string; sessionId?: string | null; kind: string; minutes: number; heldChange?: number; note?: string }) {
  await tx.creditEntry.create({
    data: {
      profileId: p.profileId, purchaseId: p.purchaseId, sessionId: p.sessionId ?? null, kind: p.kind as never,
      minutes: p.minutes, heldChange: p.heldChange ?? 0, note: p.note ?? '',
      key: await entryKey(tx, p.sessionId ?? null, p.purchaseId, p.kind),
    },
  })
}

/** Minutes the session holds on a purchase right now (from the entries, never a counter). */
export async function heldFor(tx: Tx, sessionId: string) {
  const rows = await tx.creditEntry.findMany({ where: { sessionId }, select: { purchaseId: true, heldChange: true, minutes: true, kind: true }, take: 200 })
  const purchaseId = rows[0]?.purchaseId ?? null
  const held = rows.reduce((sum, r) => sum + r.heldChange, 0)
  const debited = rows.filter((r) => r.kind === 'debit').reduce((s, r) => s - r.heldChange, 0)
  const returned = rows.filter((r) => r.kind === 'reversal').reduce((s, r) => s + r.minutes, 0)
  const reopened = rows.filter((r) => r.kind === 'hold' && r.minutes === 0).reduce((s, r) => s + r.heldChange, 0)
  return { purchaseId, held, charged: debited - returned - reopened }
}

/** Purchases past their expiry give up their free minutes. Held minutes wait for their session. */
export async function expirePurchases(tx: Tx, profileId: string, familyId?: string) {
  const now = new Date()
  const stale = await tx.packagePurchase.findMany({ where: { profileId, ...(familyId ? { familyId } : {}), status: 'active', expiresAt: { lte: now } }, select: { id: true, profileId: true, minutesRemaining: true }, take: 100 })
  for (const p of stale) {
    const claimed = await tx.packagePurchase.updateMany({ where: { id: p.id, status: 'active', minutesRemaining: p.minutesRemaining }, data: { status: 'expired', minutesRemaining: 0 } })
    if (!claimed.count) continue
    if (p.minutesRemaining > 0) await write(tx, { profileId: p.profileId, purchaseId: p.id, kind: 'expire', minutes: -p.minutesRemaining, note: 'Package expired' })
  }
}

/** Active, unexpired purchases of a family that cover a session type, soonest expiry first. */
export async function coveringPurchase(tx: Tx, input: { profileId: string; familyId: string; sessionTypeId: string; minutes: number }) {
  await expirePurchases(tx, input.profileId, input.familyId)
  const rows = await tx.packagePurchase.findMany({
    where: { profileId: input.profileId, familyId: input.familyId, status: 'active', minutesRemaining: { gte: input.minutes }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }], take: 20,
  })
  return rows.find((p) => {
    const ids = (p.appliesToIds || '').split(',').map((s) => s.trim()).filter(Boolean)
    return !ids.length || ids.includes(input.sessionTypeId)
  }) ?? null
}

/** Takes minutes for a session with a guarded decrement. Zero rows: not enough left. */
export async function holdMinutes(tx: Tx, purchase: Purchase, sessionId: string, minutes: number) {
  const done = await tx.packagePurchase.updateMany({
    where: { id: purchase.id, status: 'active', minutesRemaining: { gte: minutes }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    data: { minutesRemaining: { decrement: minutes } },
  })
  if (!done.count) throw new CommandError('Not enough time left on this package.')
  await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, sessionId, kind: 'hold', minutes: -minutes, heldChange: minutes })
  await markUsedUp(tx, purchase.id)
}

async function markUsedUp(tx: Tx, purchaseId: string) {
  await tx.packagePurchase.updateMany({ where: { id: purchaseId, status: 'active', minutesRemaining: 0 }, data: { status: 'used_up' } })
}

/** Returns minutes to a purchase. An expired or refunded purchase closes them again at once. */
async function giveBack(tx: Tx, profileId: string, purchaseId: string, sessionId: string, kind: 'release' | 'reversal', minutes: number, heldChange: number, note: string) {
  if (minutes <= 0) return
  await tx.packagePurchase.updateMany({ where: { id: purchaseId }, data: { minutesRemaining: { increment: minutes } } })
  await tx.packagePurchase.updateMany({ where: { id: purchaseId, status: 'used_up', minutesRemaining: { gt: 0 } }, data: { status: 'active' } })
  await write(tx, { profileId, purchaseId, sessionId, kind, minutes, heldChange, note })
  const p = await tx.packagePurchase.findUnique({ where: { id: purchaseId }, select: { status: true, expiresAt: true } })
  const closed = p && (['expired', 'refunded', 'cancelled'].includes(p.status) || (p.expiresAt && p.expiresAt <= new Date()))
  if (closed) {
    await tx.packagePurchase.updateMany({ where: { id: purchaseId }, data: { minutesRemaining: { decrement: minutes } } })
    await write(tx, { profileId, purchaseId, kind: 'expire', minutes: -minutes, note: 'Returned after the package closed' })
  }
}

/**
 * Settles what a session holds: `chargeMinutes` become a debit, the rest is
 * released. Charging 0 releases everything; charging all debits everything.
 */
export async function settleHold(tx: Tx, profileId: string, sessionId: string, chargeMinutes: number, note: string) {
  const { purchaseId, held } = await heldFor(tx, sessionId)
  if (!purchaseId || held <= 0) return { charged: 0, released: 0 }
  const charge = Math.max(0, Math.min(held, Math.floor(chargeMinutes)))
  if (charge > 0) await write(tx, { profileId, purchaseId, sessionId, kind: 'debit', minutes: 0, heldChange: -charge, note })
  if (held - charge > 0) await giveBack(tx, profileId, purchaseId, sessionId, 'release', held - charge, -(held - charge), note)
  return { charged: charge, released: held - charge }
}

/** Excusing a charge returns the debited minutes. */
export async function reverseCharge(tx: Tx, profileId: string, sessionId: string, note: string) {
  const { purchaseId, charged } = await heldFor(tx, sessionId)
  if (!purchaseId || charged <= 0) return 0
  await giveBack(tx, profileId, purchaseId, sessionId, 'reversal', charged, 0, note)
  return charged
}

/** A reopened session holds its debited minutes again (no balance change). */
export async function reopenDebit(tx: Tx, profileId: string, sessionId: string) {
  const { purchaseId, charged } = await heldFor(tx, sessionId)
  if (!purchaseId || charged <= 0) return 0
  await write(tx, { profileId, purchaseId, sessionId, kind: 'hold', minutes: 0, heldChange: charged, note: 'Session reopened' })
  return charged
}

export async function grantMinutes(tx: Tx, purchase: { id: string; profileId: string; minutesGranted: number }) {
  await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, kind: 'grant', minutes: purchase.minutesGranted, note: 'Package paid' })
}

export async function refundRemaining(tx: Tx, purchase: { id: string; profileId: string; minutesRemaining: number }, note: string) {
  const done = await tx.packagePurchase.updateMany({ where: { id: purchase.id, minutesRemaining: purchase.minutesRemaining, status: { in: ['active', 'used_up', 'expired'] } }, data: { minutesRemaining: 0, status: 'refunded' } })
  if (!done.count) throw new CommandError('This package changed. Refresh and try again.')
  if (purchase.minutesRemaining > 0) await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, kind: 'refund', minutes: -purchase.minutesRemaining, note })
}

export async function adjustMinutes(tx: Tx, purchase: { id: string; profileId: string }, minutes: number, note: string) {
  if (!Number.isSafeInteger(minutes) || minutes === 0) throw new CommandError('Enter the minutes to add or take away.')
  if (!note.trim()) throw new CommandError('Give a reason for the change.')
  const where = minutes < 0 ? { id: purchase.id, status: { in: ['active' as const] }, minutesRemaining: { gte: -minutes } } : { id: purchase.id, status: { in: ['active' as const, 'used_up' as const] } }
  const done = await tx.packagePurchase.updateMany({ where, data: { minutesRemaining: { increment: minutes } } })
  if (!done.count) throw new CommandError(minutes < 0 ? 'Not enough time left on this package.' : 'Only an active package can be changed.')
  await tx.packagePurchase.updateMany({ where: { id: purchase.id, status: 'used_up', minutesRemaining: { gt: 0 } }, data: { status: 'active' } })
  await write(tx, { profileId: purchase.profileId, purchaseId: purchase.id, kind: 'adjustment', minutes, note })
  await markUsedUp(tx, purchase.id)
}

/** §9.4 invariant: stored balance equals the entries and is never negative. */
export async function checkPurchase(tx: Tx, purchaseId: string) {
  const [p, sum] = await Promise.all([
    tx.packagePurchase.findUnique({ where: { id: purchaseId }, select: { minutesRemaining: true } }),
    tx.creditEntry.aggregate({ where: { purchaseId }, _sum: { minutes: true } }),
  ])
  return { stored: p?.minutesRemaining ?? 0, ledger: sum._sum.minutes ?? 0, ok: Boolean(p) && p!.minutesRemaining === (sum._sum.minutes ?? 0) && p!.minutesRemaining >= 0 }
}
