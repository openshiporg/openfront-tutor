'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionForm } from '../lib/actions'
import { Btn, Field, inputClass } from '../lib/ui'

/** P30: a draft from what is ready, with free lines (materials, travel) and a due date. */
export function DraftInvoiceForm({ familyId, currency }: { familyId: string; currency: string }) {
  const router = useRouter()
  const [lines, setLines] = useState(0)
  return (
    <ActionForm op="draftInvoice" submit="Create draft" className="grid gap-2 sm:grid-cols-3" after={(d) => router.push(`/dashboard/platform/billing/invoices/${d.id}`)}
      toVars={(f) => ({ familyId, dueDays: f.get('dueDays') ? Number(f.get('dueDays')) : null, note: f.get('note'), extraLines: Array.from({ length: lines }, (_, i) => ({ description: String(f.get(`d${i}`) || ''), quantity: Number(f.get(`q${i}`) || 1), unitCents: Math.round(Number(f.get(`u${i}`) || 0) * 100) })).filter((l) => l.description) })}>
      <Field label="Due in (days)"><input name="dueDays" type="number" min="0" max="90" placeholder="Your default" className={inputClass} /></Field>
      <Field label="Note on the invoice"><input name="note" className={inputClass} /></Field>
      <div className="self-end"><Btn onClick={() => setLines(lines + 1)}>Add a line</Btn></div>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="grid gap-2 sm:col-span-3 sm:grid-cols-3">
          <Field label="Description"><input name={`d${i}`} className={inputClass} /></Field>
          <Field label="Quantity"><input name={`q${i}`} type="number" min="1" defaultValue="1" className={inputClass} /></Field>
          <Field label={`Price each (${currency})`}><input name={`u${i}`} type="number" min="0" step="0.01" className={inputClass} /></Field>
        </div>
      ))}
    </ActionForm>
  )
}
