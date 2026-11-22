'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../lib/request'
import { CopyLink } from '../lib/actions'
import { Btn, Notice } from '../lib/ui'

export function SendInvoiceButton({ id, hasEmail }: { id: string; hasEmail: boolean }) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <span className="grid gap-2">
      <Btn variant="primary" disabled={pending} onClick={async () => {
        if (!window.confirm('Send this invoice? Its lines and total are then fixed.')) return
        setPending(true); setError(null)
        const r = await runOperation('sendInvoice', { invoiceId: id, send: hasEmail })
        setPending(false)
        if (!r.success) { setError(r.error); return }
        const d = r.data as { url: string; mail: { status: string; error: string } | null }
        setUrl(d.url); setMsg(d.mail?.status === 'sent' ? 'Sent by email.' : 'Send this link by text or WhatsApp.')
        router.refresh()
      }}>{pending ? 'Sending…' : 'Send invoice'}</Btn>
      {url ? <CopyLink url={url} /> : null}
      {msg ? <Notice>{msg}</Notice> : null}
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </span>
  )
}
