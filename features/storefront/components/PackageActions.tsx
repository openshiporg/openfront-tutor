'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, HandCoins } from 'lucide-react'
import { buyPackage, confirmPackagePayment } from '../lib/data/account'
import { duration } from '../lib/format'
import { Button, Notice } from './ui'

/** S15: buy a package by card (Stripe Checkout) or choose to pay the tutor directly. */
export function BuyPackage({ packageId, cardPayments, paymentInstructions, tutorName }: { packageId: string; cardPayments: boolean; paymentInstructions: string | null; tutorName: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [direct, setDirect] = useState<string | null | undefined>(undefined)
  const [pending, start] = useTransition()
  const buy = (method: 'card' | 'direct') => start(async () => {
    setError(null)
    const r = await buyPackage(packageId, method)
    if (!r.success || !r.data) { setError(r.error); return }
    if (method === 'card' && r.data.checkoutUrl) { window.location.href = r.data.checkoutUrl; return }
    setDirect(r.data.paymentInstructions ?? paymentInstructions)
    router.refresh()
  })
  if (direct !== undefined) {
    return (
      <Notice tone="success">
        <p className="font-semibold">Requested. Pay {tutorName} directly; the minutes are ready once {tutorName} confirms the payment.</p>
        {direct ? <p className="mt-1 whitespace-pre-line">{direct}</p> : null}
      </Notice>
    )
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {cardPayments ? <Button disabled={pending} onClick={() => buy('card')}><CreditCard className="size-4" aria-hidden />{pending ? 'Opening…' : 'Buy by card'}</Button> : null}
        <Button variant={cardPayments ? 'outline' : 'primary'} disabled={pending} onClick={() => buy('direct')}><HandCoins className="size-4" aria-hidden />Pay {tutorName} directly</Button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  )
}

/** After Stripe returns to /account/packages?purchase=<id>&paid=1, read the payment back. */
export function ConfirmPackageOnReturn({ purchaseId, paid }: { purchaseId: string; paid: string }) {
  const router = useRouter()
  const done = useRef(false)
  const [msg, setMsg] = useState<{ tone: 'info' | 'success' | 'error' | 'warn'; text: string }>(paid === '1' ? { tone: 'info', text: 'Checking your payment…' } : { tone: 'warn', text: 'The payment was not finished. You can try again.' })
  useEffect(() => {
    if (paid !== '1' || done.current) return
    done.current = true
    confirmPackagePayment(purchaseId).then((r) => {
      if (!r.success || !r.data) setMsg({ tone: 'error', text: r.error ?? 'We could not check the payment yet.' })
      else if (r.data.paid) { setMsg({ tone: 'success', text: `Payment received. ${duration(r.data.minutesRemaining)} is ready to book.` }); router.replace('/account/packages'); router.refresh() }
      else setMsg({ tone: 'info', text: 'Your payment is not complete yet. If you paid, refresh in a moment.' })
    })
  }, [paid, purchaseId, router])
  return <Notice tone={msg.tone}>{msg.text}</Notice>
}
