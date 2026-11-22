'use client'

/**
 * Client wrappers for the forms that server pages render. A server component
 * cannot pass functions (toVars, done) to a client component, so each form's
 * variables are built here from plain props; the fields stay in the page.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ActionButton, ActionForm, ItemForm } from './actions'

const money = (cents: number | null | undefined, currency = 'USD') => {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100) } catch { return `${((cents ?? 0) / 100).toFixed(2)} ${currency}` }
}
const cents = (v: FormDataEntryValue | null) => Math.round(Number(v || 0) * 100)

type Wrap = { children: ReactNode; className?: string }

export function AddInvoiceLineForm({ invoiceId, children, className }: Wrap & { invoiceId: string }) {
  return <ActionForm op="addInvoiceLine" submit="Add line" className={className} resetOnDone toVars={(f) => ({ invoiceId, line: { description: f.get('d'), quantity: Number(f.get('q') || 1), unitCents: cents(f.get('u')) } })}>{children}</ActionForm>
}

export function RefundPaymentForm({ paymentId, currency, submit, children, className }: Wrap & { paymentId: string; currency: string; submit: string }) {
  return <ActionForm op="refundPayment" submit={submit} className={className} toVars={(f) => ({ paymentId, amountCents: cents(f.get('amount')), note: f.get('note') })} done={(r) => `Refunded ${money(r?.refundedCents, currency)}.`}>{children}</ActionForm>
}

export function RefundPackageButton({ purchaseId, currency, confirm }: { purchaseId: string; currency: string; confirm: string }) {
  return <ActionButton op="refundPackage" vars={{ purchaseId }} label="Refund unused minutes" variant="danger" confirm={confirm} done={(d) => `Refunded ${money(d?.refundedCents, currency)}.`} />
}

export function AdjustMinutesForm({ purchaseId, children, className }: Wrap & { purchaseId: string }) {
  return <ActionForm op="adjustMinutes" submit="Adjust minutes" className={className} resetOnDone toVars={(x) => ({ purchaseId, minutes: Math.trunc(Number(x.get('minutes'))), reason: x.get('reason') })}>{children}</ActionForm>
}

export function SellPackageForm({ familyId, children, className }: Wrap & { familyId: string }) {
  return <ActionForm op="sellPackage" submit="Sell package" className={className} toVars={(x) => ({ familyId, packageId: x.get('packageId'), method: x.get('method'), reference: x.get('reference') })} done={() => 'Sold and paid; the minutes are ready to use.'}>{children}</ActionForm>
}

export function ReviewHomeworkForm({ id, children, className }: Wrap & { id: string }) {
  return <ActionForm op="reviewHomework" submit="Mark reviewed" className={className} toVars={(f) => ({ id, feedback: f.get('feedback') })}>{children}</ActionForm>
}

export function ConvertInquiryForm({ id, children, className }: Wrap & { id: string }) {
  return (
    <ActionForm op="convertInquiry" submit="Make them a family" className={className} toVars={(f) => ({ id, studentName: f.get('studentName'), billingMode: f.get('billingMode') })}
      done={(r) => <>Family created. <Link className="underline" href={`/dashboard/platform/families/${r.familyId}`}>Open the family</Link>{r.inviteUrl ? <> · Invite link: <code className="break-all text-xs">{r.inviteUrl}</code></> : null}</>}>
      {children}
    </ActionForm>
  )
}

export function SessionNoteForm({ sessionId, submit, children, className }: Wrap & { sessionId: string; submit: string }) {
  return (
    <ActionForm op="saveSessionNote" submit={submit} className={className}
      toVars={(f) => ({ sessionId, covered: f.get('covered'), wentWell: f.get('wentWell'), workOnNext: f.get('workOnNext'), privateNote: f.get('privateNote'), effort: f.get('effort') ? Number(f.get('effort')) : null, share: true })}>
      {children}
    </ActionForm>
  )
}

export function SetHomeworkForm({ studentId, children, className }: Wrap & { studentId: string }) {
  return (
    <ItemForm list="Homework" submit="Set homework" resetOnDone className={className}
      toData={(f) => ({ student: { connect: { id: studentId } }, title: f.get('title'), instructions: f.get('instructions'), dueAt: f.get('due') ? new Date(`${f.get('due')}T23:00:00`).toISOString() : null, linkUrl: f.get('link') })}>
      {children}
    </ItemForm>
  )
}
