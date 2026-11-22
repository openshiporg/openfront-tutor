import type { PrismaClient } from '@prisma/client'

import { keystoneContext } from '../context'
import { boundedRequestBytes, BoundedBodyError } from '../utils/bounded-body'
import { guarded } from '../utils/business'
import { settleCheckoutById } from '../utils/payments'
import { paymentWebhookPayloadHash, paymentWebhookReplayKey, verifyStripeSignature } from '../utils/paymentWebhookSecurity'

const MAX_WEBHOOK_BYTES = 1_000_000
const refuse = (status = 400) => Response.json({ success: false, error: 'Webhook was not accepted.' }, { status })

/**
 * Stripe webhook (Barbershop's route, Stripe's signature scheme). The event
 * only tells us which Checkout to look at: the money is still confirmed by
 * reading the Checkout Session back from Stripe, through the same settle
 * function as the browser return, so the two can never both record it.
 */
export async function handlePaymentWebhook(request: Request, providerCode: string) {
  if (providerCode !== 'stripe') return refuse(404)
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return refuse(404)
  if (Number(request.headers.get('content-length') || 0) > MAX_WEBHOOK_BYTES) return refuse(413)
  let raw: Uint8Array
  try { raw = await boundedRequestBytes(request, MAX_WEBHOOK_BYTES) } catch (e) { return refuse(e instanceof BoundedBodyError ? e.status : 400) }
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature') || '', secret)) return refuse(400)
  let event: { id?: string; type?: string; data?: { object?: { id?: string; object?: string } } }
  try { event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) } catch { return refuse(400) }
  if (!event.id || !event.type) return refuse(400)
  const prisma = keystoneContext.prisma as PrismaClient
  const db = guarded(prisma)
  const replayKey = paymentWebhookReplayKey('stripe', event.id)
  // The inbox row is the replay claim, written before any handling.
  const claimed = await db.paymentWebhookEvent.createMany({ data: [{ replayKey, providerCode: 'stripe', providerEventId: event.id, eventType: event.type, payloadHash: paymentWebhookPayloadHash(raw), processedAt: new Date() }], skipDuplicates: true })
  if (!claimed.count) return Response.json({ success: true, duplicate: true })
  const obj = event.data?.object
  if (obj?.object === 'checkout.session' && obj.id && ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) {
    try { await settleCheckoutById(prisma, obj.id) } catch (e) {
      // Let Stripe retry: free the claim so the retry is handled.
      await db.paymentWebhookEvent.deleteMany({ where: { replayKey } }).catch(() => null)
      console.error('[tutor] webhook settle failed', e instanceof Error ? e.message : e)
      return refuse(500)
    }
  }
  return Response.json({ success: true })
}
