import Link from 'next/link'
import { ChevronRight, MapPin, Video } from 'lucide-react'
import type { FamilySession } from '../lib/types'
import { FUNDING_LABEL, STATUS_LABEL, dayLabel, dateKey, fmtTime } from '../lib/format'
import { Badge, statusTone } from './ui'

/** Rows of sessions, each opening its session page (S11). Times in the family's timezone. */
export function SessionList({ sessions, tz }: { sessions: FamilySession[]; tz: string }) {
  return (
    <ul className="grid gap-3">
      {sessions.map((s) => {
        const d = dayLabel(dateKey(new Date(s.startsAt), tz))
        return (
          <li key={s.id}>
            <Link href={`/account/sessions/${s.id}`} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-line/70 bg-white/80 p-3 pr-4 shadow-[0_1px_2px_rgba(28,42,74,0.06)] hover:border-wine/50">
              <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-paper-deep py-1.5 text-ink">
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-wine">{d.weekday}</span>
                <span className="font-display text-[22px] font-semibold leading-none">{d.day}</span>
                <span className="text-[11.5px] text-ink-soft">{d.month}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{s.typeNameSnapshot}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-soft">
                  {fmtTime(s.startsAt, tz)}–{fmtTime(s.endsAt, tz)}
                  <span className="inline-flex items-center gap-1">{s.mode === 'online' ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}{s.mode === 'online' ? 'Online' : 'In person'}</span>
                  {s.students.length ? <span>· {s.students.map((x) => x.firstName).join(', ')}</span> : null}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  {s.status !== 'cancelled' && s.status !== 'released' ? <Badge tone="muted">{FUNDING_LABEL[s.funding] ?? s.funding}</Badge> : null}
                  {s.paymentStatus === 'unpaid' && s.funding === 'card' ? <Badge tone="amber">To pay</Badge> : null}
                  {s.note?.sharedAt ? <Badge tone="wine">Notes</Badge> : null}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-soft" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function ErrorPage({ error }: { error: string | null }) {
  return <div role="alert" className="rounded-xl border border-wine/40 bg-wine/5 px-4 py-3 text-[15px] text-wine-dark">{error ?? 'This page could not be loaded. Try again.'}</div>
}
