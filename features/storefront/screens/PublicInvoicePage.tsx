import Link from 'next/link'
import { getPublicInvoice } from '../lib/data/public'
import { InvoiceView } from '../components/InvoiceView'
import { Notice, PageTitle } from '../components/ui'

/** S16 by private link: /invoice/[id]?t=… */
export default async function PublicInvoicePage({ id, token, paid }: { id: string; token: string; paid?: string }) {
  if (!token) return <main className="mx-auto max-w-2xl px-5 py-14"><Notice tone="error">This invoice link is not complete. Open the link from your email, or <Link href="/account/invoices" className="font-semibold underline">sign in</Link>.</Notice></main>
  const r = await getPublicInvoice(id, token)
  if (!r.success || !r.data) return <main className="mx-auto max-w-2xl px-5 py-14"><Notice tone="error">{r.error ?? 'This invoice was not found.'}</Notice></main>
  return (
    <main className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
      <PageTitle>Your invoice</PageTitle>
      <InvoiceView inv={r.data} token={token} paid={paid} cleanUrl={`/invoice/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`} />
    </main>
  )
}
