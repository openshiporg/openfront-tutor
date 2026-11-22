import type { Metadata } from 'next'
import { Download, ExternalLink } from 'lucide-react'
import { getMyResources } from '@/features/storefront/lib/data/account'
import { ErrorPage } from '@/features/storefront/components/SessionList'
import { Badge, Card, Empty, PageTitle } from '@/features/storefront/components/ui'
import { fmtDate } from '@/features/storefront/lib/format'

export const metadata: Metadata = { title: 'Resources' }
export const dynamic = 'force-dynamic'

function size(bytes: number | null) {
  if (!bytes) return ''
  return bytes > 1_000_000 ? ` (${(bytes / 1_000_000).toFixed(1)} MB)` : ` (${Math.max(1, Math.round(bytes / 1000))} KB)`
}

/** S18: links and files the tutor shared with the family. */
export default async function Page() {
  const r = await getMyResources()
  if (!r.success || !r.data) return <ErrorPage error={r.error} />
  const rows = r.data.resources
  return (
    <>
      <PageTitle sub="Worksheets, notes and links your tutor shared.">Resources</PageTitle>
      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((x) => (
            <Card key={x.id} className="flex flex-col">
              <h2 className="font-display text-[19px] font-semibold text-ink">{x.title}</h2>
              <p className="text-[13.5px] text-ink-soft">Shared {fmtDate(x.createdAt)}</p>
              {x.students.length ? <div className="mt-2 flex flex-wrap gap-1.5">{x.students.map((s) => <Badge key={s.id}>{s.firstName}</Badge>)}</div> : null}
              {x.note ? <p className="mt-2 whitespace-pre-line text-[15px] text-ink">{x.note}</p> : null}
              <div className="mt-auto flex flex-wrap gap-x-5 pt-2">
                {x.linkUrl ? <a href={x.linkUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-wine underline"><ExternalLink className="size-4" aria-hidden />Open</a> : null}
                {x.fileUrl ? <a href={x.fileUrl} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-wine underline"><Download className="size-4" aria-hidden />Download{size(x.file_filesize)}</a> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : <Empty>Nothing shared yet.</Empty>}
    </>
  )
}
