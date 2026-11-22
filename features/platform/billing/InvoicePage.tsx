import Link from 'next/link'

import { ActionButton, LinkMaker } from '../lib/actions'
import { AddInvoiceLineForm } from '../lib/forms'
import { day, label, money, read, when } from '../lib/data'
import { Field, Pill, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'
import { RecordPaymentForm } from './RecordPaymentForm'
import { SendInvoiceButton } from './SendInvoiceButton'

/** P30 one invoice: edit a draft, send, void, record and confirm payments. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await read<any>('query($id: ID!) { tutorInvoice(id: $id) { success error data } }', 'tutorInvoice', { id })
  const crumbs = [{ label: 'Billing', href: '/dashboard/platform/billing' }]
  if (!r.ok) return <Page title="Invoice" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const i = r.data
  const cur = i.currencyCode
  const tz = i.timezone
  const draft = i.status === 'draft'
  return (
    <Page title={`Invoice ${i.number}`} crumbs={crumbs} actions={<Pill tone={i.status === 'paid' ? 'good' : i.overdue ? 'bad' : 'neutral'}>{i.overdue ? 'Overdue' : label(i.status)}</Pill>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Invoice">
          <p className="text-sm">To <Link className="underline" href={`/dashboard/platform/families/${i.family?.id}`}>{i.family?.guardianName}</Link>{i.family?.email ? ` · ${i.family.email}` : ''}</p>
          <p className="text-sm text-muted-foreground">{i.issuedAt ? `Sent ${day(i.issuedAt, tz)} · ` : ''}{i.dueAt ? `Due ${day(i.dueAt, tz)}` : ''}</p>
          <table className="w-full text-sm"><tbody>
            {i.lines.map((l: any) => (
              <tr key={l.id} className="border-t align-top"><td className="py-1.5 pr-2">{l.description}{l.session ? <> · <Link className="underline" href={`/dashboard/platform/sessions/${l.session.id}`}>session</Link></> : null}</td><td className="py-1.5 text-right tabular-nums">{l.quantity} × {money(l.unitCents, cur)}</td><td className="py-1.5 pl-2 text-right tabular-nums">{money(l.totalCents, cur)}</td>{draft ? <td className="py-1 pl-2"><ActionButton op="removeInvoiceLine" vars={{ lineId: l.id }} label="Remove" confirm="Remove this line?" /></td> : null}</tr>
            ))}
            <tr className="border-t font-medium"><td className="py-1.5">Total</td><td /><td className="py-1.5 pl-2 text-right tabular-nums">{money(i.totalCents, cur)}</td></tr>
            <tr><td className="py-1">Paid</td><td /><td className="py-1 pl-2 text-right tabular-nums">{money(i.paidCents, cur)}</td></tr>
          </tbody></table>
          {i.note ? <p className="text-sm">{i.note}</p> : null}
          {draft ? (
            <AddInvoiceLineForm invoiceId={i.id} className="grid gap-2 sm:grid-cols-3">
              <Field label="Description"><input name="d" required className={inputClass} /></Field>
              <Field label="Quantity"><input name="q" type="number" min="1" defaultValue="1" className={inputClass} /></Field>
              <Field label={`Price each (${cur})`}><input name="u" type="number" min="0" step="0.01" required className={inputClass} /></Field>
            </AddInvoiceLineForm>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {draft ? <SendInvoiceButton id={i.id} hasEmail={Boolean(i.family?.email)} /> : null}
            {['sent', 'paid'].includes(i.status) ? <LinkMaker op="invoiceLink" vars={{ invoiceId: i.id }} label="Link for the family" /> : null}
            {['draft', 'sent'].includes(i.status) && i.paidCents === 0 ? <ActionButton op="voidInvoice" vars={{ invoiceId: i.id }} label="Void" variant="danger" confirm="Void this invoice? Its sessions can be invoiced again." /> : null}
          </div>
          {i.status === 'sent' ? <p className="text-xs text-muted-foreground">A sent invoice cannot be changed. To fix a mistake, void it and create a new one.</p> : null}
        </Section>
        <Section title="Payments">
          {i.payments.length ? <ul className="grid gap-2 text-sm">{i.payments.map((p: any) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2"><span>{when(p.paidAt, tz)} · {label(p.method)} · {money(p.amountCents, cur)} · {label(p.status)}{p.reference ? ` · ${p.reference}` : ''}</span>
              {p.status === 'reported' ? <span className="flex gap-2"><ActionButton op="confirmPayment" vars={{ paymentId: p.id }} label="Confirm" variant="primary" /><ActionButton op="rejectPayment" vars={{ paymentId: p.id, note: 'Not received' }} label="Not received" variant="danger" /></span> : p.kind !== 'refund' ? <Link className="underline" href={`/dashboard/platform/billing/payments/${p.id}`}>Open</Link> : null}</li>
          ))}</ul> : <p className="text-sm text-muted-foreground">No payments yet.</p>}
          {i.status === 'sent' && i.paidCents < i.totalCents ? <RecordPaymentForm target="invoice" targetId={i.id} defaultCents={i.totalCents - i.paidCents} currency={cur} /> : null}
        </Section>
      </div>
    </Page>
  )
}
