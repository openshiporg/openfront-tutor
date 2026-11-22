import { redirect } from 'next/navigation'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Page } from '../shell/Page'
import { read } from '../lib/data'
import { SetupForm } from './SetupForm'

export default async function SetupPage() {
  const b = await read<{ setUp: boolean }>('query { myBusiness { success error data } }', 'myBusiness')
  if (b.ok && b.data.setUp) redirect('/dashboard/platform/today')
  const me = await keystoneClient<{ authenticatedItem: { name: string; email: string } | null }>('query { authenticatedItem { ... on User { name email } } }')
  const user = me.success ? me.data.authenticatedItem : null
  return (
    <Page title="Set up your business" crumbs={[]}>
      <p className="max-w-2xl text-sm text-muted-foreground">A few details and your booking page is ready to share. Everything here can be changed later in Settings.</p>
      <SetupForm name={user?.name ?? ''} email={user?.email ?? ''} />
    </Page>
  )
}
