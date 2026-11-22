import Link from 'next/link'
import { getPublicBooking } from '../lib/data/public'
import { getViewer } from '../lib/data/account'
import { SessionView } from '../components/SessionView'
import { ClaimForm } from '../components/ClaimForm'
import { ButtonLink, Card, Notice, PageTitle } from '../components/ui'

/** S3–S5, S7: a booking by its private link /booking/[id]?t=… */
export default async function BookingStatusPage({ id, token, paid }: { id: string; token: string; paid?: string }) {
  if (!token) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-14">
        <Notice tone="error">This booking link is not complete. Open the link from your email, or <Link href="/account/signin" className="font-semibold underline">sign in</Link> to see your sessions.</Notice>
      </main>
    )
  }
  const [r, viewer] = await Promise.all([getPublicBooking(id, token), getViewer()])
  if (!r.success || !r.data) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-14">
        <Notice tone="error">{r.error ?? 'This booking was not found.'}</Notice>
        <div className="mt-4"><ButtonLink href="/" variant="outline">Go to the home page</ButtonLink></div>
      </main>
    )
  }
  const s = r.data
  const cleanUrl = `/booking/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`
  const first = s.guardianName.split(/\s+/)[0]
  const title = s.status === 'pending_payment' ? 'Almost booked' : s.status === 'scheduled' ? `You’re booked${first ? `, ${first}` : ''}` : 'Your booking'
  const footer = !s.hasAccount && !viewer ? (
    <Card>
      <h2 className="font-display text-[20px] font-semibold text-ink">Create your family account</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Set a password to see all your lessons in one place, book again, buy packages, see notes and homework, and pay invoices.</p>
      <div className="mt-4"><ClaimForm bookingId={s.id} bookingToken={token} askEmail="optional" /></div>
    </Card>
  ) : viewer && !viewer.isTutor ? (
    <p className="text-[15px] text-ink-soft"><Link href="/account" className="font-semibold text-wine underline">Go to your family account</Link></p>
  ) : null
  return (
    <main className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
      <PageTitle sub="Keep this page’s link: it is your private link to this booking.">{title}</PageTitle>
      <SessionView s={s} token={token} paid={paid} cleanUrl={cleanUrl} footer={footer} />
    </main>
  )
}
