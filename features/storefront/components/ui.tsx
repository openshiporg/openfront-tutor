import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/** Procyon storefront primitives: cream paper, burgundy actions, navy serif headings. */

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine disabled:cursor-not-allowed disabled:opacity-60'
export const btn = {
  primary: `${base} bg-wine text-white shadow-[0_2px_0_rgba(0,0,0,0.12)] hover:bg-wine-dark`,
  outline: `${base} border-2 border-wine bg-white/70 text-wine hover:bg-wine hover:text-white`,
  ghost: `${base} text-wine underline-offset-4 hover:underline`,
  quiet: `${base} border border-line bg-white text-ink hover:border-ink/40`,
  danger: `${base} border-2 border-wine/70 bg-white text-wine hover:bg-wine/5`,
}

export function Button({ variant = 'primary', className, ...props }: ComponentProps<'button'> & { variant?: keyof typeof btn }) {
  return <button {...props} className={cx(btn[variant], className)} />
}

export function ButtonLink({ variant = 'primary', className, ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link {...props} className={cx(btn[variant], className)} />
}

/** The hand-drawn brush stroke under serif headings. */
export function Stroke({ className, width = 120 }: { className?: string; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 120 12" width={width} height={(width / 120) * 12} className={cx('text-wine', className)} preserveAspectRatio="none">
      <path d="M2 8.5C22 4.5 48 2.8 70 3.4c18 .5 34 2.2 47 4.6" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  )
}

export function SectionTitle({ children, sub, className, as: As = 'h2', center }: { children: ReactNode; sub?: ReactNode; className?: string; as?: 'h1' | 'h2' | 'h3'; center?: boolean }) {
  return (
    <div className={cx('mb-6', center && 'text-center', className)}>
      <As className="font-display text-[28px] font-semibold italic leading-tight tracking-[-0.01em] text-ink sm:text-[32px]">{children}</As>
      <Stroke className={cx('mt-1', center && 'mx-auto')} width={90} />
      {sub ? <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{sub}</p> : null}
    </div>
  )
}

export function PageTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-[38px]">{children}</h1>
        <Stroke className="mt-1" width={110} />
        {sub ? <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{sub}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Card({ className, children, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cx('rounded-2xl border border-line/70 bg-white/80 p-5 shadow-[0_1px_2px_rgba(28,42,74,0.06)] sm:p-6', className)}>{children}</div>
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'error' | 'success' | 'warn'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'border-ink/15 bg-white text-ink',
    error: 'border-wine/40 bg-wine/5 text-wine-dark',
    success: 'border-emerald-700/30 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-600/40 bg-amber-50 text-amber-900',
  }
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-[15px] leading-relaxed', tones[tone], className)}>{children}</div>
}

export const inputClass = 'block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 py-2 text-[16px] text-ink placeholder:text-ink-soft/50 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/20'

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('grid gap-1.5', className)}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[13px] text-ink-soft">{hint}</span> : null}
    </label>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'wine' | 'green' | 'amber' | 'muted' }) {
  const tones = {
    neutral: 'bg-ink/8 text-ink',
    wine: 'bg-wine/10 text-wine',
    green: 'bg-emerald-100 text-emerald-900',
    amber: 'bg-amber-100 text-amber-900',
    muted: 'bg-ink/5 text-ink-soft',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold', tones[tone])}>{children}</span>
}

export function statusTone(status: string): 'neutral' | 'wine' | 'green' | 'amber' | 'muted' {
  if (['scheduled', 'paid', 'active', 'reviewed', 'confirmed', 'published'].includes(status)) return 'green'
  if (['pending_payment', 'unpaid', 'awaiting_payment', 'assigned', 'sent', 'reported', 'handed_in'].includes(status)) return 'amber'
  if (['late_cancelled', 'no_show', 'overdue', 'rejected'].includes(status)) return 'wine'
  return 'muted'
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/50 px-6 py-10 text-center text-[15px] text-ink-soft">
      <p>{children}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-line/60 py-2.5 text-[15px] last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  )
}
