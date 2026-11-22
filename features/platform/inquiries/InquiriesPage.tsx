import Link from 'next/link'

import { ActionButton } from '../lib/actions'
import { ConvertInquiryForm } from '../lib/forms'
import { label, lists, read, when } from '../lib/data'
import { Empty, Field, Pill, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'

/** P37: inquiries: read, mark contacted, convert to a family (with an invite link), close. */
export default async function InquiriesPage() {
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Inquiries" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const d = await lists<any>('query { inquiries(orderBy: { createdAt: desc }, take: 300) { id name email phone studentLevel subject message status createdAt family { id guardianName } } }')
  const tz = b.data.profile.timezone
  const open = (d?.inquiries ?? []).filter((q: any) => ['new', 'contacted'].includes(q.status))
  const closed = (d?.inquiries ?? []).filter((q: any) => !['new', 'contacted'].includes(q.status))
  return (
    <Page title="Inquiries">
      <Section title={`Open (${open.length})`}>
        {!open.length ? <Empty>No open inquiries. The “Ask about tutoring” form on your page lands here.</Empty> : open.map((q: any) => (
          <div key={q.id} className="grid gap-2 rounded-md border p-3 text-sm">
            <p className="font-medium">{q.name} <Pill tone={q.status === 'new' ? 'warn' : 'neutral'}>{label(q.status)}</Pill> <span className="font-normal text-muted-foreground">{when(q.createdAt, tz)}</span></p>
            <p>{[q.email && <a key="e" className="underline" href={`mailto:${q.email}`}>{q.email}</a>, q.phone && <a key="p" className="underline" href={`tel:${q.phone}`}>{q.phone}</a>].filter(Boolean).map((x: any, i: number) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}{q.subject ? ` · ${q.subject}` : ''}{q.studentLevel ? ` · ${q.studentLevel}` : ''}</p>
            {q.message ? <p className="whitespace-pre-wrap">{q.message}</p> : null}
            <div className="flex flex-wrap gap-2">
              {q.status === 'new' ? <ActionButton op="setInquiryStatus" vars={{ id: q.id, status: 'contacted' }} label="Mark contacted" /> : null}
              <ActionButton op="setInquiryStatus" vars={{ id: q.id, status: 'closed' }} label="Close" variant="danger" confirm="Close this inquiry?" />
            </div>
            <ConvertInquiryForm id={q.id} className="grid gap-2 sm:grid-cols-3">
              <Field label="Student name"><input name="studentName" className={inputClass} /></Field>
              <Field label="Billing"><select name="billingMode" className={inputClass}><option value="pay_as_you_book">Pays as they book</option><option value="invoice">Invoiced later</option><option value="flat_monthly">Flat monthly fee</option></select></Field>
            </ConvertInquiryForm>
          </div>
        ))}
      </Section>
      <Section title="Closed and converted">
        {!closed.length ? <Empty>None yet.</Empty> : <ul className="grid gap-1 text-sm">{closed.map((q: any) => <li key={q.id}>{when(q.createdAt, tz)} · {q.name} · {label(q.status)}{q.family ? <> · <Link className="underline" href={`/dashboard/platform/families/${q.family.id}`}>{q.family.guardianName}</Link></> : null}</li>)}</ul>}
      </Section>
    </Page>
  )
}
