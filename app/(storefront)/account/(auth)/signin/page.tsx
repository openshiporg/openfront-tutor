import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInForm } from '@/features/storefront/components/AuthForms'
import { getViewer } from '@/features/storefront/lib/data/account'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, viewer] = await Promise.all([searchParams, getViewer()])
  if (viewer && !viewer.isTutor) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account')
  return (
    <>
      <h1 className="font-display text-[30px] font-semibold text-ink">Family sign in</h1>
      <p className="mb-6 mt-2 text-[15px] text-ink-soft">See your lessons, notes, homework, packages and invoices.</p>
      <SignInForm next={next} />
      <p className="mt-6 border-t border-line pt-4 text-[14.5px] text-ink-soft">New here? Book a first lesson from the home page; you can create your account from your booking. Are you the tutor? <Link href="/dashboard" className="font-semibold text-wine underline">Use the dashboard</Link>.</p>
    </>
  )
}
