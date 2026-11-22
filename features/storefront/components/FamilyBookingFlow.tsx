'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Clock } from 'lucide-react'
import type { MyFamily, PublicSessionType, PublicTutor } from '../lib/types'
import { bookSession } from '../lib/data/account'
import { startPayment } from '../lib/data/session-actions'
import { duration, fmtDateTime, modeLabel, money, priceLabel, zoneName } from '../lib/format'
import { SlotPicker, useViewerZone } from './SlotPicker'
import { Button, Card, Field, Notice, cx, inputClass } from './ui'

/** How this lesson will be paid, as the server decides it (D5): free, package, invoice, flat monthly, or card. */
function fundingFor(type: PublicSessionType, fam: MyFamily, cardOn: boolean) {
  const c = fam.tutor.currencyCode
  if (type.priceCents <= 0) return { label: 'Free', detail: 'Nothing to pay.' }
  if (fam.minutesLeft >= type.durationMinutes) return { label: 'From your package', detail: `${duration(type.durationMinutes)} comes off your package (${duration(fam.minutesLeft)} left) if the package covers this lesson. Otherwise it is paid as below.`, fallback: true }
  if (fam.family.billingMode === 'invoice') return { label: 'On your next invoice', detail: `${money(type.priceCents, c)} is added to your next invoice.` }
  if (fam.family.billingMode === 'flat_monthly') return { label: 'Covered by your monthly fee', detail: fam.family.monthlyFeeCents ? `Included in your ${money(fam.family.monthlyFeeCents, c)} monthly fee.` : 'Included in your monthly fee.' }
  return cardOn
    ? { label: 'By card', detail: `You pay ${money(type.priceCents, c)} by card next. The time is held while you pay.` }
    : { label: 'Pay your tutor directly', detail: `${money(type.priceCents, c)}. The payment details are on the session page.` }
}

/** S10: a known family books with their own students and sees how it is paid. */
export function FamilyBookingFlow({ tutor, family, initialTypeId }: { tutor: PublicTutor; family: MyFamily; initialTypeId?: string }) {
  const router = useRouter()
  const types = tutor.sessionTypes
  const students = family.students.filter((s) => s.status !== 'finished')
  const [typeId, setTypeId] = useState(types.find((t) => t.id === initialTypeId)?.id ?? types[0]?.id ?? '')
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>(students[0] ? [students[0].id] : [])
  const [mode, setMode] = useState<'online' | 'in_person'>(tutor.teachesOnline ? 'online' : 'in_person')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const tz = useViewerZone(family.family.timezone || tutor.timezone)
  const type = types.find((t) => t.id === typeId)

  if (!tutor.bookingOpen) return <Notice>Online booking is closed right now. Contact {tutor.tutorName || tutor.businessName} to arrange a lesson.</Notice>
  if (!types.length) return <Notice>There are no lessons to book online right now.</Notice>
  if (!students.length) return <Notice>Add a student first. <a href="/account/students" className="font-semibold underline">Go to students</a></Notice>

  const funding = type ? fundingFor(type, family, family.tutor.cardPayments) : null
  const max = type?.maxStudents ?? 1
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : max === 1 ? [id] : p.length < max ? [...p, id] : p))

  const submit = () => start(async () => {
    if (!type || !startsAt) { setError('Choose a day and a time first.'); return }
    if (!picked.length) { setError('Choose who the lesson is for.'); return }
    setError(null)
    const r = await bookSession({ sessionTypeId: type.id, startsAt, studentIds: picked, message: message.trim() || undefined, mode: type.mode === 'either' ? mode : null })
    if (!r.success || !r.data) { setError(r.error); if (r.error?.includes('taken')) setStartsAt(null); return }
    if (r.data.needsPayment && family.tutor.cardPayments) {
      const p = await startPayment({ id: r.data.sessionId })
      if (p.success && p.data?.url) { window.location.href = p.data.url; return }
      router.push(`/account/sessions/${r.data.sessionId}`)
      return
    }
    router.push(`/account/sessions/${r.data.sessionId}`)
    router.refresh()
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-6">
        <Card>
          <h2 className="font-display text-[21px] font-semibold text-ink">1. Choose a lesson</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {types.map((s) => (
              <button key={s.id} type="button" onClick={() => { setTypeId(s.id); setStartsAt(null); setPicked((p) => p.slice(0, s.maxStudents)) }} aria-pressed={typeId === s.id}
                className={cx('rounded-xl border-2 p-4 text-left transition-colors', typeId === s.id ? 'border-wine bg-wine/5' : 'border-line bg-white hover:border-wine/50')}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink">{s.name}</span>
                  <span className="shrink-0 font-semibold text-wine">{priceLabel(s.priceCents, tutor.currencyCode)}</span>
                </span>
                <span className="mt-1 flex items-center gap-2 text-[14px] text-ink-soft"><Clock className="size-3.5" aria-hidden />{duration(s.durationMinutes)} · {modeLabel(s.mode)}{s.maxStudents > 1 ? ` · up to ${s.maxStudents}` : ''}</span>
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

        <Card>
          <h2 className="font-display text-[21px] font-semibold text-ink">2. Who is it for?</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{max === 1 ? 'One student.' : `Up to ${max} students.`}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {students.map((s) => (
              <button key={s.id} type="button" aria-pressed={picked.includes(s.id)} onClick={() => toggle(s.id)}
                className={cx('min-h-11 rounded-full border-2 px-4 text-[15px] font-semibold', picked.includes(s.id) ? 'border-wine bg-wine text-white' : 'border-line bg-white text-ink')}>
                {s.firstName}{s.level ? <span className="font-normal opacity-80"> · {s.level}</span> : null}
              </button>
            ))}
          </div>
        </Card>

        {type ? (
          <Card>
            <h2 className="mb-4 font-display text-[21px] font-semibold text-ink">3. Choose a time</h2>
            <SlotPicker slug={tutor.slug} sessionTypeId={type.id} timezone={tz} maxAdvanceDays={tutor.maxAdvanceDays} value={startsAt} onChange={setStartsAt} />
          </Card>
        ) : null}

        <Card>
          <Field label="A note for your tutor (optional)"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className={`${inputClass} py-3`} /></Field>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="bg-white">
          <h2 className="font-display text-[20px] font-semibold italic text-ink">Your booking</h2>
          {type ? (
            <dl className="mt-3 grid gap-2 text-[15px]">
              <div><dt className="text-ink-soft">Lesson</dt><dd className="font-semibold text-ink">{type.name} · {duration(type.durationMinutes)}</dd></div>
              <div><dt className="text-ink-soft">For</dt><dd className="font-semibold text-ink">{students.filter((s) => picked.includes(s.id)).map((s) => s.firstName).join(', ') || 'Choose a student'}</dd></div>
              <div><dt className="text-ink-soft">When</dt><dd className="font-semibold text-ink">{startsAt ? `${fmtDateTime(startsAt, tz)} (${zoneName(tz, new Date(startsAt))})` : 'Choose a time'}</dd></div>
              <div><dt className="text-ink-soft">Price</dt><dd className="font-semibold text-ink">{priceLabel(type.priceCents, tutor.currencyCode)}</dd></div>
              {funding ? <div><dt className="text-ink-soft">How it is paid</dt><dd className="font-semibold text-ink">{funding.label}</dd><dd className="text-[14px] text-ink-soft">{funding.detail}</dd></div> : null}
            </dl>
          ) : null}
          <p className="mt-3 text-[14px] text-ink-soft">Free to cancel or move up to {tutor.cancellationWindowHours} hours before.</p>
          {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}
          <Button type="button" onClick={submit} disabled={pending || !startsAt || !picked.length} className="mt-4 min-h-12 w-full">
            <CalendarCheck className="size-5" aria-hidden />{pending ? 'Booking…' : funding?.label === 'By card' ? 'Book and pay' : 'Book this time'}
          </Button>
        </Card>
      </aside>
    </div>
  )
}
