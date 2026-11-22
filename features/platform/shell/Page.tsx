import Link from 'next/link'
import type { ReactNode } from 'react'

import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { Notice } from '../lib/ui'

type Crumb = { label: string; href?: string }

/** Every platform page: breadcrumbs, a heading, and the "set up first" state. */
export function Page({ title, crumbs = [], children, actions, error, needsSetup }: { title: string; crumbs?: Crumb[]; children?: ReactNode; actions?: ReactNode; error?: string | null; needsSetup?: boolean }) {
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, ...crumbs.map((c) => ({ type: 'link' as const, label: c.label, href: c.href })), { type: 'page' as const, label: title }]
  return (
    <PageContainer title={title} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-4 px-4 pb-24 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {actions}
        </div>
        {needsSetup ? <Notice>Set up your business first. <Link className="underline" href="/dashboard/platform/setup">Set up your business</Link></Notice> : error ? <Notice tone="alert">{error}</Notice> : children}
      </div>
    </PageContainer>
  )
}
