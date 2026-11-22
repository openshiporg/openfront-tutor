'use client'

import { ActionForm } from '../lib/actions'
import { Field, inputClass } from '../lib/ui'

/** P32: record cash, transfer or mobile money against a session, package or invoice. */
export function RecordPaymentForm({ target, targetId, defaultCents, currency }: { target: 'session' | 'package' | 'invoice'; targetId: string; defaultCents: number; currency: string }) {
  return (
    <ActionForm op="recordPayment" submit="Record payment" className="grid gap-3 rounded-md border p-3 sm:grid-cols-3" toVars={(f) => ({ target, targetId, amountCents: Math.round(Number(f.get('amount')) * 100), method: f.get('method'), reference: f.get('reference') })} done={() => 'Payment recorded.'}>
      <Field label={`Amount (${currency})`}><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={(defaultCents / 100).toFixed(2)} className={inputClass} /></Field>
      <Field label="How it was paid"><select name="method" defaultValue="cash" className={inputClass}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer (Zelle, wire…)</option><option value="mobile_money">Mobile money (JazzCash, M-Pesa, UPI…)</option><option value="other">Other (Venmo, cheque…)</option></select></Field>
      <Field label="Reference (optional)"><input name="reference" className={inputClass} /></Field>
    </ActionForm>
  )
}
