import Link from 'next/link'

import { RefundPaymentForm } from '../lib/forms'
import { label, lists, money, read, when } from '../lib/data'
import { Field, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'

/** P33: refund a payment: card through Stripe, other methods recorded. Never more than what is left. */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  const crumbs = [{ label: 'Billing', href: '/dashboard/platform/billing' }, { label: 'Payments', href: '/dashboard/platform/billing/payments' }]
  if (!b.ok || !b.data.setUp) return <Page title="Payment" crumbs={crumbs} error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const d = await lists<any>('query($id: ID!) { payment(where: { id: $id }) { id kind method status amountCents refundedCents refundPendingCents reference providerReference paidAt note reportedByGuardian family { id guardianName } invoice { id number } session { id typeNameSnapshot startsAt } purchase { id nameSnapshot } refunds { id amountCents paidAt note } } }', { id })
  const p = d?.payment
  if (!p) return <Page title="Payment" crumbs={crumbs} error="Payment not found." />
  const tz = b.data.profile.timezone
  const cur = b.data.profile.currencyCode
  const left = p.amountCents - p.refundedCents - p.refundPendingCents
  return (
    <Page title={`${label(p.kind)} payment · ${money(p.amountCents, cur)}`} crumbs={crumbs}>
      <Section title="Payment">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Family</dt><dd><Link className="underline" href={`/dashboard/platform/families/${p.family?.id}`}>{p.family?.guardianName}</Link></dd>
          <dt className="text-muted-foreground">For</dt><dd>{p.invoice ? <Link className="underline" href={`/dashboard/platform/billing/invoices/${p.invoice.id}`}>Invoice {p.invoice.number}</Link> : p.session ? <Link className="underline" href={`/dashboard/platform/sessions/${p.session.id}`}>{p.session.typeNameSnapshot} · {when(p.session.startsAt, tz)}</Link> : p.purchase ? p.purchase.nameSnapshot : label(p.kind)}</dd>
          <dt className="text-muted-foreground">Method</dt><dd>{label(p.method)}{p.reportedByGuardian ? ' (reported by the family)' : ''}</dd>
          <dt className="text-muted-foreground">Status</dt><dd>{label(p.status)}</dd>
          <dt className="text-muted-foreground">Paid</dt><dd>{when(p.paidAt, tz)}</dd>
          {p.reference ? <><dt className="text-muted-foreground">Reference</dt><dd>{p.reference}</dd></> : null}
          {p.providerReference ? <><dt className="text-muted-foreground">Stripe</dt><dd className="break-all">{p.providerReference}</dd></> : null}
          <dt className="text-muted-foreground">Refunded</dt><dd>{money(p.refundedCents, cur)}</dd>
        </dl>
        {p.refunds.length ? <ul className="grid gap-1 text-sm">{p.refunds.map((x: any) => <li key={x.id}>Refund {when(x.paidAt, tz)} · {money(x.amountCents, cur)}{x.note ? ` · ${x.note}` : ''}</li>)}</ul> : null}
      </Section>
      {['confirmed', 'partially_refunded'].includes(p.status) && p.kind !== 'refund' && left > 0 ? (
        <Section title="Refund">
          <RefundPaymentForm paymentId={p.id} currency={cur} submit={p.method === 'stripe' ? 'Refund to the card' : 'Record the refund'} className="grid gap-2 sm:grid-cols-2">
            <Field label={`Amount (up to ${money(left, cur)})`}><input name="amount" type="number" min="0.01" step="0.01" max={(left / 100).toFixed(2)} defaultValue={(left / 100).toFixed(2)} className={inputClass} /></Field>
            <Field label="Reason"><input name="note" className={inputClass} /></Field>
          </RefundPaymentForm>
          {p.method !== 'stripe' ? <p className="text-xs text-muted-foreground">You give this money back yourself; this records it.</p> : null}
        </Section>
      ) : null}
    </Page>
  )
}
