import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays, FileText, NotebookPen, Package, Star } from 'lucide-react'
import { getMyFamily } from '@/features/storefront/lib/data/account'
import { ErrorPage, SessionList } from '@/features/storefront/components/SessionList'
import { ButtonLink, Card, Empty, Notice, PageTitle } from '@/features/storefront/components/ui'
import { duration, fmtDate, fmtDateTime, money, safeZone } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Your family account' }
export const dynamic = 'force-dynamic'

/** S9: account home. */
export default async function Page() {
  const r = await getMyFamily()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const d = r.data
  const tz = safeZone(d.family.timezone || d.tutor.timezone)
  const c = d.tutor.currencyCode
  const first = d.family.guardianName.split(/\s+/)[0]
  const tutor = d.tutor.tutorName || d.tutor.businessName
  const active = d.packages.filter((p) => p.status === 'active')
  const awaiting = d.packages.filter((p) => p.status === 'awaiting_payment')
  return (
    <>
      <PageTitle sub={`Lessons with ${tutor}. Times are in ${tz}.`} action={<ButtonLink href="/account/book"><CalendarDays className="size-4" aria-hidden />Book a lesson</ButtonLink>}>
        Hello{first ? `, ${first}` : ''}
      </PageTitle>

      <div className="grid gap-4">
        {d.overdueInvoices > 0 ? <Notice tone="error">{d.overdueInvoices === 1 ? 'One invoice is overdue.' : `${d.overdueInvoices} invoices are overdue.`} <Link href="/account/invoices" className="font-semibold underline">See invoices</Link></Notice> : null}
        {d.lowBalance ? <Notice tone="warn">Your package is running low: {duration(d.minutesLeft)} left. <Link href="/account/packages" className="font-semibold underline">Top up</Link></Notice> : null}
        {awaiting.length ? <Notice>{awaiting.map((p) => p.nameSnapshot).join(', ')}: waiting for payment. <Link href="/account/packages" className="font-semibold underline">See packages</Link></Notice> : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/account/packages" className="rounded-2xl border border-line/70 bg-white/80 p-5 hover:border-wine/50">
          <Package className="size-5 text-wine" aria-hidden />
          <p className="mt-2 text-[13.5px] font-semibold uppercase tracking-wide text-ink-soft">Package time</p>
          <p className="font-display text-[26px] font-semibold text-ink">{active.length ? duration(d.minutesLeft) : 'None'}</p>
        </Link>
        <Link href="/account/invoices" className="rounded-2xl border border-line/70 bg-white/80 p-5 hover:border-wine/50">
          <FileText className="size-5 text-wine" aria-hidden />
          <p className="mt-2 text-[13.5px] font-semibold uppercase tracking-wide text-ink-soft">To pay</p>
          <p className="font-display text-[26px] font-semibold text-ink">{money(d.owingCents, c)}</p>
        </Link>
        <Link href="/account/homework" className="rounded-2xl border border-line/70 bg-white/80 p-5 hover:border-wine/50">
          <NotebookPen className="size-5 text-wine" aria-hidden />
          <p className="mt-2 text-[13.5px] font-semibold uppercase tracking-wide text-ink-soft">Homework due</p>
          <p className="font-display text-[26px] font-semibold text-ink">{d.homeworkDue.length}</p>
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-[22px] font-semibold text-ink">Coming up</h2>
          <Link href="/account/sessions" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-wine underline">All sessions</Link>
        </div>
        {d.upcoming.length ? <SessionList sessions={d.upcoming} tz={tz} /> : <Empty action={<ButtonLink href="/account/book">Book a lesson</ButtonLink>}>No lessons booked.</Empty>}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">New notes from {tutor}</h2>
          {d.newNotes.length ? (
            <ul className="mt-3 grid gap-3">
              {d.newNotes.map((n) => (
                <li key={n.session.id}>
                  <Link href={`/account/sessions/${n.session.id}`} className="block rounded-xl bg-paper-deep/60 p-3 hover:bg-paper-deep">
                    <span className="block text-[13.5px] font-semibold text-ink-soft">{n.session.typeNameSnapshot} · {fmtDateTime(n.session.startsAt, tz)}</span>
                    {n.covered ? <span className="mt-1 line-clamp-2 block text-[15px] text-ink">{n.covered}</span> : null}
                    {n.workOnNext ? <span className="mt-1 line-clamp-2 block text-[14px] text-ink-soft">Next: {n.workOnNext}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[15px] text-ink-soft">Notes appear here after each lesson.</p>}
        </Card>
        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">Homework due</h2>
          {d.homeworkDue.length ? (
            <ul className="mt-3 grid gap-1">
              {d.homeworkDue.map((h) => (
                <li key={h.id}><Link href="/account/homework" className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-[15px] hover:text-wine">
                  <span className="font-medium text-ink">{h.student.firstName}: {h.title}</span>
                  {h.dueAt ? <span className="text-ink-soft">due {fmtDate(h.dueAt, tz)}</span> : null}
                </Link></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[15px] text-ink-soft">Nothing due right now.</p>}
        </Card>
        {d.openInvoices.length ? (
          <Card>
            <h2 className="font-display text-[20px] font-semibold text-ink">Open invoices</h2>
            <ul className="mt-3 grid gap-1">
              {d.openInvoices.map((i) => (
                <li key={i.id}><Link href={`/account/invoices/${i.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-[15px] hover:text-wine">
                  <span className="font-medium text-ink">Invoice {i.number}{i.dueAt ? <span className="font-normal text-ink-soft"> · due {fmtDate(i.dueAt, tz)}</span> : null}</span>
                  <span className="font-semibold text-ink">{money(i.totalCents - i.paidCents, c)}</span>
                </Link></li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">Students</h2>
          {d.students.length ? (
            <ul className="mt-3 grid gap-1">
              {d.students.map((s) => (
                <li key={s.id}><Link href={`/account/progress?student=${s.id}`} className="flex min-h-11 items-center justify-between gap-2 text-[15px] hover:text-wine">
                  <span className="font-medium text-ink">{s.firstName}{s.lastName ? ` ${s.lastName}` : ''}</span>
                  <span className="text-ink-soft">{s.level || ''}</span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[15px] text-ink-soft">No students yet.</p>}
          <Link href="/account/students" className="mt-2 inline-flex min-h-11 items-center text-[15px] font-semibold text-wine underline">Manage students</Link>
        </Card>
        {d.canReview ? (
          <Card className="bg-wine/5">
            <Star className="size-5 text-wine" aria-hidden />
            <h2 className="mt-2 font-display text-[20px] font-semibold text-ink">How are lessons going?</h2>
            <p className="mt-1 text-[15px] text-ink-soft">A short review helps other families find {tutor}.</p>
            <div className="mt-3"><ButtonLink href="/account/review" variant="outline">Write a review</ButtonLink></div>
          </Card>
        ) : null}
      </div>
    </>
  )
}
