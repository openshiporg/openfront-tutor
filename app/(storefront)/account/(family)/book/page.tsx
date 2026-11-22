import type { Metadata } from 'next'
import { getMyFamily } from '@/features/storefront/lib/data/account'
import { getPublicTutor } from '@/features/storefront/lib/data/public'
import { FamilyBookingFlow } from '@/features/storefront/components/FamilyBookingFlow'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { PageTitle } from '@/features/storefront/components/ui'

export const metadata: Metadata = { title: 'Book a lesson' }
export const dynamic = 'force-dynamic'

/** S10: book as a known family, with how it will be paid shown before booking. */
export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [{ type }, fam] = await Promise.all([searchParams, getMyFamily()])
  if (!fam.success || !fam.data) return <ErrorPage error={fam.error} />
  const t = await getPublicTutor(fam.data.tutor.slug)
  if (!t.ok || !t.data) return <ErrorPage error={t.ok ? 'Your tutor’s page was not found.' : t.error} />
  return (
    <>
      <PageTitle sub="Choose a lesson, a time and who it is for.">Book a lesson</PageTitle>
      <FamilyBookingFlow tutor={t.data} family={fam.data} initialTypeId={type} />
    </>
  )
}
