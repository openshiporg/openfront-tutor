'use client'

import { useState, useTransition } from 'react'
import { reportPayment } from '../lib/data/account'
import { Button, Field, Notice, inputClass } from './ui'

/** S17: tell the tutor you paid outside the site. Nothing changes until the tutor confirms. */
export function ReportPaymentForm({ target, targetId, defaultCents, currency }: { target: 'session' | 'package' | 'invoice'; targetId: string; defaultCents: number; currency: string }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  if (done) return <Notice tone="success">Thank you. Your tutor will confirm the payment once it arrives.</Notice>
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-wine underline">I already paid another way</button>
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      const amount = Math.round(Number(String(f.get('amount') || '0').replace(/[^\d.]/g, '')) * 100)
      if (!amount || amount <= 0) { setError('Enter the amount you paid.'); return }
      setError(null)
      start(async () => {
        const r = await reportPayment({ target, targetId, amountCents: amount, method: String(f.get('method')), reference: String(f.get('reference') || '').trim() })
        if (!r.success) setError(r.error); else setDone(true)
      })
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={`Amount (${currency})`}><input name="amount" inputMode="decimal" defaultValue={(defaultCents / 100).toFixed(2)} className={inputClass} /></Field>
        <Field label="How">
          <select name="method" className={inputClass} defaultValue="bank_transfer">
            <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Reference"><input name="reference" required maxLength={120} placeholder="e.g. transfer ref" className={inputClass} /></Field>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div><Button type="submit" variant="outline" disabled={pending}>{pending ? 'Sending…' : 'Tell my tutor'}</Button></div>
    </form>
  )
}
