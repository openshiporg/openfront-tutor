import Link from 'next/link'

import { ActionButton } from '../lib/actions'
import { hhmm, label, lists, read } from '../lib/data'
import { Empty, Pill, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { SeriesForm } from './SeriesForm'

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** P11: weekly series: create, pause, resume, end; skipped weeks. */
export default async function SeriesPage() {
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Weekly series" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const d = await lists<any>(`query {
    recurringSeriesItems(where: { status: { in: [active, paused] } }, orderBy: { createdAt: desc }, take: 200) { id status dayOfWeek startMinute startsOn endsOn skippedDates mode family { id guardianName } sessionType { id name } students { id firstName } }
    families(where: { status: { in: [lead, active, paused] } }, orderBy: { guardianName: asc }, take: 500) { id guardianName students(where: { status: { equals: active } }) { id firstName } }
    sessionTypes(where: { active: { equals: true } }, orderBy: { sortOrder: asc }) { id name durationMinutes mode }
  }`)
  const tz = b.data.profile.timezone
  return (
    <Page title="Weekly series" crumbs={[{ label: 'Calendar', href: '/dashboard/platform/calendar' }]}>
      <Section title="Standing weekly lessons">
        {!d?.recurringSeriesItems?.length ? <Empty>No weekly series yet.</Empty> : (
          <ul className="grid gap-3">{d.recurringSeriesItems.map((s: any) => (
            <li key={s.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <p className="font-medium">{DAY[s.dayOfWeek]}s at {hhmm(s.startMinute)} · {s.sessionType?.name} · <Link className="underline" href={`/dashboard/platform/families/${s.family?.id}`}>{s.family?.guardianName}</Link> ({s.students.map((x: any) => x.firstName).join(', ')}) <Pill tone={s.status === 'active' ? 'good' : 'warn'}>{label(s.status)}</Pill></p>
              <p className="text-muted-foreground">From {s.startsOn}{s.endsOn ? ` to ${s.endsOn}` : ', no end date'} · {label(s.mode)} · {tz}</p>
              {s.skippedDates ? <div className="grid gap-1"><p>Weeks that could not be booked (time off or another booking): place them by hand on the calendar.</p>{s.skippedDates.split('\n').map((date: string) => <span key={date} className="flex flex-wrap items-center gap-2">{date} <ActionButton op="clearSkippedWeek" vars={{ id: s.id, date }} label="Done" /></span>)}</div> : null}
              <span className="flex flex-wrap gap-2">
                {s.status === 'active' ? <ActionButton op="pauseSeries" vars={{ id: s.id }} label="Pause" confirm="Pause? Future sessions of this series are cancelled with no charge." /> : <ActionButton op="pauseSeries" vars={{ id: s.id, resume: true }} label="Resume" variant="primary" />}
                <ActionButton op="endSeries" vars={{ id: s.id }} label="End" variant="danger" confirm="End this series? Future sessions are cancelled with no charge." />
              </span>
            </li>
          ))}</ul>
        )}
      </Section>
      <Section title="New weekly series">
        {d?.families?.length ? <SeriesForm families={d.families} types={d.sessionTypes} /> : <Empty>Add a family first.</Empty>}
      </Section>
    </Page>
  )
}
