import Link from 'next/link'
import type { Metadata } from 'next'
import { ClaimForm } from '@/features/storefront/components/ClaimForm'
import { Notice } from '@/features/storefront/components/ui'

export const metadata: Metadata = { title: 'Create your family account' }

/** S7 from an invite: /account/claim?f=<familyId>&t=<token> */
export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string; t?: string }> }) {
  const { f, t } = await searchParams
  return (
    <>
      <h1 className="font-display text-[30px] font-semibold text-ink">Create your family account</h1>
      <p className="mb-6 mt-2 text-[15px] text-ink-soft">Your tutor invited you. Choose a password to see lessons, notes, homework and invoices in one place.</p>
      {f && t ? <ClaimForm familyId={f} token={t} askEmail /> : <Notice tone="error">This invite link is not complete. Open the link from your email, or <Link href="/account/signin" className="font-semibold underline">sign in</Link>.</Notice>}
    </>
  )
}
