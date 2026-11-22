import Link from 'next/link'

import { ActionButton, ActionForm, LinkMaker } from '../lib/actions'
import { day, label, money, read, when } from '../lib/data'
import { Empty, Field, Pill, Section, inputClass, textareaClass } from '../lib/ui'
import { Page } from '../shell/Page'
import { SessionControls } from './SessionControls'
import { MoveSession } from './MoveSession'
import { RecordPaymentForm } from '../billing/RecordPaymentForm'

/** P22: every fact about one session, the shared and private note, and the money trail. */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await read<any>('query($id: ID!) { tutorSession(id: $id) { success error data } }', 'tutorSession', { id })
  const crumbs = [{ label: 'Calendar', href: '/dashboard/platform/calendar' }]
  if (!r.ok) return <Page title="Session" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const s = r.data
  const tz = s.timezone
  const cur = s.currencyCode
  return (
    <Page title={`${s.typeNameSnapshot} · ${when(s.startsAt, tz)}`} crumbs={crumbs}>
      <div className="flex flex-wrap gap-1.5"><Pill>{label(s.status)}</Pill><Pill>{label(s.funding)}</Pill><Pill tone={s.paymentStatus === 'unpaid' ? 'warn' : 'neutral'}>{label(s.paymentStatus)}</Pill><Pill>{label(s.source)}</Pill></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Session">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">When</dt><dd>{when(s.startsAt, tz)} to {when(s.endsAt, tz, { hour: 'numeric', minute: '2-digit' })} ({tz})</dd>
            <dt className="text-muted-foreground">Family</dt><dd><Link className="underline" href={`/dashboard/platform/families/${s.family?.id}`}>{s.family?.guardianName}</Link> · {s.family?.phone || s.family?.email}</dd>
            <dt className="text-muted-foreground">Students</dt><dd>{s.students.map((st: any, i: number) => <span key={st.id}>{i ? ', ' : ''}<Link className="underline" href={`/dashboard/platform/students/${st.id}`}>{st.firstName}</Link>{st.level ? ` (${st.level})` : ''}</span>)}</dd>
            <dt className="text-muted-foreground">Where</dt><dd>{s.mode === 'online' ? (s.joinUrl ? <a className="underline" href={s.joinUrl} target="_blank" rel="noreferrer">{s.joinUrl}</a> : 'Online: no link yet') : s.locationText || 'In person'}</dd>
            <dt className="text-muted-foreground">Price</dt><dd>{money(s.priceCents, cur)}{s.chargedCents ? ` · charged ${money(s.chargedCents, cur)}` : ''}{s.chargedMinutes ? ` · ${s.chargedMinutes} package minutes` : ''}</dd>
            {s.rescheduledFrom ? <><dt className="text-muted-foreground">Moved from</dt><dd>{when(s.rescheduledFrom, tz)} ({s.rescheduleCount} by the family)</dd></> : null}
            {s.cancellationReason ? <><dt className="text-muted-foreground">Reason</dt><dd>{s.cancellationReason} ({label(s.cancelledBy)})</dd></> : null}
            {s.guardianMessage ? <><dt className="text-muted-foreground">Family wrote</dt><dd>“{s.guardianMessage}”</dd></> : null}
            {s.holdEndsAt && s.status === 'pending_payment' ? <><dt className="text-muted-foreground">Held until</dt><dd>{when(s.holdEndsAt, tz)}</dd></> : null}
          </dl>
          {s.students.some((st: any) => st.needs) ? <div className="rounded-md border bg-muted/40 p-2 text-sm">{s.students.filter((st: any) => st.needs).map((st: any) => <p key={st.id}><b>{st.firstName}:</b> {st.needs}</p>)}</div> : null}
          <SessionControls id={s.id} students={s.students} canComplete={s.can.complete} canNoShow={s.can.noShow} canCancel={s.can.cancel} />
          <div className="flex flex-wrap gap-2">
            {s.can.excuse ? <ActionButton op="excuseSession" vars={{ sessionId: s.id }} label="Excuse the charge" confirm="Excuse this charge? Minutes come back, card money is refunded, nothing is billed." /> : null}
            {s.can.reopen ? <ActionButton op="reopenSession" vars={{ sessionId: s.id }} label="Reopen" confirm="Reopen this session? Its charge is undone until you complete it again." /> : null}
            <LinkMaker op="sessionLink" vars={{ sessionId: s.id }} label="Booking link for the family" />
            <a className="inline-flex h-11 items-center px-2 text-sm underline md:h-10" href={`/api/calendar/session/${s.id}`}>Calendar file</a>
          </div>
          {s.can.move ? <MoveSession id={s.id} startsAt={s.startsAt} timezone={tz} /> : null}
        </Section>
        <Section title="Note">
          {s.status === 'completed' || s.note ? (
            <ActionForm op="saveSessionNote" submit={s.note?.sharedAt ? 'Save note' : 'Save and share'} toVars={(f) => ({ sessionId: s.id, covered: f.get('covered'), wentWell: f.get('wentWell'), workOnNext: f.get('workOnNext'), privateNote: f.get('privateNote'), effort: f.get('effort') ? Number(f.get('effort')) : null, share: true })}>
              <Field label="What we covered"><textarea name="covered" defaultValue={s.note?.covered ?? ''} className={textareaClass} /></Field>
              <Field label="What went well"><textarea name="wentWell" defaultValue={s.note?.wentWell ?? ''} className={textareaClass} /></Field>
              <Field label="Work on next"><textarea name="workOnNext" defaultValue={s.note?.workOnNext ?? ''} className={textareaClass} /></Field>
              <Field label="Private note" hint="Only you see this."><textarea name="privateNote" defaultValue={s.note?.privateNote ?? ''} className={textareaClass} /></Field>
              <Field label="Effort"><select name="effort" defaultValue={s.note?.effort ?? ''} className={inputClass}><option value="">Not recorded</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
              <p className="text-xs text-muted-foreground">{s.note?.sharedAt ? `Shared ${when(s.note.sharedAt, tz)}` : 'Not shared yet.'}</p>
            </ActionForm>
          ) : <Empty>Complete the session to write its note.</Empty>}
          {s.homework.length ? <ul className="grid gap-1 text-sm">{s.homework.map((h: any) => <li key={h.id}>{h.student?.firstName}: {h.title} · {label(h.status)}{h.dueAt ? ` · due ${day(h.dueAt, tz)}` : ''}</li>)}</ul> : null}
        </Section>
        <Section title="Money trail">
          {!s.creditEntries.length && !s.payments.length && !s.paymentSessions.length && !s.invoiceLines.length ? <Empty>No money has moved for this session.</Empty> : null}
          {s.creditEntries.length ? <ul className="grid gap-1 text-sm">{s.creditEntries.map((e: any) => <li key={e.id}>{when(e.createdAt, tz)} · {label(e.kind)} · {e.minutes > 0 ? '+' : ''}{e.minutes} min balance, {e.heldChange > 0 ? '+' : ''}{e.heldChange} held · {e.purchase?.nameSnapshot}{e.note ? ` · ${e.note}` : ''}</li>)}</ul> : null}
          {s.payments.length ? <ul className="grid gap-1 text-sm">{s.payments.map((p: any) => <li key={p.id}>{label(p.kind)} · {label(p.method)} · {money(p.amountCents, cur)} · {label(p.status)}{p.refundedCents ? ` (refunded ${money(p.refundedCents, cur)})` : ''}{p.kind !== 'refund' ? <> · <Link className="underline" href={`/dashboard/platform/billing/payments/${p.id}`}>Open</Link></> : null}</li>)}</ul> : null}
          {s.paymentSessions.length ? <ul className="grid gap-1 text-sm text-muted-foreground">{s.paymentSessions.map((c: any) => <li key={c.id}>Card page opened {when(c.createdAt, tz)} · {money(c.amountCents, cur)} · {label(c.status)}</li>)}</ul> : null}
          {s.invoiceLines.map((l: any) => <p key={l.invoice.id} className="text-sm">On invoice <Link className="underline" href={`/dashboard/platform/billing/invoices/${l.invoice.id}`}>{l.invoice.number}</Link> ({label(l.invoice.status)})</p>)}
          {s.can.recordPayment ? <RecordPaymentForm target="session" targetId={s.id} defaultCents={s.status === 'late_cancelled' || s.status === 'no_show' ? s.chargedCents : s.priceCents} currency={cur} /> : null}
        </Section>
      </div>
    </Page>
  )
}
