'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { handInHomework } from '../lib/data/account'
import { Button, Field, Notice, inputClass } from './ui'

/** S13: hand in a homework with a comment and an optional link to the work. */
export function HandInForm({ id }: { id: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  if (done) return <Notice tone="success">Handed in. Your tutor will see it.</Notice>
  if (!open) return <Button type="button" onClick={() => setOpen(true)}><Upload className="size-4" aria-hidden />Hand in</Button>
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null)
      start(async () => {
        const r = await handInHomework(id, String(f.get('comment') || '').trim(), String(f.get('url') || '').trim())
        if (!r.success) { setError(r.error); return }
        setDone(true)
        router.refresh()
      })
    }}>
      <Field label="Comment" hint="How it went, or questions for the next lesson."><textarea name="comment" rows={3} maxLength={1000} className={`${inputClass} py-3`} /></Field>
      <Field label="Link to the work (optional)" hint="A shared document, photo album or drive link."><input name="url" type="url" maxLength={500} placeholder="https://" className={inputClass} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Hand in'}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
      </div>
    </form>
  )
}
