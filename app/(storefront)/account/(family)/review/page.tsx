import type { Metadata } from 'next'
import { getMyFamily } from '@/features/storefront/lib/data/account'
import { ReviewForm } from '@/features/storefront/components/ReviewForm'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Card, Notice, PageTitle } from '@/features/storefront/components/ui'

export const metadata: Metadata = { title: 'Write a review' }
export const dynamic = 'force-dynamic'

/** S19: offered once a family has had a few lessons (myFamily.canReview). */
export default async function Page() {
  const r = await getMyFamily()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const tutor = r.data.tutor.tutorName || r.data.tutor.businessName
  const parts = r.data.family.guardianName.split(/\s+/).filter(Boolean)
  const name = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? ''
  return (
    <>
      <PageTitle sub="Your words help other families decide.">Write a review</PageTitle>
      <Card className="max-w-2xl">
        {r.data.canReview ? <ReviewForm defaultName={name} tutorName={tutor} /> : <Notice>Reviews open after your first few lessons, one per family. If you already wrote one, thank you.</Notice>}
      </Card>
    </>
  )
}
