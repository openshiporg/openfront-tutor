import Link from 'next/link'
import type { Metadata } from 'next'
import { Download, ExternalLink } from 'lucide-react'
import { getMyHomework } from '@/features/storefront/lib/data/account'
import { HandInForm } from '@/features/storefront/components/HandInForm'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Badge, Card, Empty, PageTitle, cx, statusTone } from '@/features/storefront/components/ui'
import { fmtDate } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Homework' }
export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'assigned', label: 'To do' },
  { key: 'handed_in', label: 'Handed in' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'all', label: 'All' },
] as const
const LABEL: Record<string, string> = { assigned: 'To do', handed_in: 'Handed in', reviewed: 'Reviewed' }

function size(bytes: number | null) {
  if (!bytes) return ''
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`
}

/** S13: homework with instructions, files, hand-in and the tutor's feedback. */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams
  const tab = TABS.find((t) => t.key === raw)?.key ?? 'assigned'
  const r = await getMyHomework()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const rows = tab === 'all' ? r.data.homework : r.data.homework.filter((h) => h.status === tab)
  return (
    <>
      <PageTitle sub="Work set after lessons. Hand it in here and your tutor sees it.">Homework</PageTitle>
      <nav aria-label="Which homework" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/account/homework?status=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}
            className={cx('inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold', tab === t.key ? 'border-wine bg-wine text-white' : 'border-line bg-white text-ink hover:border-wine/50')}>
            {t.label}{t.key !== 'all' ? ` (${r.data!.homework.filter((h) => h.status === t.key).length})` : ''}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <div className="grid gap-4">
          {rows.map((h) => (
            <Card key={h.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold uppercase tracking-wide text-ink-soft">{h.student.firstName}</p>
                  <h2 className="font-display text-[21px] font-semibold text-ink">{h.title}</h2>
                  {h.dueAt ? <p className="text-[14.5px] text-ink-soft">Due {fmtDate(h.dueAt)}</p> : null}
                </div>
                <Badge tone={statusTone(h.status)}>{LABEL[h.status] ?? h.status}</Badge>
              </div>
              {h.instructions ? <p className="mt-3 whitespace-pre-line text-[15px] text-ink">{h.instructions}</p> : null}
              <div className="mt-2 flex flex-wrap gap-x-5">
                {h.linkUrl ? <a href={h.linkUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-wine underline"><ExternalLink className="size-4" aria-hidden />Open the link</a> : null}
                {h.file_filename ? <a href={`/api/files/homework/${h.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-wine underline"><Download className="size-4" aria-hidden />{h.file_filename}{h.file_filesize ? ` (${size(h.file_filesize)})` : ''}</a> : null}
              </div>
              {h.status !== 'assigned' ? (
                <div className="mt-3 rounded-xl bg-paper-deep/60 p-4 text-[15px]">
                  <p className="font-semibold text-ink">Handed in{h.handedInAt ? ` ${fmtDate(h.handedInAt)}` : ''}</p>
                  {h.guardianComment ? <p className="mt-1 whitespace-pre-line text-ink-soft">{h.guardianComment}</p> : null}
                  {h.handInUrl ? <a href={h.handInUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center break-all font-semibold text-wine underline">{h.handInUrl}</a> : null}
                </div>
              ) : null}
              {h.feedback ? (
                <div className="mt-3 rounded-xl border-l-4 border-wine bg-white p-4 text-[15px]">
                  <p className="font-semibold text-ink">Feedback{h.reviewedAt ? ` · ${fmtDate(h.reviewedAt)}` : ''}</p>
                  <p className="mt-1 whitespace-pre-line text-ink">{h.feedback}</p>
                </div>
              ) : null}
              {h.status === 'assigned' ? <div className="mt-4"><HandInForm id={h.id} /></div> : null}
            </Card>
          ))}
        </div>
      ) : <Empty>{tab === 'assigned' ? 'Nothing to do right now.' : 'Nothing here yet.'}</Empty>}
    </>
  )
}
