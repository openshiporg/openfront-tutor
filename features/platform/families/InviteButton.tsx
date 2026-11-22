'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../lib/request'
import { CopyLink } from '../lib/actions'
import { Btn, Notice } from '../lib/ui'

/** P16: invite a family (email when mail is on, and always a link to copy). */
export function InviteButton({ familyId, hasEmail, open }: { familyId: string; hasEmail: boolean; open: boolean }) {
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
    const d = r.data as { url: string; mail: { status: string; error: string } | null }
    setUrl(d.url)
    setMsg(d.mail?.status === 'sent' ? 'Invite emailed. You can also send this link by text or WhatsApp.' : `Send this link by text or WhatsApp${d.mail?.error ? ` (${d.mail.error})` : ''}.`)
    router.refresh()
  }
  return (
    <div className="grid gap-2 text-sm">
      <p>No account yet{open ? '; an invite link is open' : ''}. An invite lets them set a password and see sessions, notes, homework, packages and invoices.</p>
      <Btn variant="primary" disabled={pending} onClick={go}>{pending ? 'Working…' : open ? 'New invite link' : 'Invite to an account'}</Btn>
      {url ? <CopyLink url={url} /> : null}
      {msg ? <Notice>{msg}</Notice> : null}
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </div>
  )
}
