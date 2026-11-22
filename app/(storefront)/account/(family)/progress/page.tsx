import Link from 'next/link'
import type { Metadata } from 'next'
import { getMyFamily, getMyProgress } from '@/features/storefront/lib/data/account'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Badge, Card, Empty, PageTitle, cx, statusTone } from '@/features/storefront/components/ui'
import { fmtDate, fmtDateTime, safeZone } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Progress' }
export const dynamic = 'force-dynamic'

/** S14: marks over time, shared lesson notes and homework for one student. */
export default async function Page({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const [{ student: wanted }, fam] = await Promise.all([searchParams, getMyFamily()])
  if (!fam.success || !fam.data) return <ErrorPage error={fam.error} />
  const students = fam.data.students
  const tz = safeZone(fam.data.family.timezone || fam.data.tutor.timezone)
  if (!students.length) return <><PageTitle>Progress</PageTitle><Empty action={<Link href="/account/students" className="font-semibold text-wine underline">Add a student</Link>}>No students yet.</Empty></>
  const id = students.find((s) => s.id === wanted)?.id ?? students[0].id
  const r = await getMyProgress(id)
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const p = r.data
  const max = Math.max(100, ...p.marks.map((m) => m.percent))
  return (
    <>
      <PageTitle sub="Marks, lesson notes and homework, as your tutor shares them.">Progress</PageTitle>
      {students.length > 1 ? (
        <nav aria-label="Student" className="mb-5 flex flex-wrap gap-2">
          {students.map((s) => (
            <Link key={s.id} href={`/account/progress?student=${s.id}`} aria-current={s.id === id ? 'page' : undefined}
              className={cx('inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold', s.id === id ? 'border-wine bg-wine text-white' : 'border-line bg-white text-ink')}>{s.firstName}</Link>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-6">
        <Card>
          <h2 className="font-display text-[21px] font-semibold text-ink">{p.student.firstName}{p.student.level ? <span className="font-normal text-ink-soft"> · {p.student.level}</span> : null}</h2>
          {p.student.goals ? <p className="mt-2 whitespace-pre-line text-[15px] text-ink"><span className="font-semibold">Goals: </span>{p.student.goals}</p> : null}
        </Card>

        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">Marks</h2>
          {p.marks.length ? (
            <>
              <div className="mt-4 flex h-40 items-end gap-2 overflow-x-auto border-b border-line pb-1" role="img" aria-label={`Marks over time: ${p.marks.map((m) => `${m.label} ${m.percent}%`).join(', ')}`}>
                {p.marks.map((m) => (
                  <div key={m.id} className="flex w-10 shrink-0 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                    <span className="text-[12px] font-semibold text-ink">{m.percent}%</span>
                    <span className="w-full rounded-t-md bg-wine/80" style={{ height: `${Math.max(4, (m.percent / max) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <ul className="mt-4 grid gap-1">
                {p.marks.slice().reverse().map((m) => (
                  <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-line/50 py-2 text-[15px] last:border-0">
                    <span className="text-ink"><span className="font-semibold">{m.label}</span> <span className="text-ink-soft">· {fmtDate(m.takenOn)}</span>{m.note ? <span className="block text-[14px] text-ink-soft">{m.note}</span> : null}</span>
                    <span className="font-semibold text-ink">{m.score} / {m.outOf} ({m.percent}%)</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="mt-2 text-[15px] text-ink-soft">No marks recorded yet.</p>}
        </Card>

        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">Lesson notes</h2>
          {p.notes.length ? (
            <ul className="mt-3 grid gap-3">
              {p.notes.map((n) => (
                <li key={n.session.id} className="rounded-xl bg-paper-deep/60 p-4">
                  <Link href={`/account/sessions/${n.session.id}`} className="text-[14px] font-semibold text-wine underline">{n.session.typeNameSnapshot} · {fmtDateTime(n.session.startsAt, tz)}</Link>
                  {n.covered ? <p className="mt-1 text-[15px] text-ink"><span className="font-semibold">Covered: </span>{n.covered}</p> : null}
                  {n.wentWell ? <p className="mt-1 text-[15px] text-ink"><span className="font-semibold">Went well: </span>{n.wentWell}</p> : null}
                  {n.workOnNext ? <p className="mt-1 text-[15px] text-ink"><span className="font-semibold">Next: </span>{n.workOnNext}</p> : null}
                  {n.effort ? <p className="mt-1 text-[14px] text-ink-soft">Effort {n.effort} out of 5</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[15px] text-ink-soft">Notes appear here after lessons.</p>}
        </Card>

        <Card>
          <h2 className="font-display text-[20px] font-semibold text-ink">Homework</h2>
          {p.homework.length ? (
            <ul className="mt-3 grid gap-1">
              {p.homework.map((h) => (
                <li key={h.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-[15px]">
                  <span className="text-ink">{h.title}{h.dueAt ? <span className="text-ink-soft"> · due {fmtDate(h.dueAt, tz)}</span> : null}</span>
                  <Badge tone={statusTone(h.status)}>{h.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[15px] text-ink-soft">No homework yet.</p>}
          <Link href="/account/homework" className="mt-2 inline-flex min-h-11 items-center text-[15px] font-semibold text-wine underline">Go to homework</Link>
        </Card>
      </div>
    </>
  )
}
