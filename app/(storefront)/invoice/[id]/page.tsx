import PublicInvoicePage from '@/features/storefront/screens/PublicInvoicePage'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; paid?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  return <PublicInvoicePage id={id} token={sp.t ?? ''} paid={sp.paid} />
}
