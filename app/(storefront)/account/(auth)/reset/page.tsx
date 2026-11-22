import type { Metadata } from 'next'
import { ResetRedeemForm, ResetRequestForm } from '@/features/storefront/components/AuthForms'

export const metadata: Metadata = { title: 'Reset your password' }

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return (
    <>
      <h1 className="font-display text-[30px] font-semibold text-ink">{token ? 'Choose a new password' : 'Reset your password'}</h1>
      <p className="mb-6 mt-2 text-[15px] text-ink-soft">{token ? 'Enter your email and a new password.' : 'We will email you a link to choose a new password.'}</p>
      {token ? <ResetRedeemForm token={token} /> : <ResetRequestForm />}
    </>
  )
}
