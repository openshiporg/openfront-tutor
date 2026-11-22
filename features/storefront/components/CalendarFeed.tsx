'use client'

import { useState, useTransition } from 'react'
import { CalendarSync, Copy } from 'lucide-react'
import { getMyCalendarFeedUrl } from '../lib/data/account'
import { Button, Card, Notice, inputClass } from './ui'

/** S21: a private calendar feed of every lesson. Asking again replaces the old link. */
export function CalendarFeed() {
  const [feed, setFeed] = useState<{ url: string; webcalUrl: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-display text-[20px] font-semibold text-ink"><CalendarSync className="size-5 text-wine" aria-hidden />Lessons in your calendar</h2>
      <p className="mt-1 text-[15px] text-ink-soft">Add one private link to Google Calendar, Apple Calendar or Outlook and every lesson appears there, kept up to date. Making a new link turns off the old one.</p>
      {feed ? (
        <div className="mt-4 grid gap-3">
          <div className="flex gap-2">
            <input readOnly value={feed.url} aria-label="Calendar link" className={inputClass} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="quiet" aria-label="Copy the link" onClick={() => { navigator.clipboard?.writeText(feed.url).then(() => setCopied(true)).catch(() => null) }}><Copy className="size-4" aria-hidden /></Button>
          </div>
          {copied ? <p className="text-[14px] text-emerald-800">Copied.</p> : null}
          <a href={feed.webcalUrl} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-wine underline">Open in my calendar app</a>
        </div>
      ) : (
        <div className="mt-4">
          <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => {
            setError(null)
            const r = await getMyCalendarFeedUrl()
            if (!r.success || !r.data) setError(r.error); else setFeed(r.data)
          })}>{pending ? 'Making the link…' : 'Get my calendar link'}</Button>
        </div>
      )}
      {error ? <Notice tone="error" className="mt-3">{error}</Notice> : null}
    </Card>
  )
}
