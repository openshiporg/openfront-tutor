'use client'

import { useState, useTransition } from 'react'
import { ItemForm } from '../lib/actions'
import { runOperation } from '../lib/request'
import { Btn, Field, inputClass, Notice } from '../lib/ui'

/** Parses "12.50" into 1250 minor units. */
export function toCents(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) throw new Error('Enter an amount like 12.50.')
  return Math.round(n * 100)
}

/** P36: one expense (travel, materials, software, room hire). */
export function ExpenseForm({ currency, defaultDate }: { currency: string; defaultDate: string }) {
  return (
    <ItemForm list="Expense" submit="Add expense" resetOnDone className="grid gap-3 sm:grid-cols-4" toData={(f) => ({
      spentOn: new Date(`${f.get('spentOn')}T12:00:00Z`).toISOString(), category: f.get('category'), amountCents: toCents(f.get('amount')), note: String(f.get('note') || ''),
    })}>
      <Field label="Date"><input name="spentOn" type="date" required defaultValue={defaultDate} className={inputClass} /></Field>
      <Field label="Category"><select name="category" className={inputClass}>{[['travel', 'Travel'], ['materials', 'Materials'], ['software', 'Software'], ['room', 'Room hire'], ['other', 'Other']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label={`Amount (${currency})`}><input name="amount" inputMode="decimal" required placeholder="12.50" className={inputClass} /></Field>
      <Field label="Note"><input name="note" className={inputClass} /></Field>
    </ItemForm>
  )
}

/** Downloads a CSV for the accountant (§7). */
export function CsvButton({ kind, from, to }: { kind: 'payments' | 'sessions'; from: string; to: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-grid gap-1">
      <Btn disabled={pending} onClick={() => start(async () => {
        setError(null)
        const r = await runOperation('exportCsv', { kind, from, to })
        if (!r.success) { setError(r.error || 'Not exported.'); return }
        const d = r.data as { filename: string; csv: string }
        const url = URL.createObjectURL(new Blob([d.csv], { type: 'text/csv' }))
        const a = document.createElement('a'); a.href = url; a.download = d.filename; a.click(); URL.revokeObjectURL(url)
      })}>{pending ? 'Preparing…' : `${kind === 'payments' ? 'Payments' : 'Sessions'} CSV`}</Btn>
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </span>
  )
}
