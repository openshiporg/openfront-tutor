import Link from 'next/link'
import { CalendarDays, Menu, UserRound } from 'lucide-react'
import { Wordmark } from './Wordmark'
import { btn, cx } from './ui'

const LINKS = [
  { href: '/#top', label: 'Home' },
  { href: '/#about', label: 'About' },
  { href: '/#lessons', label: 'Lessons' },
  { href: '/#rates', label: 'Rates' },
  { href: '/#policies', label: 'Policies' },
  { href: '/#contact', label: 'Contact' },
]

export function Header({ name, sub, slug, viewer }: { name: string; sub: string; slug: string | null; viewer: { name: string; isTutor: boolean } | null }) {
  const bookHref = viewer && !viewer.isTutor ? '/account/book' : slug ? `/book/${slug}` : '/#contact'
  const account = viewer
    ? viewer.isTutor
      ? { href: '/dashboard', label: 'Your dashboard' }
      : { href: '/account', label: viewer.name.split(/\s+/)[0] || 'Your account' }
    : { href: '/account/signin', label: 'Sign in' }
  return (
    <header className="relative z-30 px-3 pt-3 sm:px-6 lg:px-[6%]">
      <div className="flex items-center justify-between gap-3 rounded-b-2xl rounded-t-xl bg-paper/95 px-4 py-2.5 shadow-[0_6px_24px_rgba(28,42,74,0.10)] backdrop-blur sm:px-7">
        <Wordmark name={name} sub={sub} className="min-w-0 flex-1 lg:flex-none" />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-[15px] font-medium text-ink hover:text-wine">{l.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href={account.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[15px] font-medium text-ink hover:text-wine">
            <UserRound className="size-4" aria-hidden />{account.label}
          </Link>
          <Link href={bookHref} className={btn.primary}><CalendarDays className="size-4" aria-hidden />Book a Lesson</Link>
        </div>
        <details className="group relative lg:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-white text-ink [&::-webkit-details-marker]:hidden" aria-label="Menu">
            <Menu className="size-5" aria-hidden />
          </summary>
          <div className="absolute right-0 top-14 w-[min(86vw,320px)] rounded-2xl border border-line bg-paper p-3 shadow-xl">
            <nav aria-label="Main" className="grid">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="flex min-h-11 items-center rounded-lg px-3 text-[16px] font-medium text-ink hover:bg-white">{l.label}</Link>
              ))}
              <Link href={account.href} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-[16px] font-medium text-ink hover:bg-white"><UserRound className="size-4" aria-hidden />{account.label}</Link>
            </nav>
            <Link href={bookHref} className={cx(btn.primary, 'mt-2 w-full')}><CalendarDays className="size-4" aria-hidden />Book a Lesson</Link>
          </div>
        </details>
      </div>
    </header>
  )
}
