import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

function signatureDigest(signatureHeader: string) {
  const value = signatureHeader.trim();
  const digest = value.startsWith('sha256=') ? value.slice('sha256='.length) : value;
  return /^[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : null;
}

// The signature is checked over the exact received bytes, never a re-encoded string.
export function verifyHmacSha256Signature(rawBody: Uint8Array, signatureHeader: string, secret: string) {
  if (!rawBody.byteLength || !secret) return false;
  const supplied = signatureDigest(signatureHeader);
  if (!supplied) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(supplied, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function parseSignedJsonWebhook({
  rawBody,
  signature,
  secret,
}: {
  rawBody: Uint8Array;
  signature: string;
  secret: string;
}) {
  if (!verifyHmacSha256Signature(rawBody, signature, secret)) {
    throw new Error('Payment webhook signature is invalid.');
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) as unknown;
}

export function paymentWebhookReplayKey(providerCode: string, providerEventId: string) {
  return createHash('sha256')
    .update(`${providerCode.trim().toLowerCase()}:${providerEventId.trim()}`, 'utf8')
    .digest('hex');
}

export function paymentWebhookPayloadHash(rawBody: Uint8Array) {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Stripe's own signature scheme: `Stripe-Signature: t=<unix>,v1=<hex>[,v1=…]`
 * over `<t>.<raw body>` with the endpoint secret; events older than the
 * tolerance are refused so a captured request cannot be replayed later.
 */
export function verifyStripeSignature(rawBody: Uint8Array, header: string, secret: string, toleranceSeconds = 300, now = Date.now()) {
  if (!rawBody.byteLength || !secret || !header) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v).filter((v) => /^[a-f0-9]{64}$/i.test(v || ''));
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  return sigs.some((s) => { const got = Buffer.from(s, 'hex'); return got.length === expected.length && timingSafeEqual(got, expected); });
}
