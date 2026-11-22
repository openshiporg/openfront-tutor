'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../lib/request'
import { CopyLink } from '../lib/actions'
import { Btn, Notice } from '../lib/ui'

/**
 * P16 / S8: the family's account link (email when mail is on, and always a link to copy).
 * No account yet: an invite to create one. Has an account: a one-time password link.
 */
export function InviteButton({ familyId, hasEmail, open, account }: { familyId: string; hasEmail: boolean; open: boolean; account?: { name: string; email: string } | null }) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const go = async () => {
    setPending(true); setError(null)
    const r = await runOperation('inviteFamily', { familyId, send: hasEmail })
    setPending(false)
    if (!r.success) { setError(r.error); return }
    const d = r.data as { url: string; kind: 'invite' | 'password'; validMinutes: number | null; mail: { status: string; error: string } | null }
    setUrl(d.url)
    const what = d.kind === 'password' ? `Password link${d.validMinutes ? `, valid ${d.validMinutes} minutes and once` : ''}` : 'Invite'
    setMsg(d.mail?.status === 'sent' ? `${what} emailed. You can also send this link by text or WhatsApp.` : `${what}: send this link by text or WhatsApp${d.mail?.error ? ` (${d.mail.error})` : ''}.`)
    router.refresh()
  }
  return (
    <div className="grid gap-2 text-sm">
      {account ? (
        <p>{account.name} signs in with {account.email}. If they forget the password, they can reset it from the sign-in page, or you can send them a password link.</p>
      ) : (
        <p>No account yet{open ? '; an invite link is open' : ''}. An invite lets them set a password and see sessions, notes, homework, packages and invoices.</p>
      )}
      <Btn variant={account ? 'raised' : 'primary'} disabled={pending} onClick={go}>{pending ? 'Working…' : account ? 'Send a password link' : open ? 'New invite link' : 'Invite to an account'}</Btn>
      {url ? <CopyLink url={url} /> : null}
      {msg ? <Notice>{msg}</Notice> : null}
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </div>
  )
}
