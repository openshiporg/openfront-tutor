import Link from 'next/link'

import { ActionButton, CopyLink } from '../lib/actions'
import { label, money, read, time, when, day } from '../lib/data'
import { Empty, Notice, Pill, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { SessionControls } from '../sessions/SessionControls'

const Q = 'query { today { success error data } }'

/** P2 Today and P8 the attention list. */
export default async function TodayPage() {
  const r = await read<any>(Q, 'today')
  if (!r.ok) return <Page title="Today" error={r.error} needsSetup={r.needsSetup} />
  const t = r.data
  const tz = t.timezone
  const a = t.attention
  const cur = t.currencyCode
  const todo = [
    !t.setup.hasHours && <Link key="h" className="underline" href="/dashboard/platform/settings/hours">Set your weekly hours</Link>,
    !t.setup.hasTypes && <Link key="t" className="underline" href="/dashboard/platform/settings/services">Add a session type</Link>,
    !t.setup.meetingUrl && <Link key="m" className="underline" href="/dashboard/platform/settings">Add your lesson link (Zoom, Meet…)</Link>,
    !t.setup.mail && <Link key="e" className="underline" href="/dashboard/platform/settings/messages">Email is not set up: copy links to send instead</Link>,
  ].filter(Boolean)
  return (
    <Page title="Today" actions={<span className="text-sm text-muted-foreground">Your page: <a className="underline" href={t.setup.pageUrl} target="_blank" rel="noreferrer">{t.setup.pageUrl}</a></span>}>
      {todo.length ? <Notice>{todo.map((x, i) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}</Notice> : null}
      <Section title={`Sessions today · ${day(new Date().toISOString(), tz)}`}>
        {!t.sessions.length ? <Empty>No sessions today. <Link className="underline" href="/dashboard/platform/calendar">Open the calendar</Link></Empty> : (
          <ul className="grid gap-3">
            {t.sessions.map((s: any) => (
              <li key={s.id} className="grid min-w-0 gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium"><Link className="hover:underline" href={`/dashboard/platform/sessions/${s.id}`}>{time(s.startsAt, tz)}–{time(s.endsAt, tz)} · {s.typeNameSnapshot}</Link></p>
                  <span className="flex flex-wrap gap-1.5"><Pill tone={s.status === 'scheduled' ? 'neutral' : s.status === 'completed' ? 'good' : 'warn'}>{label(s.status)}</Pill><Pill>{label(s.funding)}</Pill>{s.paymentStatus === 'unpaid' ? <Pill tone="warn">Unpaid</Pill> : null}</span>
                </div>
                <p className="text-sm"><Link className="underline" href={`/dashboard/platform/families/${s.family?.id}`}>{s.family?.guardianName}</Link>{s.family?.phone ? ` · ${s.family.phone}` : ''}</p>
                {s.students.map((st: any) => (
                  <div key={st.id} className="grid gap-1 text-sm">
                    <p><Link className="font-medium underline" href={`/dashboard/platform/students/${st.id}`}>{st.firstName} {st.lastName}</Link>{st.level ? ` · ${st.level}` : ''}</p>
                    {st.lastWorkOnNext ? <p className="text-muted-foreground">Last time, work on next: {st.lastWorkOnNext}</p> : null}
                    {st.homework.map((h: any) => <p key={h.id} className="text-muted-foreground">Homework: {h.title} {h.status === 'handed_in' ? <Pill tone="good">Handed in</Pill> : h.dueAt ? `(due ${day(h.dueAt, tz)})` : ''}</p>)}
                  </div>
                ))}
                {s.joinUrl ? <p className="text-sm">Lesson link: <a className="underline" href={s.joinUrl} target="_blank" rel="noreferrer">{s.joinUrl}</a></p> : s.mode === 'in_person' ? <p className="text-sm">In person</p> : null}
                {s.status === 'scheduled' ? <SessionControls id={s.id} students={s.students} canComplete={new Date(s.startsAt) <= new Date()} canNoShow={new Date(s.startsAt) <= new Date()} canCancel /> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sessions not closed">
          {!a.sessionsNotClosed.length ? <Empty>Every past session is closed.</Empty> : <ul className="grid gap-2">{a.sessionsNotClosed.map((s: any) => (
            <li key={s.id} className="grid gap-2 rounded-md border p-3 text-sm"><span>{when(s.startsAt, tz)} · {s.typeNameSnapshot} · {s.family?.guardianName}</span><SessionControls id={s.id} students={s.students} canComplete canNoShow canCancel={false} compact /></li>
          ))}</ul>}
        </Section>
        <Section title="Payments to confirm">
          {!a.reportedPayments.length ? <Empty>No reported payments waiting.</Empty> : <ul className="grid gap-2">{a.reportedPayments.map((p: any) => (
            <li key={p.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <span>{p.family?.guardianName} says they paid <b>{money(p.amountCents, cur)}</b> by {label(p.method)} · ref “{p.reference}” · for the {p.kind}</span>
              <span className="flex flex-wrap gap-2"><ActionButton op="confirmPayment" vars={{ paymentId: p.id }} label="Confirm" variant="primary" /><ActionButton op="rejectPayment" vars={{ paymentId: p.id, note: 'Not received' }} label="Not received" variant="danger" confirm="Mark this payment as not received?" /></span>
            </li>
          ))}</ul>}
        </Section>
        <Section title="Overdue invoices">
          {!a.overdueInvoices.length ? <Empty>Nothing overdue.</Empty> : <ul className="grid gap-1 text-sm">{a.overdueInvoices.map((i: any) => <li key={i.id}><Link className="underline" href={`/dashboard/platform/billing/invoices/${i.id}`}>{i.number}</Link> · {i.family?.guardianName} · {money(i.totalCents - i.paidCents, cur)} due {day(i.dueAt, tz)}</li>)}</ul>}
        </Section>
        <Section title="Low package balances">
          {!a.lowBalances.length ? <Empty>No family is running low.</Empty> : <ul className="grid gap-1 text-sm">{a.lowBalances.map((f: any) => <li key={f.familyId}><Link className="underline" href={`/dashboard/platform/families/${f.familyId}`}>{f.guardianName}</Link> · {f.minutes} minutes left</li>)}</ul>}
        </Section>
        <Section title="Homework handed in">
          {!a.homeworkHandedIn.length ? <Empty>Nothing to review.</Empty> : <ul className="grid gap-1 text-sm">{a.homeworkHandedIn.map((h: any) => <li key={h.id}>{h.student?.firstName}: {h.title} · <Link className="underline" href="/dashboard/platform/homework">Review</Link></li>)}</ul>}
        </Section>
        <Section title="New inquiries and reviews">
          {!a.newInquiries.length && !a.reviewsToApprove ? <Empty>Nothing new.</Empty> : null}
          {a.newInquiries.length ? <ul className="grid gap-1 text-sm">{a.newInquiries.map((q: any) => <li key={q.id}><Link className="underline" href="/dashboard/platform/inquiries">{q.name}</Link>{q.subject ? ` · ${q.subject}` : ''}{q.studentLevel ? ` · ${q.studentLevel}` : ''}</li>)}</ul> : null}
          {a.reviewsToApprove ? <p className="text-sm"><Link className="underline" href="/dashboard/platform/reviews">{a.reviewsToApprove} {a.reviewsToApprove === 1 ? 'review' : 'reviews'} to approve</Link></p> : null}
        </Section>
        <Section title="Weekly series weeks that need a time">
          {!a.seriesNeedingTime.length ? <Empty>Every series week is booked.</Empty> : <ul className="grid gap-1 text-sm">{a.seriesNeedingTime.map((s: any) => <li key={s.id}>{s.guardianName}: {s.dates.join(', ')} · <Link className="underline" href="/dashboard/platform/calendar/series">Open series</Link></li>)}</ul>}
        </Section>
        <Section title="Share your page">
          <CopyLink url={t.setup.pageUrl} />
        </Section>
      </div>
    </Page>
  )
}
