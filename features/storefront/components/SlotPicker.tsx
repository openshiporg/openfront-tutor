'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react'
import { loadOpenDays, loadSlots } from '../lib/data/public'
import { addDaysKey, dateKey, dayLabel, fmtTime, zoneName } from '../lib/format'
import { Notice, cx } from './ui'

const WINDOW = 14

export function useViewerZone(fallback: string) {
  const [tz, setTz] = useState(fallback)
  useEffect(() => {
    try {
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (z) setTz(z)
    } catch { /* keep fallback */ }
  }, [])
  return tz
}

/**
 * Choose a day, then a time. Every time is in the viewer's timezone and the
 * timezone is named (D15). Days come from publicOpenDays, times from publicSlots.
 */
export function SlotPicker({ slug, sessionTypeId, timezone, maxAdvanceDays, value, onChange, excludeSessionId, token }: {
  slug: string; sessionTypeId: string; timezone: string; maxAdvanceDays: number; value: string | null; onChange: (iso: string | null) => void
  excludeSessionId?: string; token?: string
}) {
  const today = useMemo(() => dateKey(new Date(), timezone), [timezone])
  const [from, setFrom] = useState(today)
  const [days, setDays] = useState<string[] | null>(null)
  const [dayError, setDayError] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [slotError, setSlotError] = useState<string | null>(null)
  const lastFrom = addDaysKey(today, Math.max(0, Math.min(maxAdvanceDays, 365) - 1))

  useEffect(() => { setFrom(today) }, [today])

  useEffect(() => {
    let live = true
    setDays(null); setDayError(null)
    loadOpenDays({ slug, sessionTypeId, from, days: WINDOW, timezone }).then((r) => {
      if (!live) return
      if (!r.success || !r.data) { setDayError(r.error); setDays([]); return }
      setDays(r.data.days)
      setDate((d) => (d && r.data!.days.includes(d) ? d : r.data!.days[0] ?? null))
    })
    return () => { live = false }
  }, [slug, sessionTypeId, from, timezone])

  useEffect(() => {
    if (!date) { setSlots(null); return }
    let live = true
    setSlots(null); setSlotError(null)
    loadSlots({ slug, sessionTypeId, date, timezone, excludeSessionId, token }).then((r) => {
      if (!live) return
      if (!r.success || !r.data) { setSlotError(r.error); setSlots([]); return }
      setSlots(r.data.slots)
    })
    return () => { live = false }
  }, [slug, sessionTypeId, date, timezone, excludeSessionId, token])

  const strip = Array.from({ length: WINDOW }, (_, i) => addDaysKey(from, i))
  const canBack = from > today
  const canForward = addDaysKey(from, WINDOW) <= lastFrom

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-ink">{dayLabel(from).month} {from.slice(0, 4)}</p>
        <div className="flex gap-1">
          <button type="button" disabled={!canBack} onClick={() => setFrom(canBack ? (addDaysKey(from, -WINDOW) < today ? today : addDaysKey(from, -WINDOW)) : from)} className="flex size-11 items-center justify-center rounded-lg border border-line bg-white text-ink disabled:opacity-40" aria-label="Earlier days"><ChevronLeft className="size-5" /></button>
          <button type="button" disabled={!canForward} onClick={() => setFrom(addDaysKey(from, WINDOW))} className="flex size-11 items-center justify-center rounded-lg border border-line bg-white text-ink disabled:opacity-40" aria-label="Later days"><ChevronRight className="size-5" /></button>
        </div>
      </div>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Day">
        {strip.map((k) => {
          const open = days?.includes(k) ?? false
          const l = dayLabel(k)
          return (
            <button key={k} type="button" role="option" aria-selected={date === k} disabled={!open}
              onClick={() => { setDate(k); onChange(null) }}
              className={cx('flex min-h-[68px] w-[60px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border text-center transition-colors',
                date === k ? 'border-wine bg-wine text-white' : open ? 'border-line bg-white text-ink hover:border-wine' : 'border-transparent bg-ink/[0.03] text-ink-soft/50')}>
              <span className="text-[12px] font-semibold uppercase tracking-wide">{l.weekday}</span>
              <span className="font-display text-[20px] font-semibold leading-tight">{l.day}</span>
              <span className="sr-only">{open ? 'open' : 'no times'}</span>
            </button>
          )
        })}
      </div>
      {dayError ? <Notice tone="error">{dayError}</Notice> : null}
      {days && !days.length && !dayError ? <p className="text-[15px] text-ink-soft">No open times in these two weeks. Try later days.</p> : null}
      {date ? (
        <div>
          <p className="mb-2 text-[15px] font-semibold text-ink">{dayLabel(date).long}</p>
          {slotError ? <Notice tone="error">{slotError}</Notice> : null}
          {slots === null ? <p className="text-[15px] text-ink-soft" aria-live="polite">Finding times…</p> : slots.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="listbox" aria-label="Time">
              {slots.map((s) => (
                <button key={s} type="button" role="option" aria-selected={value === s} onClick={() => onChange(s)}
                  className={cx('min-h-11 rounded-lg border text-[15px] font-semibold', value === s ? 'border-wine bg-wine text-white' : 'border-line bg-white text-ink hover:border-wine')}>
                  {fmtTime(s, timezone)}
                </button>
              ))}
            </div>
          ) : !slotError ? <p className="text-[15px] text-ink-soft">No times left on this day. Choose another day.</p> : null}
        </div>
      ) : null}
      <p className="flex items-center gap-1.5 text-[13.5px] text-ink-soft"><Globe className="size-4" aria-hidden />Times shown in {zoneName(timezone)} ({timezone}).</p>
    </div>
  )
}
