import { ActionButton } from '../lib/actions'
import { label, lists, read, when } from '../lib/data'
import { Empty, Pill, Section } from '../lib/ui'
import { Page } from '../shell/Page'

/** P38: reviews: publish or hide. Only published reviews show on the page. */
export default async function ReviewsPage() {
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Reviews" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const d = await lists<any>('query { reviews(orderBy: { createdAt: desc }, take: 300) { id displayName rating body status createdAt family { guardianName } } }')
  const tz = b.data.profile.timezone
  return (
    <Page title="Reviews">
      <Section title="Reviews from families">
        {!d?.reviews?.length ? <Empty>No reviews yet. Families are offered “Write a review” after their third session.</Empty> : d.reviews.map((r: any) => (
          <div key={r.id} className="grid gap-1.5 rounded-md border p-3 text-sm">
            <p className="font-medium">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.displayName} <Pill tone={r.status === 'published' ? 'good' : r.status === 'pending' ? 'warn' : 'neutral'}>{label(r.status)}</Pill></p>
            <p className="text-muted-foreground">{r.family?.guardianName} · {when(r.createdAt, tz)}</p>
            {r.body ? <p className="whitespace-pre-wrap">{r.body}</p> : null}
            <span className="flex flex-wrap gap-2">
              {r.status !== 'published' ? <ActionButton op="moderateReview" vars={{ id: r.id, status: 'published' }} label="Publish" variant="primary" /> : null}
              {r.status !== 'hidden' ? <ActionButton op="moderateReview" vars={{ id: r.id, status: 'hidden' }} label="Hide" /> : null}
            </span>
          </div>
        ))}
      </Section>
    </Page>
  )
}
