import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getViewer } from '@/features/storefront/lib/data/account'
import { AccountNav } from '@/features/storefront/components/AccountNav'
import { SignOutButton } from '@/features/storefront/components/AuthForms'
import { Notice } from '@/features/storefront/components/ui'

export const dynamic = 'force-dynamic'

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()
  if (!viewer) {
    const h = await headers()
    const path = h.get('x-storefront-path') || '/account'
    redirect(`/account/signin?next=${encodeURIComponent(path)}`)
  }
  if (viewer.isTutor) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-14">
        <Notice>You are signed in as the tutor. The family account is for parents and guardians. <Link href="/dashboard" className="font-semibold underline">Open your dashboard</Link>.</Notice>
        <div className="mt-4"><SignOutButton /></div>
      </main>
    )
  }
  return (
    <div className="mx-auto grid max-w-[1240px] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10 lg:py-10">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 hidden px-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-soft lg:block">{viewer.name}</p>
        <AccountNav />
        <div className="mt-3 hidden px-3 lg:block"><SignOutButton /></div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  )
}
