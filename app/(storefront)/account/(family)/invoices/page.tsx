import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import { getMyInvoices } from '@/features/storefront/lib/data/account'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Badge, Empty, PageTitle, statusTone } from '@/features/storefront/components/ui'
import { fmtDate, money } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Invoices' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, string> = { draft: 'Draft', sent: 'Open', paid: 'Paid', void: 'Void', part_paid: 'Part paid' }

/** S16: the family's invoices. */
export default async function Page() {
  const r = await getMyInvoices()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const c = r.data.currencyCode
  const rows = r.data.invoices
  const owing = rows.filter((i) => i.status === 'sent').reduce((a, i) => a + i.balanceCents, 0)
  return (
    <>
      <PageTitle sub={owing ? `${money(owing, c)} open in total.` : 'Nothing open right now.'}>Invoices</PageTitle>
      {rows.length ? (
        <ul className="grid gap-3">
          {rows.map((i) => (
            <li key={i.id}>
              <Link href={`/account/invoices/${i.id}`} className="flex min-h-[68px] items-center gap-4 rounded-2xl border border-line/70 bg-white/80 p-4 hover:border-wine/50">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">Invoice {i.number}</span>
                  <span className="block text-[14px] text-ink-soft">{i.issuedAt ? `Sent ${fmtDate(i.issuedAt)}` : ''}{i.dueAt ? ` · due ${fmtDate(i.dueAt)}` : ''}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold text-ink">{money(i.totalCents, c)}</span>
                  <Badge tone={i.overdue ? 'wine' : statusTone(i.status === 'sent' ? 'unpaid' : i.status)}>{i.overdue ? 'Overdue' : STATUS[i.status] ?? i.status}</Badge>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-soft" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty>No invoices yet.</Empty>}
    </>
  )
}
