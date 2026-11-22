import Link from 'next/link'
import { cx } from './ui'

/** The small mark beside the script wordmark: an open book with a spark. Neutral for any subject or city. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={cx('shrink-0', className)}>
      <path d="M20 13.5c-3.6-2.6-8.4-3.4-13.5-2.6v19.2c5.1-.8 9.9 0 13.5 2.6 3.6-2.6 8.4-3.4 13.5-2.6V10.9c-5.1-.8-9.9 0-13.5 2.6Z" fill="currentColor" opacity=".14" />
      <path d="M20 13.5c-3.6-2.6-8.4-3.4-13.5-2.6v19.2c5.1-.8 9.9 0 13.5 2.6m0-19.2c3.6-2.6 8.4-3.4 13.5-2.6v19.2c-5.1-.8-9.9 0-13.5 2.6m0-19.2v19.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M29.5 2.8l1.2 3.1 3.1 1.2-3.1 1.2-1.2 3.1-1.2-3.1-3.1-1.2 3.1-1.2z" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ name, sub, light, className }: { name: string; sub?: string; light?: boolean; className?: string }) {
  return (
    <Link href="/" className={cx('group flex min-h-11 min-w-0 items-center gap-2.5', className)} aria-label={`${name}: home`}>
      <Mark className={cx('size-9 sm:size-10', light ? 'text-white' : 'text-wine')} />
      <span className="min-w-0 leading-none">
        <span className={cx('block truncate font-script text-[28px] font-semibold leading-[1.05] sm:text-[34px]', light ? 'text-white' : 'text-ink')}>{name}</span>
        {sub ? <span className={cx('mt-1 block truncate text-[10.5px] font-semibold uppercase tracking-[0.18em] sm:text-[11px]', light ? 'text-white/80' : 'text-ink-soft')}>{sub}</span> : null}
      </span>
    </Link>
  )
}
