'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Clock } from 'lucide-react'
import type { PublicTutor } from '../lib/types'
import { bookFirstSession } from '../lib/data/public'
import { duration, fmtDateTime, modeLabel, priceLabel, zoneName } from '../lib/format'
import { SlotPicker, useViewerZone } from './SlotPicker'
import { Button, Card, Field, Notice, cx, inputClass } from './ui'

/** S2: a new family chooses a lesson, a time and gives their details. */
export function FirstBookingFlow({ tutor, initialTypeId }: { tutor: PublicTutor; initialTypeId?: string }) {
  const router = useRouter()
  const types = tutor.sessionTypes.filter((s) => s.openToNewFamilies)
  const [typeId, setTypeId] = useState(types.find((t) => t.id === initialTypeId)?.id ?? types[0]?.id ?? '')
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [mode, setMode] = useState<'online' | 'in_person'>(tutor.teachesOnline ? 'online' : 'in_person')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const tz = useViewerZone(tutor.timezone)
  const type = types.find((t) => t.id === typeId)

  if (!types.length) {
    return <Notice>There are no lessons open for new families to book online right now. Use the contact form and you will get a reply.</Notice>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-6">
        <Card>
          <h2 className="font-display text-[21px] font-semibold text-ink">1. Choose a lesson</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {types.map((s) => (
              <button key={s.id} type="button" onClick={() => { setTypeId(s.id); setStartsAt(null) }} aria-pressed={typeId === s.id}
                className={cx('rounded-xl border-2 p-4 text-left transition-colors', typeId === s.id ? 'border-wine bg-wine/5' : 'border-line bg-white hover:border-wine/50')}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink">{s.name}</span>
                  <span className="shrink-0 font-semibold text-wine">{priceLabel(s.priceCents, tutor.currencyCode)}</span>
                </span>
                <span className="mt-1 flex items-center gap-2 text-[14px] text-ink-soft"><Clock className="size-3.5" aria-hidden />{duration(s.durationMinutes)} · {modeLabel(s.mode)}</span>
                {s.description ? <span className="mt-1.5 block text-[14px] text-ink">{s.description}</span> : null}
              </button>
            ))}
          </div>
          {type?.mode === 'either' ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-ink">Where?</legend>
              <div className="mt-2 flex gap-2">
                {(['online', 'in_person'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cx('min-h-11 rounded-lg border-2 px-4 text-[15px] font-semibold', mode === m ? 'border-wine bg-wine text-white' : 'border-line bg-white text-ink')}>{modeLabel(m)}</button>
                ))}
              </div>
            </fieldset>
          ) : null}
        </Card>

        {type ? (
          <Card>
            <h2 className="mb-4 font-display text-[21px] font-semibold text-ink">2. Choose a time</h2>
            <SlotPicker slug={tutor.slug} sessionTypeId={type.id} timezone={tz} maxAdvanceDays={tutor.maxAdvanceDays} value={startsAt} onChange={setStartsAt} />
          </Card>
        ) : null}

        <Card>
          <h2 className="font-display text-[21px] font-semibold text-ink">3. Your details</h2>
          <form id="first-booking" className="mt-4 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!type || !startsAt) { setError('Choose a day and a time first.'); return }
              const f = new FormData(e.currentTarget)
              setError(null)
              start(async () => {
                const r = await bookFirstSession({
                  slug: tutor.slug, sessionTypeId: type.id, startsAt,
                  mode: type.mode === 'either' ? mode : null,
                  visitor: {
                    guardianName: String(f.get('guardianName') || '').trim(),
                    email: String(f.get('email') || '').trim() || undefined,
                    phone: String(f.get('phone') || '').trim() || undefined,
                    studentName: String(f.get('studentName') || '').trim(),
                    studentLevel: String(f.get('studentLevel') || '').trim() || undefined,
                    message: String(f.get('message') || '').trim() || undefined,
                    timezone: tz,
                  },
                })
                if (!r.success || !r.data) { setError(r.error); if (r.error?.includes('taken')) setStartsAt(null); return }
                router.push(`/booking/${r.data.bookingId}?t=${encodeURIComponent(r.data.token)}&new=1`)
              })
            }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name (parent or guardian)"><input name="guardianName" required maxLength={120} autoComplete="name" className={inputClass} /></Field>
              <Field label="Student’s first name"><input name="studentName" required maxLength={80} className={inputClass} /></Field>
              <Field label="Email" hint="Your booking link is sent here."><input name="email" type="email" autoComplete="email" maxLength={200} className={inputClass} /></Field>
              <Field label="Phone" hint="Email or phone is needed."><input name="phone" type="tel" autoComplete="tel" maxLength={40} className={inputClass} /></Field>
              <Field label="Grade or level" className="sm:col-span-2"><input name="studentLevel" maxLength={80} placeholder="e.g. Grade 10, A-level" className={inputClass} /></Field>
            </div>
            <Field label="Anything the tutor should know?"><textarea name="message" rows={3} maxLength={3000} className={`${inputClass} py-3`} /></Field>
          </form>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="bg-white">
          <h2 className="font-display text-[20px] font-semibold italic text-ink">Your booking</h2>
          {type ? (
            <dl className="mt-3 grid gap-2 text-[15px]">
              <div><dt className="text-ink-soft">Lesson</dt><dd className="font-semibold text-ink">{type.name} · {duration(type.durationMinutes)}</dd></div>
              <div><dt className="text-ink-soft">When</dt><dd className="font-semibold text-ink">{startsAt ? `${fmtDateTime(startsAt, tz)} (${zoneName(tz, new Date(startsAt))})` : 'Choose a time'}</dd></div>
              <div><dt className="text-ink-soft">Price</dt><dd className="font-semibold text-ink">{priceLabel(type.priceCents, tutor.currencyCode)}</dd></div>
            </dl>
          ) : null}
          {type && type.priceCents > 0 ? (
            <p className="mt-3 text-[14px] text-ink-soft">{tutor.cardPayments ? `You pay by card on the next page. The time is held for ${tutor.unpaidHoldMinutes} minutes.` : 'You pay your tutor directly; the details are on your booking page.'}</p>
          ) : null}
          <p className="mt-2 text-[14px] text-ink-soft">Free to cancel or move up to {tutor.cancellationWindowHours} hours before.</p>
          {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}
          <Button type="submit" form="first-booking" disabled={pending || !startsAt} className="mt-4 w-full min-h-12">
            <CalendarCheck className="size-5" aria-hidden />{pending ? 'Booking…' : type && type.priceCents > 0 && tutor.cardPayments ? 'Book and pay' : 'Book this time'}
          </Button>
        </Card>
      </aside>
    </div>
  )
}
