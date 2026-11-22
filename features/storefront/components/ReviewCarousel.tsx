'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import type { PublicReview } from '../lib/types'
import { cx } from './ui'

/** The handwritten review card from the design: one published review at a time. */
export function ReviewCarousel({ reviews }: { reviews: PublicReview[] }) {
  const [i, setI] = useState(0)
  const r = reviews[i]
  if (!r) return null
  const go = (d: number) => setI((n) => (n + d + reviews.length) % reviews.length)
  return (
    <figure className="w-full" aria-roledescription="carousel" aria-label="Reviews from families">
      <div className="flex items-center gap-1 sm:gap-3">
        {reviews.length > 1 ? (
          <button type="button" onClick={() => go(-1)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-wine hover:bg-wine/10" aria-label="Previous review"><ChevronLeft className="size-6" /></button>
        ) : null}
        <div className="relative min-w-0 flex-1 -rotate-[1.2deg] rounded-[18px] bg-card-blush px-6 py-6 shadow-[0_8px_22px_rgba(125,29,52,0.10)] sm:px-8">
          <span aria-hidden className="absolute left-4 top-1 font-display text-[54px] font-bold leading-none text-wine">“</span>
          <blockquote className="pl-6 font-hand text-[23px] leading-[1.28] text-ink sm:text-[25px]">
            {r.body || 'A wonderful tutor.'}
          </blockquote>
          <figcaption className="mt-3 flex flex-wrap items-center justify-end gap-2 text-[14.5px] text-ink-soft">
            <span className="flex" aria-label={`${r.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, k) => <Star key={k} className={cx('size-3.5', k < r.rating ? 'fill-wine text-wine' : 'text-wine/30')} aria-hidden />)}
            </span>
            <span>— {r.displayName || 'A parent'}</span>
          </figcaption>
        </div>
        {reviews.length > 1 ? (
          <button type="button" onClick={() => go(1)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-wine hover:bg-wine/10" aria-label="Next review"><ChevronRight className="size-6" /></button>
        ) : null}
      </div>
      {reviews.length > 1 ? (
        <div className="mt-1 flex justify-center">
          {reviews.slice(0, 8).map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} aria-label={`Review ${k + 1}`} aria-current={k === i} className="flex size-11 items-center justify-center">
              <span className={cx('size-2 rounded-full', k === i ? 'bg-wine' : 'bg-ink/20')} />
            </button>
          ))}
        </div>
      ) : null}
    </figure>
  )
}
