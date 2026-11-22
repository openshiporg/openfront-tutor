import { DeleteItemButton } from '../lib/actions'
import { day, label, lists, money, read } from '../lib/data'
import { Empty, Field, inputClass, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { zonedToIso } from '../lib/time'
import { CsvButton, ExpenseForm } from './EarningsForms'

const isDate = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s))

/** P35 earnings and P36 expenses. Range is whole days in the tutor's timezone, `to` inclusive. */
export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Earnings" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const tz: string = b.data.profile.timezone
  const cur: string = b.data.profile.currencyCode
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const from = isDate(sp.from) ? sp.from! : `${todayLocal.slice(0, 4)}-01-01`
  const to = isDate(sp.to) ? sp.to! : todayLocal
  const fromIso = zonedToIso(from, '00:00', tz)
  const next = new Date(Date.parse(`${to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const toIso = zonedToIso(next, '00:00', tz)
  const r = await read<any>('query($from: String!, $to: String!) { myEarnings(from: $from, to: $to) { success error data } }', 'myEarnings', { from: fromIso, to: toIso })
  const ex = await lists<any>('query($from: DateTime!, $to: DateTime!) { expenses(where: { spentOn: { gte: $from, lt: $to } }, orderBy: { spentOn: desc }, take: 500) { id spentOn category amountCents note } }', { from: fromIso, to: toIso })
  if (!r.ok) return <Page title="Earnings" error={r.error} />
  const e = r.data
  const stats: Array<[string, string, string?]> = [
    ['Money in', money(e.inCents, cur), e.refundsCents ? `after ${money(e.refundsCents, cur)} refunded` : undefined],
    ['Expenses', money(e.expensesCents, cur)],
    ['Net', money(e.netCents, cur)],
    ['Sessions taught', String(e.sessionsTaught), `${e.hoursTaught} hours`],
    ['Packages sold', String(e.packagesSold), money(e.packagesSoldCents, cur)],
    ['Prepaid, not yet taught', money(e.prepaidUnearnedCents, cur), `${e.prepaidMinutes} minutes owed in lessons`],
    ['Owed to you (sent invoices)', money(e.outstandingCents, cur)],
  ]
  const maxMonth = Math.max(1, ...e.byMonth.map((m: any) => m.cents))
  return (
    <Page title="Earnings" actions={<span className="flex flex-wrap gap-2"><CsvButton kind="payments" from={fromIso} to={toIso} /><CsvButton kind="sessions" from={fromIso} to={toIso} /></span>}>
      <form className="flex flex-wrap items-end gap-2">
        <Field label="From"><input type="date" name="from" defaultValue={from} className={inputClass} /></Field>
        <Field label="To"><input type="date" name="to" defaultValue={to} className={inputClass} /></Field>
        <button className="h-11 rounded-md border px-4 text-sm md:h-10" type="submit">Show</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([k, v, sub]) => (
          <div key={k} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-semibold">{v}</p>{sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}</div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Money in by month">
          {!e.byMonth.length ? <Empty>No payments in this range.</Empty> : <ul className="grid gap-1.5 text-sm">{e.byMonth.map((m: any) => (
            <li key={m.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2"><span>{m.month}</span><span className="h-3 rounded bg-foreground/70" style={{ width: `${Math.max(2, (m.cents / maxMonth) * 100)}%` }} /><span>{money(m.cents, cur)}</span></li>
          ))}</ul>}
        </Section>
        <Section title="Money in by method">
          {!e.byMethod.length ? <Empty>No payments in this range.</Empty> : <ul className="grid gap-1 text-sm">{e.byMethod.map((m: any) => <li key={m.method} className="flex justify-between"><span>{label(m.method)}</span><span>{money(m.cents, cur)}</span></li>)}</ul>}
        </Section>
      </div>
      <Section title="Expenses" aside={e.expensesByCategory.length ? <span className="text-xs text-muted-foreground">{e.expensesByCategory.map((c: any) => `${label(c.category)} ${money(c.cents, cur)}`).join(' · ')}</span> : null}>
        {!ex?.expenses?.length ? <Empty>No expenses in this range.</Empty> : <ul className="grid gap-2 text-sm">{ex.expenses.map((x: any) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
            <span className="min-w-0">{day(x.spentOn, tz)} · {label(x.category)} · <b>{money(x.amountCents, cur)}</b>{x.note ? <span className="text-muted-foreground"> · {x.note}</span> : null}</span>
            <DeleteItemButton list="Expense" id={x.id} confirm="Remove this expense?" />
          </li>
        ))}</ul>}
        <ExpenseForm currency={cur} defaultDate={todayLocal} />
      </Section>
    </Page>
  )
}
