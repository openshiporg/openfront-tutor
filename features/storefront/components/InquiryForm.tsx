'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendInquiry } from '../lib/data/public'
import { Button, Field, Notice, inputClass } from './ui'

/** S6: "Ask about tutoring" → sendInquiry. */
export function InquiryForm({ slug, subjects, tutorFirstName }: { slug: string; subjects: string[]; tutorFirstName: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  if (sent) {
    return <Notice tone="success">Thank you. Your message is with {tutorFirstName}, who will reply to you directly.</Notice>
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        setError(null)
        start(async () => {
          const r = await sendInquiry({
            slug,
            name: String(f.get('name') || ''),
            email: String(f.get('email') || ''),
            phone: String(f.get('phone') || ''),
            studentLevel: String(f.get('studentLevel') || ''),
            subject: String(f.get('subject') || ''),
            message: String(f.get('message') || ''),
          })
          if (!r.success) setError(r.error)
          else setSent(true)
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><input name="name" required maxLength={120} autoComplete="name" className={inputClass} /></Field>
        <Field label="Email"><input name="email" type="email" autoComplete="email" maxLength={200} className={inputClass} /></Field>
        <Field label="Phone" hint="Email or phone, whichever you prefer."><input name="phone" type="tel" autoComplete="tel" maxLength={40} className={inputClass} /></Field>
        <Field label="Student’s grade or level"><input name="studentLevel" maxLength={80} placeholder="e.g. Grade 10" className={inputClass} /></Field>
      </div>
      {subjects.length ? (
        <Field label="Subject">
          <select name="subject" className={inputClass} defaultValue="">
            <option value="">Not sure yet</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="How can I help?"><textarea name="message" rows={4} maxLength={3000} className={`${inputClass} py-3`} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div><Button type="submit" disabled={pending} className="w-full sm:w-auto"><Send className="size-4" aria-hidden />{pending ? 'Sending…' : 'Send message'}</Button></div>
    </form>
  )
}
