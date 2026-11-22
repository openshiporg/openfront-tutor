import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'
import { getMySessions } from '@/features/storefront/lib/data/account'
import { ErrorPage, SessionList } from '@/features/storefront/components/SessionList'
import { CalendarFeed } from '@/features/storefront/components/CalendarFeed'
import { ButtonLink, Empty, PageTitle, cx } from '@/features/storefront/components/ui'
import { safeZone } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Sessions' }
export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'upcoming', label: 'Coming up' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
] as const

/** S11 list, S21 calendar feed. */
export default async function Page({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: raw } = await searchParams
  const range = (TABS.find((t) => t.key === raw)?.key ?? 'upcoming') as 'upcoming' | 'past' | 'all'
  const r = await getMySessions(range)
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const tz = safeZone(r.data.timezone)
  return (
    <>
      <PageTitle sub={`Times are in ${tz}.`} action={<ButtonLink href="/account/book"><CalendarDays className="size-4" aria-hidden />Book a lesson</ButtonLink>}>Sessions</PageTitle>
      <nav aria-label="Which sessions" className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/account/sessions?range=${t.key}`} aria-current={range === t.key ? 'page' : undefined}
            className={cx('inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold', range === t.key ? 'border-wine bg-wine text-white' : 'border-line bg-white text-ink hover:border-wine/50')}>{t.label}</Link>
        ))}
      </nav>
      {r.data.sessions.length ? <SessionList sessions={r.data.sessions} tz={tz} /> : (
        <Empty action={range === 'upcoming' ? <ButtonLink href="/account/book">Book a lesson</ButtonLink> : undefined}>{range === 'upcoming' ? 'No lessons coming up.' : 'No sessions here yet.'}</Empty>
      )}
      <div className="mt-8"><CalendarFeed /></div>
    </>
  )
}
