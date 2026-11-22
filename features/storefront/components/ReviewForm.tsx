'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { submitReview } from '../lib/data/account'
import { Button, Field, Notice, cx, inputClass } from './ui'

/** S19: a family writes one review; it shows on the home page after the tutor publishes it. */
export function ReviewForm({ defaultName, tutorName }: { defaultName: string; tutorName: string }) {
  const [rating, setRating] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  if (done) return <Notice tone="success">Thank you. {tutorName} will see your review and can publish it on the home page.</Notice>
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null)
      start(async () => {
        const r = await submitReview(rating, String(f.get('body') || '').trim(), String(f.get('displayName') || '').trim())
        if (!r.success) setError(r.error); else setDone(true)
      })
    }}>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} onClick={() => setRating(n)} className="flex size-11 items-center justify-center rounded-lg hover:bg-wine/5">
              <Star className={cx('size-7', n <= rating ? 'fill-wine text-wine' : 'text-ink-soft/40')} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Your review"><textarea name="body" rows={5} maxLength={2000} required className={`${inputClass} py-3`} placeholder={`What changed since lessons with ${tutorName} began?`} /></Field>
      <Field label="Name shown with the review" hint="For example your first name and initial."><input name="displayName" maxLength={80} defaultValue={defaultName} className={inputClass} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div><Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send review'}</Button></div>
    </form>
  )
}
