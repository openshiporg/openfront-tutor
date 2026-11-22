'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { claimAccount } from '../lib/data/account'
import { Button, Field, Notice, inputClass } from './ui'

/** S7: set a password to create the family account, from a booking or from an invite. */
export function ClaimForm({ bookingId, bookingToken, familyId, token, askEmail, askName, next = '/account' }: {
  bookingId?: string; bookingToken?: string; familyId?: string; token?: string; askEmail?: boolean | 'optional'; askName?: boolean; next?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      const password = String(f.get('password') || '')
      if (password.length < 8) { setError('Choose a password of at least 8 characters.'); return }
      if (password !== String(f.get('again') || '')) { setError('The two passwords do not match.'); return }
      setError(null)
      start(async () => {
        const r = await claimAccount({ password, email: String(f.get('email') || '') || undefined, name: String(f.get('name') || '') || undefined, bookingId, bookingToken, familyId, token })
        if (!r.ok) { setError(r.error); return }
        router.push(next)
        router.refresh()
      })
    }}>
      {askName ? <Field label="Your name"><input name="name" maxLength={120} autoComplete="name" className={inputClass} /></Field> : null}
      {askEmail ? (
        <Field label="Email" hint={askEmail === 'optional' ? 'Leave empty to use the email you booked with. Needed if you booked with a phone number.' : 'You will sign in with this email.'}>
          <input name="email" type="email" required={askEmail !== 'optional'} autoComplete="email" className={inputClass} />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password"><input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></Field>
        <Field label="Password again"><input name="again" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></Field>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div><Button type="submit" disabled={pending}>{pending ? 'Creating your account…' : 'Create my family account'}</Button></div>
    </form>
  )
}
