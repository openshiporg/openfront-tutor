import Link from 'next/link'
import { CalendarPlus, Clock, ExternalLink, MapPin, Video } from 'lucide-react'
import type { SessionDetail } from '../lib/types'
import { FUNDING_LABEL, METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL, duration, fmtDateLong, fmtTime, money, priceLabel, zoneName } from '../lib/format'
import { ChangeBooking, ConfirmOnReturn, HoldCountdown, PayButton } from './SessionActions'
import { Badge, Card, Notice, Row, Stroke, statusTone } from './ui'
import { Photo } from './Photo'

/** One booking: status, time in the family's timezone, payment, notes, homework and changes. Used by S4 and S11. */
export function SessionView({ s, token, paid, cleanUrl, footer }: { s: SessionDetail; token?: string | null; paid?: string; cleanUrl: string; footer?: React.ReactNode }) {
  const tz = s.familyTimezone || s.tutor.timezone
  const tutorName = s.tutor.tutorName || s.tutor.businessName
  const needsPay = s.status === 'pending_payment' || (s.paymentStatus === 'unpaid' && s.funding === 'card' && s.status === 'scheduled')
  const live = s.status === 'scheduled' || s.status === 'pending_payment'
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-6">
        {paid === '1' ? <ConfirmOnReturn id={s.id} token={token} cleanUrl={cleanUrl} /> : null}
        {paid === '0' ? <Notice tone="warn">The payment was not finished. You can try again below.</Notice> : null}

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[24px] font-semibold text-ink">{s.sessionName}</h2>
              <Stroke width={70} />
            </div>
            <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
          </div>
          <p className="mt-3 font-display text-[20px] font-semibold text-ink">{fmtDateLong(s.startsAt, tz)}</p>
          <p className="flex items-center gap-1.5 text-[16px] text-ink"><Clock className="size-4 text-wine" aria-hidden />{fmtTime(s.startsAt, tz)}–{fmtTime(s.endsAt, tz)} · {duration(s.durationMinutes)}</p>
          <p className="mt-1 text-[13.5px] text-ink-soft">Times in {zoneName(tz, new Date(s.startsAt))} ({tz}).</p>

          <div className="mt-4 grid gap-2 text-[15px]">
            {s.mode === 'online' ? (
              s.meetingUrl && s.status === 'scheduled' ? (
                <a href={s.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-wine underline underline-offset-4"><Video className="size-4" aria-hidden />Join the online lesson<ExternalLink className="size-3.5" aria-hidden /></a>
              ) : <p className="flex items-center gap-2 text-ink-soft"><Video className="size-4" aria-hidden />Online. {s.status === 'pending_payment' ? 'The meeting link appears once the lesson is paid.' : 'The meeting link will appear here.'}</p>
            ) : (
              <p className="flex items-center gap-2 text-ink"><MapPin className="size-4 text-wine" aria-hidden />{s.locationText || 'In person. Your tutor will confirm the place.'}</p>
            )}
            {s.students.length ? <p className="text-ink-soft">For {s.students.map((x) => x.firstName).join(' and ')}</p> : null}
          </div>

          {s.status === 'pending_payment' && s.holdEndsAt ? (
            <Notice tone="warn" className="mt-4">This time is held for you for <HoldCountdown endsAt={s.holdEndsAt} />. Pay to keep it.</Notice>
          ) : null}
          {s.status === 'released' ? <Notice tone="error" className="mt-4">This time was released because it was not paid in time. You can book another time.</Notice> : null}
          {s.status === 'cancelled' || s.status === 'late_cancelled' ? <Notice className="mt-4">Cancelled{s.cancelledBy ? ` by ${s.cancelledBy === 'tutor' ? 'your tutor' : 'you'}` : ''}{s.cancellationReason ? `: ${s.cancellationReason}` : '.'}</Notice> : null}
          {s.rescheduledFrom ? <p className="mt-3 text-[13.5px] text-ink-soft">Moved from {fmtDateLong(s.rescheduledFrom, tz)} at {fmtTime(s.rescheduledFrom, tz)}.</p> : null}

          {live ? (
            <a href={s.calendarUrl} className="mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-wine underline underline-offset-4"><CalendarPlus className="size-4" aria-hidden />Add to my calendar</a>
          ) : null}
        </Card>

        {needsPay && !s.released ? (
          <Card>
            <h2 className="font-display text-[20px] font-semibold text-ink">Payment</h2>
            <p className="mt-1 text-[16px] text-ink">{money(s.priceCents, s.currencyCode)} for this lesson.</p>
            <div className="mt-4">
              {s.canPayByCard ? <PayButton id={s.id} token={token} label={`Pay ${money(s.priceCents, s.currencyCode)} by card`} /> : null}
              {s.payDirectly || !s.canPayByCard ? (
                <div className="mt-3 rounded-xl bg-paper-deep/70 p-4 text-[15px] text-ink">
                  <p className="font-semibold">Pay {tutorName} directly</p>
                  <p className="mt-1 whitespace-pre-line text-ink-soft">{s.paymentInstructions || `${tutorName} will tell you how to pay.`}</p>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {s.note ? (
          <Card>
            <h2 className="font-display text-[20px] font-semibold text-ink">Lesson notes</h2>
            <dl className="mt-3 grid gap-3 text-[15px]">
              {s.note.covered ? <div><dt className="font-semibold text-ink">What we covered</dt><dd className="whitespace-pre-line text-ink-soft">{s.note.covered}</dd></div> : null}
              {s.note.wentWell ? <div><dt className="font-semibold text-ink">What went well</dt><dd className="whitespace-pre-line text-ink-soft">{s.note.wentWell}</dd></div> : null}
              {s.note.workOnNext ? <div><dt className="font-semibold text-ink">To work on next</dt><dd className="whitespace-pre-line text-ink-soft">{s.note.workOnNext}</dd></div> : null}
              {s.note.effort ? <div><dt className="font-semibold text-ink">Effort</dt><dd className="text-ink-soft">{s.note.effort} out of 5</dd></div> : null}
            </dl>
          </Card>
        ) : null}

        {s.homework.length ? (
          <Card>
            <h2 className="font-display text-[20px] font-semibold text-ink">Homework from this lesson</h2>
            <ul className="mt-3 grid gap-2">
              {s.homework.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
                  <span className="text-ink">{h.title}{h.dueAt ? <span className="text-ink-soft"> · due {fmtDateLong(h.dueAt, tz)}</span> : null}</span>
                  <Badge tone={statusTone(h.status)}>{h.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
            {!token ? <Link href="/account/homework" className="mt-3 inline-flex min-h-11 items-center font-semibold text-wine underline">Go to homework</Link> : null}
          </Card>
        ) : null}

        {live ? <ChangeBooking s={s} token={token} /> : null}
        {footer}
      </div>

      <aside className="grid gap-4 lg:self-start">
        <Card>
          <div className="flex items-center gap-3">
            <div className="size-14 shrink-0 overflow-hidden rounded-full"><Photo src={s.tutor.photoUrl} alt={tutorName} label={tutorName.slice(0, 1)} /></div>
            <div className="min-w-0">
              <p className="font-display text-[18px] font-semibold text-ink">{tutorName}</p>
              {s.tutor.businessName !== tutorName ? <p className="text-[13.5px] text-ink-soft">{s.tutor.businessName}</p> : null}
            </div>
          </div>
          <div className="mt-3 grid text-[15px]">
            {s.tutor.email ? <a href={`mailto:${s.tutor.email}`} className="flex min-h-11 items-center break-all text-wine underline">{s.tutor.email}</a> : null}
            {s.tutor.phone ? <a href={`tel:${s.tutor.phone.replace(/[^\d+]/g, '')}`} className="flex min-h-11 items-center text-wine underline">{s.tutor.phone}</a> : null}
          </div>
        </Card>
        <Card>
          <dl>
            <Row label="Price">{priceLabel(s.priceCents, s.currencyCode)}</Row>
            <Row label="How it is paid">{FUNDING_LABEL[s.funding] ?? s.funding}</Row>
            <Row label="Payment">{PAYMENT_LABEL[s.paymentStatus] ?? s.paymentStatus}</Row>
            {s.chargedCents > 0 ? <Row label="Charged">{money(s.chargedCents, s.currencyCode)}</Row> : null}
            {s.chargedMinutes > 0 ? <Row label="Package time used">{duration(s.chargedMinutes)}</Row> : null}
          </dl>
          {s.payments.length ? (
            <ul className="mt-3 grid gap-1 text-[13.5px] text-ink-soft">
              {s.payments.map((p) => <li key={p.id}>{METHOD_LABEL[p.method] ?? p.method}: {money(p.amountCents, s.currencyCode)} · {p.status}</li>)}
            </ul>
          ) : null}
        </Card>
      </aside>
    </div>
  )
}
