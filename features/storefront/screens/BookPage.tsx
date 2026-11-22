import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPublicTutor } from '../lib/data/public'
import { getViewer } from '../lib/data/account'
import { displayName, firstName } from '../lib/format'
import { FirstBookingFlow } from '../components/FirstBookingFlow'
import { Notice, PageTitle } from '../components/ui'

/** S2: /book/[slug]. A signed-in family books from its account instead (S10). */
export default async function BookPage({ slug, typeId }: { slug: string; typeId?: string }) {
  const [r, viewer] = await Promise.all([getPublicTutor(slug), getViewer()])
  if (viewer && !viewer.isTutor) redirect(typeId ? `/account/book?type=${typeId}` : '/account/book')
  if (!r.ok) return <main className="mx-auto max-w-2xl px-5 py-14"><Notice tone="error">{r.error}</Notice></main>
  const t = r.data
  if (!t) return <main className="mx-auto max-w-2xl px-5 py-14"><Notice tone="error">This tutor page was not found. <Link href="/" className="underline">Go to the home page</Link>.</Notice></main>
  return (
    <main className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8">
      <PageTitle sub={<>Book a lesson with {displayName(t)}. Already a family? <Link href="/account/signin?next=/account/book" className="font-semibold text-wine underline">Sign in</Link> to book for your students.</>}>Book a lesson</PageTitle>
      {t.bookingOpen ? <FirstBookingFlow tutor={t} initialTypeId={typeId} /> : (
        <Notice>Online booking is paused right now. <Link href={`/contact/${t.slug}`} className="font-semibold underline">Send {firstName(t)} a message</Link> instead.</Notice>
      )}
    </main>
  )
}
