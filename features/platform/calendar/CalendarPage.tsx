import Link from 'next/link'

import { DeleteItemButton } from '../lib/actions'
import { day, hhmm, label, lists, read, time, when } from '../lib/data'
import { Empty, Pill, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { AddSessionForm, TimeOffForm } from './CalendarForms'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

/** P9 week calendar, P10 add a session by hand, P12 time off with affected sessions listed. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Calendar" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const tz = b.data.profile.timezone
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.week || '') ? sp.week! : todayKey
  const dow = new Date(`${anchor}T12:00:00Z`).getUTCDay()
  const from = addDays(anchor, -((dow + 6) % 7))
  const to = addDays(from, 6)
  const r = await read<any>('query($from: String!, $to: String!) { calendar(from: $from, to: $to) { success error data } }', 'calendar', { from, to })
  if (!r.ok) return <Page title="Calendar" error={r.error} />
  const c = r.data
  const pick = await lists<any>(`query { families(where: { status: { in: [lead, active, paused] } }, orderBy: { guardianName: asc }, take: 500) { id guardianName students(where: { status: { equals: active } }) { id firstName } } sessionTypes(where: { active: { equals: true } }, orderBy: { sortOrder: asc }) { id name durationMinutes mode } }`)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const keyOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso))
  return (
    <Page title="Calendar" actions={<span className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`?week=${addDays(from, -7)}`}>← Previous week</Link><Link className="underline" href="?">This week</Link><Link className="underline" href={`?week=${addDays(from, 7)}`}>Next week →</Link><Link className="underline" href="/dashboard/platform/calendar/series">Weekly series</Link></span>}>
      <p className="text-sm text-muted-foreground">{day(`${from}T12:00:00Z`, 'UTC')} to {day(`${to}T12:00:00Z`, 'UTC')} · times in {tz}</p>
      {c.insideTimeOff.length ? <p role="alert" className="rounded-md border border-amber-300 px-3 py-2 text-sm">{c.insideTimeOff.length} booked {c.insideTimeOff.length === 1 ? 'session falls' : 'sessions fall'} inside your time off. Open {c.insideTimeOff.length === 1 ? 'it' : 'each one'} to cancel or move it (the family is emailed).</p> : null}
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const h = c.hours.find((x: any) => x.dayOfWeek === DAYS[new Date(`${d}T12:00:00Z`).getUTCDay()])
          const items = c.sessions.filter((s: any) => keyOf(s.startsAt) === d)
          const off = c.timeOff.filter((o: any) => keyOf(o.startsAt) <= d && keyOf(o.endsAt) >= d)
          return (
            <div key={d} className={`grid min-w-0 content-start gap-1.5 rounded-md border p-2 ${d === todayKey ? 'border-foreground' : ''}`}>
              <p className="text-sm font-medium">{new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))}</p>
              <p className="text-xs text-muted-foreground">{h?.isWorking ? `Open ${hhmm(h.startMinute)}–${hhmm(h.endMinute)}` : 'Not working'}</p>
              {off.map((o: any) => <p key={o.id} className="rounded bg-muted px-1.5 py-1 text-xs">Time off{o.reason ? `: ${o.reason}` : ''}</p>)}
              {items.map((s: any) => (
                <Link key={s.id} href={`/dashboard/platform/sessions/${s.id}`} className={`grid gap-0.5 rounded border px-1.5 py-1 text-xs hover:bg-muted ${['cancelled', 'late_cancelled', 'excused'].includes(s.status) ? 'opacity-50 line-through' : ''} ${c.insideTimeOff.includes(s.id) ? 'border-amber-400' : ''}`}>
                  <span className="font-medium">{time(s.startsAt, tz)} {s.typeNameSnapshot}</span>
                  <span>{s.students.map((x: any) => x.firstName).join(', ')} · {s.family?.guardianName}</span>
                  {s.status !== 'scheduled' ? <span>{label(s.status)}</span> : null}
                </Link>
              ))}
            </div>
          )
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Add a session">
          {pick?.families?.length ? <AddSessionForm families={pick.families} types={pick.sessionTypes} timezone={tz} defaultDate={from < todayKey ? todayKey : from} /> : <Empty>Add a family first. <Link className="underline" href="/dashboard/platform/families">Families</Link></Empty>}
        </Section>
        <Section title="Time off">
          <TimeOffForm timezone={tz} />
          {c.timeOff.length ? <ul className="grid gap-2 text-sm">{c.timeOff.map((o: any) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">{when(o.startsAt, tz)} to {when(o.endsAt, tz)}{o.reason ? ` · ${o.reason}` : ''}<DeleteItemButton list="TimeOff" id={o.id} confirm="Remove this time off?" /></li>)}</ul> : <Empty>No time off this week.</Empty>}
        </Section>
      </div>
      {c.series.some((s: any) => s.skippedDates) ? (
        <Section title="Needs a time">
          <ul className="grid gap-1 text-sm">{c.series.filter((s: any) => s.skippedDates).map((s: any) => <li key={s.id}>{s.family?.guardianName} · {s.sessionType?.name}: {s.skippedDates.split('\n').join(', ')} <Pill tone="warn">Skipped</Pill></li>)}</ul>
        </Section>
      ) : null}
    </Page>
  )
}
