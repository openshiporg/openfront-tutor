import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import { getMyInvoice } from '@/features/storefront/lib/data/account'
import { InvoiceView } from '@/features/storefront/components/InvoiceView'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { PageTitle } from '@/features/storefront/components/ui'

export const metadata: Metadata = { title: 'Invoice' }
export const dynamic = 'force-dynamic'

/** S16 one invoice: lines, payments, pay by card; S17 report a payment. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ id }, { paid }] = await Promise.all([params, searchParams])
  const r = await getMyInvoice(id)
  const back = <Link href="/account/invoices" className="mb-2 inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-wine"><ChevronLeft className="size-4" aria-hidden />All invoices</Link>
  if (!r.success || !r.data) return <>{back}<ErrorPage error={r.error} /></>
  return (
    <>
      {back}
      <PageTitle>Invoice {r.data.number}</PageTitle>
      <InvoiceView inv={r.data} paid={paid} cleanUrl={`/account/invoices/${encodeURIComponent(id)}`} />
    </>
  )
}
