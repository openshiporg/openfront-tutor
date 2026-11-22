import Link from 'next/link'

import { label, lists, money, read, when } from '../lib/data'
import { Empty, Field, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'

const METHODS = ['stripe', 'cash', 'bank_transfer', 'mobile_money', 'other']
const STATUSES = ['reported', 'confirmed', 'rejected', 'refunded', 'partially_refunded']

/** P34: payments with filters. */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ method?: string; status?: string; kind?: string }> }) {
  const sp = await searchParams
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Payments" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const where: Record<string, unknown> = {}
  if (METHODS.includes(sp.method || '')) where.method = { equals: sp.method }
  if (STATUSES.includes(sp.status || '')) where.status = { equals: sp.status }
  if (['session', 'package', 'invoice', 'refund'].includes(sp.kind || '')) where.kind = { equals: sp.kind }
  const d = await lists<any>('query($where: PaymentWhereInput!) { payments(where: $where, orderBy: { createdAt: desc }, take: 500) { id kind method status amountCents refundedCents reference paidAt family { id guardianName } invoice { id number } session { id typeNameSnapshot } purchase { nameSnapshot } } }', { where })
  const tz = b.data.profile.timezone
  const cur = b.data.profile.currencyCode
  return (
    <Page title="Payments" crumbs={[{ label: 'Billing', href: '/dashboard/platform/billing' }]}>
      <form className="flex flex-wrap items-end gap-2">
        <Field label="Method"><select name="method" defaultValue={sp.method ?? ''} className={inputClass}><option value="">All</option>{METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
        <Field label="Status"><select name="status" defaultValue={sp.status ?? ''} className={inputClass}><option value="">All</option>{STATUSES.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
        <Field label="For"><select name="kind" defaultValue={sp.kind ?? ''} className={inputClass}><option value="">All</option>{['session', 'package', 'invoice', 'refund'].map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
        <button className="h-11 rounded-md border px-4 text-sm md:h-10" type="submit">Show</button>
      </form>
      {!d?.payments?.length ? <Empty>No payments match.</Empty> : (
        <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-2">Date</th><th className="p-2">Family</th><th className="p-2">For</th><th className="p-2">Method</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody>{d.payments.map((p: any) => (
            <tr key={p.id} className="border-t"><td className="p-2"><Link className="underline" href={`/dashboard/platform/billing/payments/${p.id}`}>{when(p.paidAt, tz)}</Link></td><td className="p-2">{p.family?.guardianName}</td><td className="p-2">{label(p.kind)}{p.invoice ? ` ${p.invoice.number}` : p.session ? ` · ${p.session.typeNameSnapshot}` : p.purchase ? ` · ${p.purchase.nameSnapshot}` : ''}</td><td className="p-2">{label(p.method)}</td><td className="p-2">{label(p.status)}</td><td className="p-2 text-right tabular-nums">{p.kind === 'refund' ? '−' : ''}{money(p.amountCents, cur)}{p.refundedCents ? ` (−${money(p.refundedCents, cur)})` : ''}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Page>
  )
}
