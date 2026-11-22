import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import { getMySession } from '@/features/storefront/lib/data/account'
import { SessionView } from '@/features/storefront/components/SessionView'
import { ReportPaymentForm } from '@/features/storefront/components/ReportPaymentForm'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Card, PageTitle } from '@/features/storefront/components/ui'

export const metadata: Metadata = { title: 'Session' }
export const dynamic = 'force-dynamic'

/** S11 one session: join link, notes, homework, cancel, reschedule, pay; S21 per-session .ics. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ id }, { paid }] = await Promise.all([params, searchParams])
  const r = await getMySession(id)
  const back = <Link href="/account/sessions" className="mb-2 inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-wine"><ChevronLeft className="size-4" aria-hidden />All sessions</Link>
  if (!r.success || !r.data) return <>{back}<ErrorPage error={r.error} /></>
  const s = r.data
  const owes = s.paymentStatus === 'unpaid' && (s.status === 'scheduled' || s.status === 'completed' || s.status === 'late_cancelled' || s.status === 'no_show') && s.payDirectly
  const footer = owes ? (
    <Card>
      <h2 className="font-display text-[20px] font-semibold text-ink">Paid outside the site?</h2>
      <p className="mb-3 mt-1 text-[15px] text-ink-soft">Tell your tutor with a reference. Nothing changes until they confirm it.</p>
      <ReportPaymentForm target="session" targetId={s.id} defaultCents={Math.max(s.chargedCents, s.priceCents)} currency={s.currencyCode} />
    </Card>
  ) : null
  return (
    <>
      {back}
      <PageTitle>Your session</PageTitle>
      <SessionView s={s} paid={paid} cleanUrl={`/account/sessions/${encodeURIComponent(s.id)}`} footer={footer} />
    </>
  )
}
