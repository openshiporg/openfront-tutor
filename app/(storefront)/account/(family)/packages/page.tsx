import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'
import { getMyFamily, getMyPackages } from '@/features/storefront/lib/data/account'
import { BuyPackage, ConfirmPackageOnReturn } from '@/features/storefront/components/PackageActions'
import { ReportPaymentForm } from '@/features/storefront/components/ReportPaymentForm'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Badge, ButtonLink, Card, Empty, PageTitle, statusTone } from '@/features/storefront/components/ui'
import { LEDGER_LABEL, METHOD_LABEL, duration, fmtDate, money } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Packages' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, string> = { awaiting_payment: 'Waiting for payment', active: 'Active', used_up: 'Used up', expired: 'Expired', refunded: 'Refunded' }

/** S15 packages: balances, ledger, expiry, buy by card or directly; S17 report a payment. */
export default async function Page({ searchParams }: { searchParams: Promise<{ purchase?: string; paid?: string }> }) {
  const [{ purchase, paid }, r, fam] = await Promise.all([searchParams, getMyPackages(), getMyFamily()])
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const d = r.data
  const c = d.currencyCode
  const tutorName = fam.data ? (fam.data.tutor.tutorName || fam.data.tutor.businessName).split(/\s+/)[0] : 'your tutor'
  const active = d.purchases.filter((p) => p.status === 'active')
  const left = active.reduce((a, p) => a + p.minutesRemaining, 0)
  return (
    <>
      <PageTitle sub="Buy lesson time ahead. Booked lessons take their time from your package first." action={left ? <ButtonLink href="/account/book"><CalendarDays className="size-4" aria-hidden />Book with my package</ButtonLink> : undefined}>Packages</PageTitle>
      {purchase && paid ? <div className="mb-5"><ConfirmPackageOnReturn purchaseId={purchase} paid={paid} /></div> : null}

      <Card className="mb-6 bg-white">
        <p className="text-[13.5px] font-semibold uppercase tracking-wide text-ink-soft">Time left</p>
        <p className="font-display text-[34px] font-semibold text-ink">{duration(left)}</p>
        <p className="text-[14.5px] text-ink-soft">{active.length ? `In ${active.length} active ${active.length === 1 ? 'package' : 'packages'}.` : 'No active package.'}</p>
      </Card>

      {d.purchases.length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-[22px] font-semibold text-ink">Your packages</h2>
          <div className="grid gap-4">
            {d.purchases.map((p) => (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[20px] font-semibold text-ink">{p.nameSnapshot}</h3>
                    <p className="text-[14.5px] text-ink-soft">{money(p.pricePaidCents, c)}{p.purchasedAt ? ` · bought ${fmtDate(p.purchasedAt)}` : ''}{p.expiresAt ? ` · ${p.status === 'expired' ? 'expired' : 'use by'} ${fmtDate(p.expiresAt)}` : ''}</p>
                  </div>
                  <Badge tone={statusTone(p.status)}>{STATUS[p.status] ?? p.status}</Badge>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-[14.5px]"><span className="font-semibold text-ink">{duration(p.minutesRemaining)} left</span><span className="text-ink-soft">of {duration(p.minutesGranted)}</span></div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-paper-deep"><div className="h-full rounded-full bg-wine" style={{ width: `${p.minutesGranted ? Math.round((p.minutesRemaining / p.minutesGranted) * 100) : 0}%` }} /></div>
                </div>
                {p.status === 'awaiting_payment' ? (
                  <div className="mt-4 grid gap-3 rounded-xl bg-paper-deep/60 p-4 text-[15px]">
                    <p className="text-ink">The minutes are ready once {tutorName} confirms the payment.</p>
                    {d.paymentInstructions ? <p className="whitespace-pre-line text-ink-soft">{d.paymentInstructions}</p> : null}
                    {p.payments.some((x) => x.status === 'reported') ? <p className="font-semibold text-ink">You reported a payment. Waiting for {tutorName} to confirm it.</p> : <ReportPaymentForm target="package" targetId={p.id} defaultCents={p.pricePaidCents} currency={c} />}
                  </div>
                ) : null}
                {p.entries.length ? (
                  <details className="mt-3">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-wine underline">History ({p.entries.length})</summary>
                    <ul className="mt-2 grid gap-1">
                      {p.entries.map((e, i) => (
                        <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-line/50 py-2 text-[14.5px] last:border-0">
                          <span className="text-ink">{LEDGER_LABEL[e.kind] ?? e.kind}{e.session ? <span className="text-ink-soft"> · {e.session.typeNameSnapshot}, {fmtDate(e.session.startsAt)}</span> : null}{e.note ? <span className="block text-[13.5px] text-ink-soft">{e.note}</span> : null}</span>
                          <span className="font-semibold text-ink">{e.minutes > 0 ? '+' : ''}{e.minutes} min · <span className="font-normal text-ink-soft">{fmtDate(e.createdAt)}</span></span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {p.payments.length ? <p className="mt-2 text-[13.5px] text-ink-soft">{p.payments.map((x) => `${METHOD_LABEL[x.method] ?? x.method} ${money(x.amountCents, c)} (${x.status})`).join(' · ')}</p> : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-[22px] font-semibold text-ink">Buy a package</h2>
        {d.packages.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {d.packages.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[20px] font-semibold text-ink">{p.name}</h3>
                  <p className="shrink-0 font-display text-[22px] font-semibold text-wine">{money(p.priceCents, c)}</p>
                </div>
                <p className="mt-1 text-[14.5px] text-ink-soft">{duration(p.minutes)} of lessons · use within {p.validMonths} {p.validMonths === 1 ? 'month' : 'months'}</p>
                {p.appliesTo.length ? <p className="mt-1 text-[14px] text-ink-soft">For {p.appliesTo.map((x) => x.name).join(', ')}</p> : null}
                {p.description ? <p className="mt-2 text-[15px] text-ink">{p.description}</p> : null}
                <div className="mt-auto pt-4"><BuyPackage packageId={p.id} cardPayments={d.cardPayments} paymentInstructions={d.paymentInstructions} tutorName={tutorName} /></div>
              </Card>
            ))}
          </div>
        ) : <Empty>Your tutor does not sell packages online right now.</Empty>}
      </section>
    </>
  )
}
