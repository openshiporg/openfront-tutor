'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Printer } from 'lucide-react'
import type { InvoiceDetail } from '../lib/types'
import { confirmInvoice, startInvoicePayment } from '../lib/data/invoice-actions'
import { METHOD_LABEL, fmtDate, money } from '../lib/format'
import { Badge, Button, Card, Notice, Row, Stroke, statusTone } from './ui'
import { ReportPaymentForm } from './ReportPaymentForm'

/** S16: one invoice, by private link (token) or from the account. */
export function InvoiceView({ inv, token, paid, cleanUrl }: { inv: InvoiceDetail; token?: string | null; paid?: string; cleanUrl: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(paid === '1' ? { tone: 'info', text: 'Checking your payment…' } : paid === '0' ? { tone: 'info', text: 'The payment was not finished. You can try again.' } : null)
  const done = useRef(false)
  useEffect(() => {
    if (paid !== '1' || done.current) return
    done.current = true
    confirmInvoice(inv.id, token).then((r) => {
      if (!r.success) setMsg({ tone: 'error', text: r.error ?? 'We could not check the payment yet.' })
      else if (r.data?.paid) { setMsg({ tone: 'success', text: 'Payment received. Thank you.' }); router.replace(cleanUrl); router.refresh() }
      else setMsg({ tone: 'info', text: 'Your payment is not complete yet. If you paid, refresh in a moment.' })
    })
  }, [paid, inv.id, token, cleanUrl, router])
  const c = inv.currencyCode
  const open = inv.balanceCents > 0 && !['void', 'paid', 'draft'].includes(inv.status)
  return (
    <div className="grid gap-6">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card className="print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Invoice</p>
            <h2 className="font-display text-[26px] font-semibold text-ink">{inv.number}</h2>
            <Stroke width={60} />
          </div>
          <div className="text-right">
            <Badge tone={inv.overdue ? 'wine' : statusTone(inv.status)}>{inv.overdue ? 'Overdue' : inv.status.replace('_', ' ')}</Badge>
            <p className="mt-2 font-display text-[22px] font-semibold text-ink">{money(inv.balanceCents, c)}</p>
            <p className="text-[13px] text-ink-soft">to pay</p>
          </div>
        </div>
        <div className="mt-4 grid gap-1 text-[15px] sm:grid-cols-2">
          <p><span className="text-ink-soft">From</span> <strong>{inv.tutor.businessName}</strong></p>
          <p><span className="text-ink-soft">To</span> <strong>{inv.guardianName}</strong></p>
          {inv.issuedAt ? <p><span className="text-ink-soft">Issued</span> {fmtDate(inv.issuedAt)}</p> : null}
          {inv.dueAt ? <p><span className="text-ink-soft">Due</span> {fmtDate(inv.dueAt)}</p> : null}
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[15px]">
            <thead><tr className="border-b border-line text-[13px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-semibold">Item</th><th className="py-2 text-right font-semibold">Qty</th><th className="py-2 text-right font-semibold">Each</th><th className="py-2 text-right font-semibold">Total</th></tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} className="border-b border-line/60"><td className="py-2.5 pr-3 text-ink">{l.description}</td><td className="py-2.5 text-right">{l.quantity}</td><td className="py-2.5 text-right">{money(l.unitCents, c)}</td><td className="py-2.5 text-right font-medium">{money(l.totalCents, c)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-3 max-w-xs">
          <Row label="Subtotal">{money(inv.subtotalCents, c)}</Row>
          <Row label="Total">{money(inv.totalCents, c)}</Row>
          <Row label="Paid">{money(inv.paidCents, c)}</Row>
          <Row label="Balance">{money(inv.balanceCents, c)}</Row>
        </dl>
        {inv.note ? <p className="mt-3 whitespace-pre-line text-[14.5px] text-ink-soft">{inv.note}</p> : null}
        {inv.payments.length ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Payments</h3>
            <ul className="mt-1 grid gap-1 text-[14px] text-ink-soft">
              {inv.payments.map((p) => <li key={p.id}>{p.paidAt ? fmtDate(p.paidAt) : 'Pending'} · {METHOD_LABEL[p.method] ?? p.method} · {money(p.amountCents, c)}{p.kind === 'refund' ? ' (refund)' : ''} · {p.status}{p.reference ? ` · ${p.reference}` : ''}</li>)}
            </ul>
          </div>
        ) : null}
        <button type="button" onClick={() => window.print()} className="mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-wine underline print:hidden"><Printer className="size-4" aria-hidden />Print or save as PDF</button>
      </Card>
      {open ? (
        <Card className="print:hidden">
          <h2 className="font-display text-[20px] font-semibold text-ink">Pay this invoice</h2>
          {inv.canPayByCard ? (
            <div className="mt-3">
              <Button className="min-h-12" disabled={pending} onClick={() => start(async () => {
                setError(null)
                const r = await startInvoicePayment(inv.id, token)
                if (!r.success || !r.data?.url) { setError(r.error); return }
                window.location.assign(r.data.url)
              })}><CreditCard className="size-5" aria-hidden />{pending ? 'Opening secure payment…' : `Pay ${money(inv.balanceCents, c)} by card`}</Button>
              {error ? <Notice tone="error" className="mt-3">{error}</Notice> : null}
            </div>
          ) : null}
          <div className="mt-4 rounded-xl bg-paper-deep/70 p-4 text-[15px]">
            <p className="font-semibold text-ink">{inv.canPayByCard ? 'Or pay your tutor directly' : 'Pay your tutor directly'}</p>
            <p className="mt-1 whitespace-pre-line text-ink-soft">{inv.paymentInstructions || `Contact ${inv.tutor.businessName}${inv.tutor.email ? ` at ${inv.tutor.email}` : ''} for payment details.`}</p>
          </div>
          {!token ? <div className="mt-4"><ReportPaymentForm target="invoice" targetId={inv.id} defaultCents={inv.balanceCents} currency={c} /></div> : null}
        </Card>
      ) : null}
    </div>
  )
}
