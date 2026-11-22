import Link from 'next/link'

import { ActionButton, ActionForm } from '../lib/actions'
import { day, label, lists, money, read, when } from '../lib/data'
import { Empty, Field, Pill, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'
import { RecordPaymentForm } from '../billing/RecordPaymentForm'
import { FamilyDetailsForm, StudentForm } from './FamilyForms'
import { InviteButton } from './InviteButton'

/** P15 family page, P16 invite, P17 status, P26 sell a package, P27 refund minutes, P28 adjust minutes. */
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await read<any>('query($id: ID!) { tutorFamily(id: $id) { success error data } }', 'tutorFamily', { id })
  const crumbs = [{ label: 'Families', href: '/dashboard/platform/families' }]
  if (!r.ok) return <Page title="Family" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const f = r.data
  const tz = f.timezone
  const cur = f.currencyCode
  const opts = await lists<any>('query { packages(where: { active: { equals: true } }, orderBy: { sortOrder: asc }) { id name minutes priceCents } subjects(where: { active: { equals: true } }) { id name } }')
  return (
    <Page title={f.guardianName} crumbs={crumbs} actions={<span className="flex flex-wrap gap-1.5"><Pill tone={f.status === 'active' ? 'good' : f.status === 'blocked' ? 'bad' : 'neutral'}>{label(f.status)}</Pill><Pill>{label(f.billingMode)}</Pill>{f.hasAccount ? <Pill tone="good">Has an account</Pill> : null}</span>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Contact and billing"><FamilyDetailsForm f={f} /></Section>
        <Section title="Account">
          {f.hasAccount ? <p className="text-sm">{f.guardianName} signs in with {f.email}. They can reset their password from the sign-in page.</p> : <InviteButton familyId={f.id} hasEmail={Boolean(f.email)} open={f.inviteOpen} />}
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="underline" href={`/dashboard/platform/calendar`}>Book a session (calendar)</Link>
            <Link className="underline" href={`/dashboard/platform/calendar/series`}>Weekly series</Link>
            <Link className="underline" href={`/dashboard/platform/billing?family=${f.id}`}>Invoice this family</Link>
          </div>
          {f.series.length ? <ul className="grid gap-1 text-sm">{f.series.map((s: any) => <li key={s.id}>Weekly: {s.sessionType?.name} · {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek]} {String(Math.floor(s.startMinute / 60)).padStart(2, '0')}:{String(s.startMinute % 60).padStart(2, '0')} · {label(s.status)}</li>)}</ul> : null}
        </Section>
        <Section title="Students">
          {f.students.map((s: any) => (
            <details key={s.id} className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">{s.firstName} {s.lastName} · {s.level} {s.status !== 'active' ? `(${s.status})` : ''} · <Link className="underline" href={`/dashboard/platform/students/${s.id}`}>Open</Link></summary>
              <div className="mt-3"><StudentForm familyId={f.id} s={s} subjects={opts?.subjects ?? []} /></div>
            </details>
          ))}
          <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Add a student</summary><div className="mt-3"><StudentForm familyId={f.id} subjects={opts?.subjects ?? []} /></div></details>
        </Section>
        <Section title="Packages and minutes">
          {!f.purchases.length ? <Empty>No packages.</Empty> : f.purchases.map((p: any) => (
            <div key={p.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <p className="font-medium">{p.nameSnapshot} · {p.minutesRemaining} of {p.minutesGranted} min left · <Pill tone={p.status === 'active' ? 'good' : 'neutral'}>{label(p.status)}</Pill>{!p.ledgerOk ? <Pill tone="bad">Ledger mismatch</Pill> : null}</p>
              <p className="text-muted-foreground">{money(p.pricePaidCents, cur)}{p.refundedCents ? ` · refunded ${money(p.refundedCents, cur)}` : ''}{p.expiresAt ? ` · expires ${day(p.expiresAt, tz)}` : ''}</p>
              <details><summary className="cursor-pointer">Ledger ({p.entries.length})</summary><ul className="mt-1 grid gap-0.5">{p.entries.map((e: any) => <li key={e.id}>{when(e.createdAt, tz)} · {label(e.kind)} · {e.minutes > 0 ? '+' : ''}{e.minutes} min{e.heldChange ? ` (held ${e.heldChange > 0 ? '+' : ''}${e.heldChange})` : ''}{e.note ? ` · ${e.note}` : ''}{e.session ? <> · <Link className="underline" href={`/dashboard/platform/sessions/${e.session.id}`}>session</Link></> : null}</li>)}</ul></details>
              {p.status === 'awaiting_payment' ? <><RecordPaymentForm target="package" targetId={p.id} defaultCents={p.pricePaidCents} currency={cur} /><ActionButton op="cancelPackagePurchase" vars={{ purchaseId: p.id }} label="Cancel this package" variant="danger" confirm="Cancel this unpaid package?" /></> : null}
              {['active', 'used_up', 'expired'].includes(p.status) && p.minutesRemaining > 0 ? <ActionButton op="refundPackage" vars={{ purchaseId: p.id }} label="Refund unused minutes" variant="danger" confirm={`Refund ${p.minutesRemaining} unused minutes, pro rata of the price paid? A card payment is refunded through Stripe.`} done={(d) => `Refunded ${money(d?.refundedCents, cur)}.`} /> : null}
              {['active', 'used_up'].includes(p.status) ? (
                <ActionForm op="adjustMinutes" submit="Adjust minutes" className="grid gap-2 sm:grid-cols-3" toVars={(x) => ({ purchaseId: p.id, minutes: Math.trunc(Number(x.get('minutes'))), reason: x.get('reason') })}>
                  <Field label="Minutes (+ or −)"><input name="minutes" type="number" step="1" required className={inputClass} /></Field>
                  <Field label="Reason"><input name="reason" required className={inputClass} /></Field>
                </ActionForm>
              ) : null}
            </div>
          ))}
          {opts?.packages?.length ? (
            <ActionForm op="sellPackage" submit="Sell package" className="grid gap-2 rounded-md border p-3 sm:grid-cols-3" toVars={(x) => ({ familyId: f.id, packageId: x.get('packageId'), method: x.get('method'), reference: x.get('reference') })} done={() => 'Sold and paid; the minutes are ready to use.'}>
              <Field label="Package"><select name="packageId" className={inputClass}>{opts.packages.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {money(p.priceCents, cur)}</option>)}</select></Field>
              <Field label="Paid with"><select name="method" className={inputClass}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="other">Other</option></select></Field>
              <Field label="Reference"><input name="reference" className={inputClass} /></Field>
            </ActionForm>
          ) : <Empty>Add packages in <Link className="underline" href="/dashboard/platform/settings/packages">Settings → Packages</Link> to sell one.</Empty>}
        </Section>
        <Section title="Sessions">
          {!f.sessions.length ? <Empty>No sessions yet.</Empty> : <ul className="grid max-h-96 gap-1 overflow-y-auto text-sm">{f.sessions.map((s: any) => <li key={s.id}><Link className="underline" href={`/dashboard/platform/sessions/${s.id}`}>{when(s.startsAt, tz)}</Link> · {s.typeNameSnapshot} · {label(s.status)} · {label(s.funding)}{s.paymentStatus === 'unpaid' ? ' · unpaid' : ''}</li>)}</ul>}
        </Section>
        <Section title="Invoices and payments">
          {f.invoices.length ? <ul className="grid gap-1 text-sm">{f.invoices.map((i: any) => <li key={i.id}><Link className="underline" href={`/dashboard/platform/billing/invoices/${i.id}`}>{i.number}</Link> · {label(i.status)} · {money(i.totalCents, cur)} (paid {money(i.paidCents, cur)}){i.overdue ? <Pill tone="bad">Overdue</Pill> : null}</li>)}</ul> : <Empty>No invoices.</Empty>}
          {f.payments.length ? <ul className="grid gap-1 text-sm">{f.payments.map((p: any) => <li key={p.id}>{when(p.paidAt, tz)} · {label(p.kind)} · {label(p.method)} · {money(p.amountCents, cur)} · {label(p.status)}{p.reference ? ` · ${p.reference}` : ''} · <Link className="underline" href={`/dashboard/platform/billing/payments/${p.id}`}>Open</Link></li>)}</ul> : null}
        </Section>
      </div>
    </Page>
  )
}
