import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetRedeemForm, ResetRequestForm } from '@/features/storefront/components/AuthForms'
import { mailConfigured } from '@/features/keystone/utils/notify'
import { getHomeTutor } from '@/features/storefront/lib/data/public'
import { firstName } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Reset your password' }
export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token && !mailConfigured()) {
    // This site cannot send email, so a reset link would never arrive. Say so and give the way that works.
    const r = await getHomeTutor()
    const tutor = r.ok && r.data ? firstName(r.data) : 'your tutor'
    return (
      <>
        <h1 className="font-display text-[30px] font-semibold text-ink">Reset your password</h1>
        <p className="mt-2 text-[15px] text-ink-soft">This site does not send email yet, so a reset link cannot reach you.</p>
        <p className="mb-6 mt-3 text-[15px] text-ink-soft">Ask {tutor} for a new account link. It lets you choose a new password and signs you in.</p>
        <Link href={r.ok && r.data ? `/contact/${r.data.slug}` : '/'} className="inline-flex min-h-11 items-center rounded-md bg-wine px-5 text-[15px] font-semibold text-white hover:bg-wine/90">Ask {tutor}</Link>
      </>
    )
  }
  return (
    <>
      <h1 className="font-display text-[30px] font-semibold text-ink">{token ? 'Choose a new password' : 'Reset your password'}</h1>
      <p className="mb-6 mt-2 text-[15px] text-ink-soft">{token ? 'Enter your email and a new password.' : 'We will email you a link to choose a new password.'}</p>
      {token ? <ResetRedeemForm token={token} /> : <ResetRequestForm />}
    </>
  )
}
