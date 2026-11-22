import Link from 'next/link'

import { CopyLink, LinkMaker } from '../lib/actions'
import { label, lists, money, read, when } from '../lib/data'
import { Empty, Notice, Pill, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { BookingRulesForm, BusinessForm, HoursRow, PackageForm, PaymentSettingsForm, SessionTypeForm, SubjectForm } from './SettingsForms'
import { DAYS } from './days'

const PROFILE_FIELDS = 'id businessName tutorName slug headline bio photoUrl heroImageUrl qualifications phone email city country timezone currencyCode teachesOnline teachesInPerson inPersonArea defaultMeetingUrl bookingOpen reviewsEnabled slotMinutes bufferMinutes minNoticeHours maxAdvanceDays cancellationWindowHours lateCancelPercent noShowPercent unpaidHoldMinutes reschedulesAllowed paymentInstructions policiesText invoiceDueDays'

const crumbs = [{ label: 'Settings', href: '/dashboard/platform/settings' }]

export const settingsLinks = [
  { href: '/dashboard/platform/settings', title: 'Business and page' },
  { href: '/dashboard/platform/settings/hours', title: 'Weekly hours' },
  { href: '/dashboard/platform/settings/services', title: 'Session types and subjects' },
  { href: '/dashboard/platform/settings/packages', title: 'Packages' },
  { href: '/dashboard/platform/settings/booking', title: 'Booking rules and policies' },
  { href: '/dashboard/platform/settings/payments', title: 'Payments' },
  { href: '/dashboard/platform/settings/messages', title: 'Messages' },
]

function SettingsNav({ here }: { here: string }) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Settings">
      {settingsLinks.map((l) => <Link key={l.href} href={l.href} className={`rounded-md border px-3 py-2 ${l.href === here ? 'bg-muted font-medium' : 'hover:bg-muted'}`}>{l.title}</Link>)}
    </nav>
  )
}

async function profile() {
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return { ok: false as const, error: b.ok ? null : b.error, needsSetup: !b.ok ? b.needsSetup : true }
  const d = await lists<any>(`query($id: ID!) { tutorProfile(where: { id: $id }) { ${PROFILE_FIELDS} } }`, { id: b.data.profile.id })
  if (!d?.tutorProfile) return { ok: false as const, error: 'Your business could not be read. Try again.', needsSetup: false }
  return { ok: true as const, p: d.tutorProfile, business: b.data }
}

/** P39 business details, page text, photo; P43 default lesson link. */
export async function SettingsPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Settings" error={r.error} needsSetup={r.needsSetup} />
  return (
    <Page title="Settings">
      <SettingsNav here="/dashboard/platform/settings" />
      <Section title="Your page"><CopyLink url={r.business.pageUrl} /></Section>
      <Section title="Business and page"><BusinessForm p={r.p} /></Section>
      <Section title="Your calendar feed" aside={<span className="text-xs text-muted-foreground">Add your lessons to Google or Apple Calendar (read only).</span>}>
        <LinkMaker op="tutorCalendarFeedUrl" vars={{}} label="Show my calendar link" />
      </Section>
    </Page>
  )
}

/** P13 weekly hours. */
export async function HoursPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Weekly hours" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const d = await lists<any>('query { weeklyHoursRows(take: 50) { id dayOfWeek isWorking startMinute endMinute breakStartMinute breakEndMinute } }')
  const rows: any[] = d?.weeklyHoursRows ?? []
  return (
    <Page title="Weekly hours" crumbs={crumbs}>
      <SettingsNav here="/dashboard/platform/settings/hours" />
      <p className="text-sm text-muted-foreground">Times are in {r.p.timezone}. Families see them in their own timezone. Add time off on the <Link className="underline" href="/dashboard/platform/calendar">calendar</Link>.</p>
      <div className="grid gap-2">{DAYS.map((day) => <HoursRow key={day} day={day} row={rows.find((x) => x.dayOfWeek === day) ?? null} />)}</div>
    </Page>
  )
}

/** P23 session types and P24 subjects. */
export async function ServicesPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Session types and subjects" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const d = await lists<any>('query { sessionTypes(orderBy: [{ sortOrder: asc }, { name: asc }], take: 200) { id name description durationMinutes priceCents mode openToNewFamilies maxStudents active sortOrder subjects { id } } subjects(orderBy: [{ sortOrder: asc }, { name: asc }], take: 200) { id name levels sortOrder active } }')
  const cur = r.p.currencyCode
  const subjects = d?.subjects ?? []
  return (
    <Page title="Session types and subjects" crumbs={crumbs}>
      <SettingsNav here="/dashboard/platform/settings/services" />
      <Section title="Session types">
        {!d?.sessionTypes?.length ? <Empty>No session types yet. Add one below.</Empty> : d.sessionTypes.map((t: any) => (
          <details key={t.id} className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm"><b>{t.name}</b> · {t.durationMinutes} min · {t.priceCents ? money(t.priceCents, cur) : 'Free'} · {label(t.mode)} {t.openToNewFamilies ? <Pill tone="good">New families</Pill> : null} {!t.active ? <Pill tone="warn">Not offered</Pill> : null}</summary>
            <div className="pt-3"><SessionTypeForm t={t} subjects={subjects} currency={cur} /></div>
          </details>
        ))}
        <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Add a session type</summary><div className="pt-3"><SessionTypeForm subjects={subjects} currency={cur} /></div></details>
      </Section>
      <Section title="Subjects and levels">
        {subjects.map((s: any) => <SubjectForm key={s.id} s={s} />)}
        <SubjectForm />
      </Section>
    </Page>
  )
}

/** P25 packages. */
export async function PackagesPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Packages" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const d = await lists<any>('query { packages(orderBy: [{ sortOrder: asc }, { name: asc }], take: 200) { id name description minutes priceCents validMonths active sortOrder appliesTo { id } } sessionTypes(where: { active: { equals: true } }, orderBy: { sortOrder: asc }, take: 200) { id name } }')
  const cur = r.p.currencyCode
  return (
    <Page title="Packages" crumbs={crumbs}>
      <SettingsNav here="/dashboard/platform/settings/packages" />
      <p className="text-sm text-muted-foreground">Families buy hours up front and each session draws from them. Sell one by hand from a family's page.</p>
      <Section title="Packages">
        {!d?.packages?.length ? <Empty>No packages yet.</Empty> : d.packages.map((pk: any) => (
          <details key={pk.id} className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm"><b>{pk.name}</b> · {pk.minutes / 60} h · {money(pk.priceCents, cur)} · {pk.validMonths} months {!pk.active ? <Pill tone="warn">Not on sale</Pill> : null}</summary>
            <div className="pt-3"><PackageForm pk={pk} types={d.sessionTypes} currency={cur} /></div>
          </details>
        ))}
        <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Add a package</summary><div className="pt-3"><PackageForm types={d?.sessionTypes ?? []} currency={cur} /></div></details>
      </Section>
    </Page>
  )
}

/** P40 booking rules and P41 policies. */
export async function BookingRulesPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Booking rules and policies" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  return (
    <Page title="Booking rules and policies" crumbs={crumbs}>
      <SettingsNav here="/dashboard/platform/settings/booking" />
      <Section title="Booking rules and policies"><BookingRulesForm p={r.p} /></Section>
    </Page>
  )
}

/** P42 payments: Stripe status read from Stripe, payment instructions, invoice due days, currency. */
export async function PaymentSettingsPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Payments" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const s = await read<any>('query { paymentSettings { success error data } }', 'paymentSettings')
  const st = s.ok ? s.data.stripe : null
  return (
    <Page title="Payment settings" crumbs={crumbs}>
      <SettingsNav here="/dashboard/platform/settings/payments" />
      <Section title="Cards (Stripe)">
        {!s.ok ? <Notice tone="alert">{s.error}</Notice> : st?.connected ? (
          <div className="grid gap-2 text-sm">
            <p><Pill tone="good">Connected</Pill> Stripe answered with {st.mode}. Families can pay by card at booking, for packages and invoices.</p>
            <p>Webhook address for Stripe: <code className="break-all">{s.data.webhookUrl}</code> {s.data.webhookSecretSet ? <Pill tone="good">Signing secret set</Pill> : <Pill tone="warn">Set STRIPE_WEBHOOK_SECRET so payments settle even if the family closes the page</Pill>}</p>
          </div>
        ) : st?.error ? <Notice tone="alert">Stripe refused the key: {st.error}</Notice> : (
          <p className="text-sm">Families pay you directly with the instructions below and tell you when they have paid; you confirm it under Billing. To take cards as well, set <code>STRIPE_SECRET_KEY</code> on your server.</p>
        )}
      </Section>
      <Section title="Paying you directly"><PaymentSettingsForm p={r.p} /></Section>
    </Page>
  )
}

/** P44 message log: what was sent, failed or skipped and why. */
export async function MessagesPage() {
  const r = await profile()
  if (!r.ok) return <Page title="Messages" crumbs={crumbs} error={r.error} needsSetup={r.needsSetup} />
  const d = await lists<any>('query { notificationLogs(orderBy: { createdAt: desc }, take: 200) { id kind to subject link status error createdAt } }')
  const tz = r.p.timezone
  return (
    <Page title="Messages" crumbs={crumbs}>
      <SettingsNav here="/dashboard/platform/settings/messages" />
      {!r.business.mail ? <Notice>Email is not set up (SMTP), so messages are not sent. Each one is listed here with its link: copy it and send it by WhatsApp or text.</Notice> : null}
      {!d?.notificationLogs?.length ? <Empty>No messages yet.</Empty> : (
        <ul className="grid gap-2 text-sm">{d.notificationLogs.map((n: any) => (
          <li key={n.id} className="grid min-w-0 gap-1.5 rounded-md border p-3">
            <span className="flex flex-wrap items-center gap-2"><Pill tone={n.status === 'sent' ? 'good' : n.status === 'failed' ? 'bad' : 'warn'}>{label(n.status)}</Pill><b className="min-w-0">{n.subject}</b></span>
            <span className="text-muted-foreground">{when(n.createdAt, tz)} · to {n.to || 'no address'} · {label(n.kind)}{n.error ? ` · ${n.error}` : ''}</span>
            {n.link && n.status !== 'sent' ? <CopyLink url={n.link} /> : null}
          </li>
        ))}</ul>
      )}
    </Page>
  )
}
