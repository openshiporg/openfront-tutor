import Link from 'next/link'
import { getPublicTutor } from '../lib/data/public'
import { displayName, firstName } from '../lib/format'
import { InquiryForm } from '../components/InquiryForm'
import { Card, Notice, PageTitle } from '../components/ui'

/** S6 on its own page: /contact/[slug]. */
export default async function ContactPage({ slug }: { slug: string }) {
  const r = await getPublicTutor(slug)
  if (!r.ok) return <main className="mx-auto max-w-2xl px-5 py-14"><Notice tone="error">{r.error}</Notice></main>
  const t = r.data
  if (!t) return <main className="mx-auto max-w-2xl px-5 py-14"><Notice tone="error">This tutor page was not found. <Link href="/" className="underline">Go to the home page</Link>.</Notice></main>
  return (
    <main className="mx-auto max-w-[760px] px-5 py-10 sm:px-8">
      <PageTitle sub={`Tell ${firstName(t)} about the student and what you need. You will get a reply by email or phone.`}>Ask {displayName(t)}</PageTitle>
      <Card><InquiryForm slug={t.slug} subjects={t.subjects.map((s) => s.name)} tutorFirstName={firstName(t)} /></Card>
    </main>
  )
}
