'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CreditCard, XCircle } from 'lucide-react'
import type { SessionDetail } from '../lib/types'
import { cancelBooking, confirmPayment, rescheduleBooking, startPayment } from '../lib/data/session-actions'
import { fmtDateTime, money, zoneName } from '../lib/format'
import { SlotPicker, useViewerZone } from './SlotPicker'
import { Button, Card, Field, Notice, inputClass } from './ui'

/** Counts down the unpaid hold (S3). Reloads the page when it runs out. */
export function HoldCountdown({ endsAt }: { endsAt: string }) {
  const router = useRouter()
  const [left, setLeft] = useState(() => new Date(endsAt).getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => {
      const l = new Date(endsAt).getTime() - Date.now()
      setLeft(l)
      if (l <= 0) { clearInterval(t); router.refresh() }
    }, 1000)
    return () => clearInterval(t)
  }, [endsAt, router])
  if (left <= 0) return <span>The hold has ended.</span>
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return <span aria-live="polite" className="font-mono font-semibold tabular-nums">{m}:{String(s).padStart(2, '0')}</span>
}

/** Pay by card (opens Stripe Checkout). */
export function PayButton({ id, token, label }: { id: string; token?: string | null; label: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="grid gap-2">
      <Button className="min-h-12 w-full sm:w-auto" disabled={pending} onClick={() => start(async () => {
        setError(null)
        const r = await startPayment({ id, token })
        if (!r.success || !r.data?.url) { setError(r.error); return }
        window.location.assign(r.data.url)
      })}><CreditCard className="size-5" aria-hidden />{pending ? 'Opening secure payment…' : label}</Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  )
}

/** On return from Stripe with paid=1: confirm once, then re-read. */
export function ConfirmOnReturn({ id, token, cleanUrl }: { id: string; token?: string | null; cleanUrl: string }) {
  const router = useRouter()
  const done = useRef(false)
  const [msg, setMsg] = useState<{ tone: 'info' | 'success' | 'error'; text: string }>({ tone: 'info', text: 'Checking your payment…' })
  useEffect(() => {
    if (done.current) return
    done.current = true
    confirmPayment({ id, token }).then((r) => {
      if (!r.success) setMsg({ tone: 'error', text: r.error ?? 'We could not check the payment yet. Refresh in a moment.' })
      else if (r.data?.paid) { setMsg({ tone: 'success', text: 'Payment received. Your lesson is booked.' }); router.replace(cleanUrl); router.refresh() }
      else setMsg({ tone: 'info', text: 'Your payment is not complete yet. If you paid, refresh this page in a moment.' })
    })
  }, [id, token, cleanUrl, router])
  return <Notice tone={msg.tone}>{msg.text}</Notice>
}

/** Cancel (with the terms shown first) and reschedule (S5 / S11). */
export function ChangeBooking({ s, token }: { s: SessionDetail; token?: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState<'cancel' | 'move' | null>(null)
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const tz = useViewerZone(s.familyTimezone || s.tutor.timezone)
  if (done) return <Notice tone="success">{done}</Notice>
  if (!s.canCancel && !s.canReschedule) {
    return s.rescheduleClosedReason ? <p className="text-[14.5px] text-ink-soft">{s.rescheduleClosedReason}</p> : null
  }
  return (
    <Card>
      <h2 className="font-display text-[20px] font-semibold text-ink">Change this booking</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.canReschedule ? <Button variant={open === 'move' ? 'primary' : 'outline'} onClick={() => { setOpen(open === 'move' ? null : 'move'); setError(null) }}><CalendarClock className="size-4" aria-hidden />Move to another time</Button> : null}
        {s.canCancel ? <Button variant={open === 'cancel' ? 'primary' : 'danger'} onClick={() => { setOpen(open === 'cancel' ? null : 'cancel'); setError(null) }}><XCircle className="size-4" aria-hidden />Cancel</Button> : null}
      </div>
      {!s.canReschedule && s.rescheduleClosedReason ? <p className="mt-3 text-[14px] text-ink-soft">{s.rescheduleClosedReason}</p> : null}
      {open === 'move' && s.sessionTypeId ? (
        <div className="mt-5 grid gap-4">
          <SlotPicker slug={s.tutor.slug} sessionTypeId={s.sessionTypeId} timezone={tz} maxAdvanceDays={120} value={startsAt} onChange={setStartsAt} excludeSessionId={s.id} token={token ?? undefined} />
          <Button disabled={!startsAt || pending} onClick={() => start(async () => {
            if (!startsAt) return
            setError(null)
            const r = await rescheduleBooking({ id: s.id, token }, startsAt)
            if (!r.success || !r.data) { setError(r.error); return }
            setDone(`Moved to ${fmtDateTime(r.data.startsAt, tz)} (${zoneName(tz, new Date(r.data.startsAt))}).`)
            router.refresh()
          })}>{pending ? 'Moving…' : startsAt ? `Move to ${fmtDateTime(startsAt, tz)}` : 'Choose a new time'}</Button>
        </div>
      ) : null}
      {open === 'cancel' ? (
        <div className="mt-5 grid gap-4">
          {s.cancelTerms ? <Notice tone={s.cancelIsLate ? 'warn' : 'info'}>{s.cancelTerms}</Notice> : null}
          <Field label="Reason (optional)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputClass} /></Field>
          <Button variant="primary" disabled={pending} onClick={() => start(async () => {
            setError(null)
            const r = await cancelBooking({ id: s.id, token }, reason)
            if (!r.success || !r.data) { setError(r.error); return }
            const charged = r.data.charged === 'nothing' ? 'Nothing is charged.' : `${r.data.charged} is charged under the cancellation rules.`
            const refund = r.data.refundedCents > 0 ? ` ${money(r.data.refundedCents, s.currencyCode)} is refunded to your card.` : ''
            setDone(`This booking is cancelled. ${charged}${refund}`)
            router.refresh()
          })}>{pending ? 'Cancelling…' : 'Yes, cancel this booking'}</Button>
        </div>
      ) : null}
      {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}
    </Card>
  )
}
