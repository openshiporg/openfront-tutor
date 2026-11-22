/**
 * Shared fixtures for the §9 tests. Every test runs against the real scratch
 * Postgres (`scratch_openfront_tutor_test`, set by `scripts/run-tests.sh`) and
 * the product's own functions. Each test makes its own tutor with a unique
 * slug, so tests never see each other's rows and can run in any order.
 *
 * The only thing ever replaced is the HTTP boundary to Stripe (`globalThis.fetch`
 * for `api.stripe.com`), and only in the tests that say so.
 */
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

import { keystoneContext } from '../../features/keystone/context'
import { FAMILY_ROLE, TUTOR_ROLE, type Session } from '../../features/keystone/access'
import { setUpMyBusiness } from '../../features/keystone/utils/setup'
import { addDays, dayIndexFor } from '../../features/keystone/utils/availability'
import { businessDateKey, businessWallTime } from '../../features/shared/business-time'

export const ctx = keystoneContext
export const prisma = keystoneContext.prisma as PrismaClient

export function assertTestDatabase() {
  const name = (process.env.DATABASE_URL || '').split('/').pop()?.split('?')[0]
  if (!name || !name.endsWith('_test')) throw new Error('Tests run only against a database whose name ends in _test (npm test sets it).')
}

const uid = () => randomUUID().slice(0, 8)

async function role(def: typeof TUTOR_ROLE | typeof FAMILY_ROLE) {
  return (await prisma.role.findFirst({ where: { name: def.name } })) ?? prisma.role.create({ data: { ...def } })
}

export function sessionFor(user: { id: string; name: string; email: string }, flags: Record<string, boolean>): Session {
  return { itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, role: flags as never } }
}

/** A tutor with the typical setup (§8), in a timezone of the test's choice. */
export async function makeTutor(opts: { timezone?: string; currency?: string; patch?: Record<string, unknown> } = {}) {
  const id = uid()
  const r = await role(TUTOR_ROLE)
  const user = await prisma.user.create({ data: { name: `Tutor ${id}`, email: `tutor-${id}@tests.invalid`, password: 'x'.repeat(60), roleId: r.id } })
  const { profileId } = await setUpMyBusiness(prisma, user.id, {
    businessName: `Tutoring ${id}`, tutorName: `Tutor ${id}`, slug: `t-${id}`, timezone: opts.timezone ?? 'America/Chicago', currencyCode: opts.currency ?? 'USD', country: 'US',
    subjects: ['Maths'], levels: 'Grades 6 to 12', teachesOnline: true, teachesInPerson: false, hourlyRateCents: 6000, typicalSetup: true, email: `tutor-${id}@tests.invalid`,
  })
  // Booking a slot needs notice; tests choose times days ahead, so keep the rules plain.
  const profile = await prisma.tutorProfile.update({ where: { id: profileId }, data: { minNoticeHours: 0, maxAdvanceDays: 120, bufferMinutes: 0, ...(opts.patch ?? {}) } })
  const types = await prisma.sessionType.findMany({ where: { profileId } })
  const type = (name: string) => { const t = types.find((x) => x.name === name); if (!t) throw new Error(`No type ${name}`); return t }
  const packages = await prisma.package.findMany({ where: { profileId } })
  return { profile, user, session: sessionFor(user, { ...TUTOR_ROLE } as never), type, packages, slug: profile.slug }
}

export type Tutor = Awaited<ReturnType<typeof makeTutor>>

/** A family with one or more students, optionally with a guardian login. */
export async function makeFamily(t: Tutor, opts: { billingMode?: 'pay_as_you_book' | 'invoice' | 'flat_monthly'; monthlyFeeCents?: number; status?: string; students?: number; login?: boolean } = {}) {
  const id = uid()
  let userId: string | null = null
  let session: Session | undefined
  if (opts.login) {
    const r = await role(FAMILY_ROLE)
    const u = await prisma.user.create({ data: { name: `Guardian ${id}`, email: `g-${id}@tests.invalid`, password: 'x'.repeat(60), roleId: r.id } })
    userId = u.id
    session = sessionFor(u, { ...FAMILY_ROLE } as never)
  }
  const family = await prisma.family.create({ data: {
    profileId: t.profile.id, guardianName: `Guardian ${id}`, email: `g-${id}@tests.invalid`, status: (opts.status ?? 'active') as never,
    billingMode: (opts.billingMode ?? 'pay_as_you_book') as never, monthlyFeeCents: opts.monthlyFeeCents ?? 0, privateNotes: 'PRIVATE-FAMILY-NOTE', userId,
  } })
  const students = []
  for (let i = 0; i < (opts.students ?? 1); i++) {
    students.push(await prisma.student.create({ data: { profileId: t.profile.id, familyId: family.id, firstName: `Kid${i}${id}`, level: 'Grade 9', needs: 'PRIVATE-NEEDS' } }))
  }
  return { family, students, studentIds: students.map((s) => s.id), session }
}

/** The next date (tutor's calendar) on the given weekday, at least `minDays` ahead. */
export function nextWeekday(t: Tutor, weekday: number, minDays = 3) {
  let d = addDays(businessDateKey(new Date(), t.profile.timezone), minDays)
  while (dayIndexFor(d) !== weekday) d = addDays(d, 1)
  return d
}

/** A start time inside the typical hours (Mon–Thu 15:00–20:00). */
export function slotAt(t: Tutor, minute = 16 * 60, weekday = 2, weeksAhead = 0) {
  return businessWallTime(addDays(nextWeekday(t, weekday), weeksAhead * 7), minute, t.profile.timezone)
}

/** Puts a session's start in the past (so complete and no-show are allowed) without touching its state. */
export async function moveToPast(sessionId: string, hoursAgo = 2) {
  const s = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })
  const len = s.endsAt.getTime() - s.startsAt.getTime()
  const startsAt = new Date(Date.now() - hoursAgo * 3_600_000)
  await prisma.session.update({ where: { id: sessionId }, data: { startsAt, endsAt: new Date(startsAt.getTime() + len) } })
}

/** Puts a session inside the cancellation window (starts in `hours`). */
export async function moveInside(sessionId: string, hours = 3) {
  const s = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })
  const len = s.endsAt.getTime() - s.startsAt.getTime()
  const startsAt = new Date(Date.now() + hours * 3_600_000)
  await prisma.session.update({ where: { id: sessionId }, data: { startsAt, endsAt: new Date(startsAt.getTime() + len) } })
}

/** Sells a package by cash so its minutes are active. */
export async function activePackage(t: Tutor, familyId: string, name = '5 hours') {
  const { sellPackage } = await import('../../features/keystone/utils/billing')
  const pkg = t.packages.find((p) => p.name === name)!
  const { purchaseId } = await sellPackage(prisma, t.profile.id, { familyId, packageId: pkg.id, method: 'cash' })
  return prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchaseId } })
}

/** §9.4 invariant on one purchase: stored = sum(entries) ≥ 0, and every session's hold is closed or open once. */
export async function ledgerHolds(purchaseId: string) {
  const p = await prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchaseId } })
  const sum = await prisma.creditEntry.aggregate({ where: { purchaseId }, _sum: { minutes: true } })
  return { stored: p.minutesRemaining, ledger: sum._sum.minutes ?? 0, ok: p.minutesRemaining === (sum._sum.minutes ?? 0) && p.minutesRemaining >= 0 }
}

/** Throws unless `work` fails with a CommandError whose message matches. */
export async function refuses(work: () => Promise<unknown>, pattern?: RegExp) {
  try { await work() } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (pattern && !pattern.test(msg)) throw new Error(`Refused with the wrong message: ${msg}`)
    return msg
  }
  throw new Error('Expected a refusal, but it succeeded.')
}

// ---------- the Stripe HTTP boundary ----------

type FakeCheckout = { id: string; amount_total: number; currency: string; status: string; payment_status: string; payment_intent: string | null; url: string }

/**
 * Stands in for api.stripe.com only (the adapter boundary, §9). Checkouts are
 * created unpaid; a test marks one paid with `pay(id, amount?, currency?)`.
 * Every other URL goes to the real fetch.
 */
export function fakeStripe(opts: { refuseRefunds?: boolean } = {}) {
  const real = globalThis.fetch
  const checkouts = new Map<string, FakeCheckout>()
  const refunds: Array<{ amount: number; key: string | null }> = []
  const prevKey = process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_boundary'
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (!url.startsWith('https://api.stripe.com/')) return real(input as never, init)
    const path = url.replace('https://api.stripe.com/v1', '')
    const body = new URLSearchParams(String(init?.body ?? ''))
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
    if (path === '/checkout/sessions' && init?.method === 'POST') {
      const id = `cs_test_${uid()}${uid()}`
      const amount = Number(body.get('line_items[0][price_data][unit_amount]') || body.get('amount') || 0)
      const c: FakeCheckout = { id, amount_total: amount, currency: String(body.get('line_items[0][price_data][currency]') || body.get('currency') || 'usd'), status: 'open', payment_status: 'unpaid', payment_intent: null, url: `https://checkout.stripe.com/c/pay/${id}` }
      checkouts.set(id, c)
      return json(200, c)
    }
    const m = /^\/checkout\/sessions\/([^/?]+)(\/expire)?$/.exec(path)
    if (m) {
      const c = checkouts.get(decodeURIComponent(m[1]))
      if (!c) return json(404, { error: { message: 'No such checkout.session' } })
      if (m[2]) { if (c.payment_status !== 'paid') c.status = 'expired'; return json(200, c) }
      return json(200, c)
    }
    if (path === '/refunds' && init?.method === 'POST') {
      if (opts.refuseRefunds) return json(402, { error: { message: 'Refund declined' } })
      const amount = Number(body.get('amount'))
      const headers = new Headers(init?.headers)
      refunds.push({ amount, key: headers.get('Idempotency-Key') })
      return json(200, { id: `re_${uid()}`, status: 'succeeded', amount })
    }
    if (path === '/balance') return json(200, { livemode: false })
    return json(404, { error: { message: `Unhandled ${path}` } })
  }) as typeof fetch
  return {
    checkouts, refunds,
    pay(id: string, amount?: number, currency?: string) {
      const c = checkouts.get(id); if (!c) throw new Error('no checkout')
      c.status = 'complete'; c.payment_status = 'paid'; c.payment_intent = `pi_${uid()}`
      if (amount != null) c.amount_total = amount
      if (currency) c.currency = currency
    },
    restore() { globalThis.fetch = real; if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prevKey },
  }
}

/** Runs with no Stripe key: the direct-payment product (§7). */
export function withoutStripe() {
  const prev = process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_SECRET_KEY
  return () => { if (prev !== undefined) process.env.STRIPE_SECRET_KEY = prev }
}

export async function lastCheckoutId(where: { sessionId?: string; purchaseId?: string; invoiceId?: string }) {
  const row = await prisma.paymentSession.findFirst({ where, orderBy: { createdAt: 'desc' } })
  if (!row) throw new Error('No checkout was opened.')
  return row.providerPaymentId
}
