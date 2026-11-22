import Link from 'next/link'

import { day, label, money, read } from '../lib/data'
import { Empty, Field, Pill, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'
import { NewFamilyForm } from './FamilyForms'

const STATUSES = ['lead', 'active', 'paused', 'former', 'blocked']

/** P14: families with status, owing, minutes left, next session. */
export default async function FamiliesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams
  const r = await read<any>('query($status: String, $search: String) { familiesOverview(status: $status, search: $search) { success error data } }', 'familiesOverview', { status: STATUSES.includes(sp.status || '') ? sp.status : null, search: sp.q || null })
  if (!r.ok) return <Page title="Families" error={r.error} needsSetup={r.needsSetup} />
  const { families, currencyCode: cur, timezone: tz } = r.data
  return (
    <Page title="Families">
      <form className="flex flex-wrap items-end gap-2" action="">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ''} placeholder="Name, email, phone or student" className={inputClass} /></Field>
        <Field label="Status"><select name="status" defaultValue={sp.status ?? ''} className={inputClass}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
        <button className="h-11 rounded-md border px-4 text-sm md:h-10" type="submit">Show</button>
      </form>
      {!families.length ? <Empty>No families{sp.q || sp.status ? ' match' : ' yet'}.</Empty> : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="p-2">Family</th><th className="p-2">Students</th><th className="p-2">Status</th><th className="p-2">Billing</th><th className="p-2 text-right">Owing</th><th className="p-2 text-right">Minutes left</th><th className="p-2">Next session</th></tr></thead>
            <tbody>{families.map((f: any) => (
              <tr key={f.id} className="border-t">
                <td className="p-2"><Link className="font-medium underline" href={`/dashboard/platform/families/${f.id}`}>{f.guardianName}</Link><div className="text-xs text-muted-foreground">{f.email || f.phone}{f.hasAccount ? ' · has account' : ''}</div></td>
                <td className="p-2">{f.students.map((s: any) => s.firstName).join(', ')}</td>
                <td className="p-2"><Pill tone={f.status === 'active' ? 'good' : f.status === 'blocked' ? 'bad' : 'neutral'}>{label(f.status)}</Pill></td>
                <td className="p-2">{label(f.billingMode)}</td>
                <td className="p-2 text-right tabular-nums">{f.owingCents ? money(f.owingCents, cur) : '–'}{f.overdue ? <Pill tone="bad">Overdue</Pill> : null}</td>
                <td className="p-2 text-right tabular-nums">{f.minutesLeft || '–'}</td>
                <td className="p-2">{f.nextSession ? day(f.nextSession, tz) : '–'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Section title="Add a family"><NewFamilyForm /></Section>
    </Page>
  )
}
