'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveItem } from '../lib/request'
import { Btn, Field, Notice, inputClass } from '../lib/ui'

export function ResourceForm({ students }: { students: Array<{ id: string; firstName: string; lastName: string }> }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault()
      const el = e.currentTarget
      const f = new FormData(el)
      const file = f.get('file') as File | null
      const link = String(f.get('linkUrl') || '')
      if (!link && !(file && file.size)) { setError('Add a link or a file.'); return }
      setError(null)
      start(async () => {
        const r = await saveItem('Resource', null, { title: f.get('title'), linkUrl: link, note: f.get('note'), students: { connect: f.getAll('student').map((id) => ({ id: String(id) })) }, ...(file && file.size ? { file: { upload: file } } : {}) })
        if (!r.success) { setError(r.error); return }
        el.reset(); router.refresh()
      })
    }}>
      <Field label="Title"><input name="title" required className={inputClass} /></Field>
      <Field label="Link"><input name="linkUrl" type="url" placeholder="https://" className={inputClass} /></Field>
      <Field label="File"><input name="file" type="file" className={inputClass} /></Field>
      <Field label="Note"><input name="note" className={inputClass} /></Field>
      <fieldset className="grid max-h-48 gap-1 overflow-y-auto text-sm sm:col-span-2"><legend className="font-medium">Share with (none = every active student)</legend>{students.map((s) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="student" value={s.id} className="size-4" />{s.firstName} {s.lastName}</label>)}</fieldset>
      <div className="sm:col-span-2"><Btn type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Share'}</Btn></div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </form>
  )
}
