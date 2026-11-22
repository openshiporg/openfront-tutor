import Link from 'next/link'

import { ActionButton } from '../lib/actions'
import { day, label, lists, money, read } from '../lib/data'
import { Empty, Pill, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { DraftInvoiceForm } from './DraftInvoiceForm'

/** P29 ready to invoice, P30 invoices, P31 reported payments, P32 record a payment (from each item). */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const sp = await searchParams
  const r = await read<any>('query { readyToInvoice { success error data } }', 'readyToInvoice')
  if (!r.ok) return <Page title="Billing" error={r.error} needsSetup={r.needsSetup} />
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  const tz = b.ok ? b.data.profile?.timezone : 'UTC'
  const cur = r.data.currencyCode
  const d = await lists<any>(`query {
    invoices(orderBy: { createdAt: desc }, take: 200) { id number status totalCents paidCents dueAt issuedAt family { id guardianName } }
    payments(where: { status: { equals: reported } }, orderBy: { createdAt: desc }, take: 100) { id kind method amountCents reference paidAt family { guardianName } invoice { number } }
    families(where: { status: { in: [active, paused, lead] } }, orderBy: { guardianName: asc }, take: 500) { id guardianName billingMode }
  }`)
  const ready = r.data.families.filter((f: any) => !sp.family || f.familyId === sp.family)
  const now = Date.now()
  return (
    <Page title="Billing" actions={<span className="flex gap-3 text-sm"><Link className="underline" href="/dashboard/platform/billing/payments">All payments</Link><Link className="underline" href="/dashboard/platform/earnings">Earnings</Link></span>}>
      <Section title="Payments to confirm">
        {!d?.payments?.length ? <Empty>No reported payments waiting.</Empty> : <ul className="grid gap-2 text-sm">{d.payments.map((p: any) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"><span>{p.family?.guardianName}: {money(p.amountCents, cur)} by {label(p.method)} · ref “{p.reference}”{p.invoice ? ` · ${p.invoice.number}` : ` · ${p.kind}`}</span>
            <span className="flex gap-2"><ActionButton op="confirmPayment" vars={{ paymentId: p.id }} label="Confirm" variant="primary" /><ActionButton op="rejectPayment" vars={{ paymentId: p.id, note: 'Not received' }} label="Not received" variant="danger" confirm="Mark as not received?" /></span></li>
        ))}</ul>}
      </Section>
      <Section title="Ready to invoice">
        {!ready.length ? <Empty>Nothing waiting to be invoiced. Completed sessions of families billed by invoice, and monthly fees, appear here.</Empty> : ready.map((f: any) => (
          <div key={f.familyId} className="grid gap-2 rounded-md border p-3 text-sm">
            <p className="font-medium"><Link className="underline" href={`/dashboard/platform/families/${f.familyId}`}>{f.guardianName}</Link> · {label(f.billingMode)} · {money(f.totalCents, cur)}</p>
            <ul className="grid gap-0.5 text-muted-foreground">{f.sessions.map((s: any) => <li key={s.id}>{day(s.startsAt, tz)} · {s.typeNameSnapshot}{s.status !== 'completed' ? ` (${label(s.status)})` : ''} · {money(s.chargedCents, cur)}</li>)}{f.flatMonth ? <li>Monthly fee {f.flatMonth} · {money(f.flatCents, cur)}</li> : null}</ul>
            <DraftInvoiceForm familyId={f.familyId} currency={cur} />
          </div>
        ))}
        {d?.families?.length ? <details className="text-sm"><summary className="cursor-pointer">Invoice any family (free lines only)</summary><div className="mt-2 grid gap-3">{d.families.map((f: any) => <details key={f.id}><summary className="cursor-pointer">{f.guardianName}</summary><DraftInvoiceForm familyId={f.id} currency={cur} /></details>)}</div></details> : null}
      </Section>
      <Section title="Invoices">
        {!d?.invoices?.length ? <Empty>No invoices yet.</Empty> : (
          <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="p-2">Number</th><th className="p-2">Family</th><th className="p-2">Status</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Paid</th><th className="p-2">Due</th></tr></thead>
            <tbody>{d.invoices.map((i: any) => { const overdue = i.status === 'sent' && i.dueAt && new Date(i.dueAt).getTime() < now && i.paidCents < i.totalCents; return (
              <tr key={i.id} className="border-t"><td className="p-2"><Link className="underline" href={`/dashboard/platform/billing/invoices/${i.id}`}>{i.number}</Link></td><td className="p-2">{i.family?.guardianName}</td><td className="p-2"><Pill tone={i.status === 'paid' ? 'good' : overdue ? 'bad' : 'neutral'}>{overdue ? 'Overdue' : i.status === 'sent' && i.paidCents > 0 ? 'Part paid' : label(i.status)}</Pill></td><td className="p-2 text-right tabular-nums">{money(i.totalCents, cur)}</td><td className="p-2 text-right tabular-nums">{money(i.paidCents, cur)}</td><td className="p-2">{i.dueAt ? day(i.dueAt, tz) : ''}</td></tr>
            ) })}</tbody>
          </table></div>
        )}
      </Section>
    </Page>
  )
}
