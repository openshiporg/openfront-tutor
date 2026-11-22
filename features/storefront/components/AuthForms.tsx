'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { redeemPasswordReset, requestPasswordReset, signIn, signOut } from '../lib/data/account'
import { Button, Field, Notice, inputClass } from './ui'

const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account')

/** S8: sign in. A tutor is pointed to the dashboard. */
export function SignInForm({ next }: { next?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [tutor, setTutor] = useState(false)
  const [pending, start] = useTransition()
  if (tutor) return <Notice>You are signed in as the tutor. <Link href="/dashboard" className="font-semibold underline">Open your dashboard</Link>.</Notice>
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null)
      start(async () => {
        const r = await signIn(String(f.get('email') || ''), String(f.get('password') || ''))
        if (!r.ok) { setError(r.error); return }
        if (r.isTutor) { setTutor(true); return }
        router.push(safeNext(next))
        router.refresh()
      })
    }}>
      <Field label="Email"><input name="email" type="email" required autoComplete="email" className={inputClass} /></Field>
      <Field label="Password"><input name="password" type="password" required autoComplete="current-password" className={inputClass} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" disabled={pending} className="min-h-12"><LogIn className="size-4" aria-hidden />{pending ? 'Signing in…' : 'Sign in'}</Button>
      <Link href="/account/reset" className="inline-flex min-h-11 items-center justify-center text-[15px] font-semibold text-wine underline">Forgot your password?</Link>
    </form>
  )
}

export function ResetRequestForm() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()
  if (sent) return <Notice tone="success">If that email has an account, a reset link is on its way. Check your inbox.</Notice>
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      start(async () => {
        const r = await requestPasswordReset(String(f.get('email') || ''))
        if (!r.ok) setError(r.error); else setSent(true)
      })
    }}>
      <Field label="Email you sign in with"><input name="email" type="email" required autoComplete="email" className={inputClass} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button>
    </form>
  )
}

export function ResetRedeemForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  if (done) return <Notice tone="success">Your password is changed. <Link href="/account/signin" className="font-semibold underline">Sign in</Link>.</Notice>
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      if (String(f.get('password')) !== String(f.get('again'))) { setError('The two passwords do not match.'); return }
      start(async () => {
        const r = await redeemPasswordReset(String(f.get('email') || ''), token, String(f.get('password') || ''))
        if (!r.ok) setError(r.error); else { setDone(true); router.refresh() }
      })
    }}>
      <Field label="Email"><input name="email" type="email" required autoComplete="email" className={inputClass} /></Field>
      <Field label="New password"><input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></Field>
      <Field label="New password again"><input name="again" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Set new password'}</Button>
    </form>
  )
}

export function SignOutButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await signOut(); router.push('/'); router.refresh() })}
      className="inline-flex min-h-11 items-center text-[15px] font-semibold text-ink-soft underline hover:text-wine">{pending ? 'Signing out…' : 'Sign out'}</button>
  )
}
