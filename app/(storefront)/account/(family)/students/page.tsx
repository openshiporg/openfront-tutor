import Link from 'next/link'
import type { Metadata } from 'next'
import { LineChart } from 'lucide-react'
import { getMyStudents } from '@/features/storefront/lib/data/account'
import { StudentForm } from '@/features/storefront/components/StudentForm'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Badge, Card, PageTitle } from '@/features/storefront/components/ui'

export const metadata: Metadata = { title: 'Students' }
export const dynamic = 'force-dynamic'

/** S12: students in the family; add and edit. */
export default async function Page() {
  const r = await getMyStudents()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  return (
    <>
      <PageTitle sub="Keep each student’s level and goals up to date so lessons fit.">Students</PageTitle>
      <div className="grid gap-4">
        {r.data.students.map((s) => (
          <Card key={s.id}>
            <details>
              <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-display text-[21px] font-semibold text-ink">{s.firstName}{s.lastName ? ` ${s.lastName}` : ''}</span>
                  <span className="block text-[14.5px] text-ink-soft">{[s.level, s.school].filter(Boolean).join(' · ') || 'No level yet'}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {s.status !== 'active' ? <Badge tone="muted">{s.status}</Badge> : null}
                  {s.subjects.map((x) => <Badge key={x.id}>{x.name}</Badge>)}
                  <span className="text-[14.5px] font-semibold text-wine underline">Edit</span>
                </span>
              </summary>
              <div className="mt-5 border-t border-line/60 pt-5"><StudentForm student={s} /></div>
            </details>
            {s.goals ? <p className="mt-3 whitespace-pre-line text-[15px] text-ink">{s.goals}</p> : null}
            <Link href={`/account/progress?student=${s.id}`} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-wine underline"><LineChart className="size-4" aria-hidden />See progress</Link>
          </Card>
        ))}
        <Card>
          <h2 className="mb-4 font-display text-[20px] font-semibold text-ink">Add a student</h2>
          <StudentForm />
        </Card>
      </div>
    </>
  )
}
