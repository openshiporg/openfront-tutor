import type { Metadata } from 'next'
import { getMyFamily } from '@/features/storefront/lib/data/account'
import { ContactForm } from '@/features/storefront/components/ContactForm'
import { CalendarFeed } from '@/features/storefront/components/CalendarFeed'
import { SignOutButton } from '@/features/storefront/components/AuthForms'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Card, PageTitle, Row } from '@/features/storefront/components/ui'
import { money } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

const BILLING: Record<string, string> = { pay_as_you_book: 'Pay as you book', invoice: 'Invoiced', flat_monthly: 'Flat monthly fee' }

/** S20 contact details and timezone; S21 calendar feed; the tutor's policies. */
export default async function Page() {
  const r = await getMyFamily()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const { family, tutor } = r.data
  return (
    <>
      <PageTitle>Settings</PageTitle>
      <div className="grid gap-6">
        <Card>
          <h2 className="mb-4 font-display text-[20px] font-semibold text-ink">Contact details</h2>
          <ContactForm family={family} tutorTimezone={tutor.timezone} />
        </Card>
        <CalendarFeed />
        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">How you pay and the rules</h2>
          <dl className="mt-3">
            <Row label="Billing">{BILLING[family.billingMode] ?? family.billingMode}{family.billingMode === 'flat_monthly' && family.monthlyFeeCents ? ` · ${money(family.monthlyFeeCents, tutor.currencyCode)} a month` : ''}</Row>
            <Row label="Free to cancel or move">Up to {tutor.cancellationWindowHours} hours before</Row>
            <Row label="Later cancellation">{tutor.lateCancelPercent}% of the price</Row>
            <Row label="Missed lesson">{tutor.noShowPercent}% of the price</Row>
          </dl>
          {tutor.policiesText ? <p className="mt-3 whitespace-pre-line text-[15px] text-ink-soft">{tutor.policiesText}</p> : null}
          {tutor.paymentInstructions ? <><h3 className="mt-4 font-semibold text-ink">Paying {tutor.tutorName || tutor.businessName} directly</h3><p className="mt-1 whitespace-pre-line text-[15px] text-ink-soft">{tutor.paymentInstructions}</p></> : null}
        </Card>
        <div className="lg:hidden"><SignOutButton /></div>
      </div>
    </>
  )
}
