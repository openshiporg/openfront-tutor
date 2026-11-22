import { DeleteItemButton } from '../lib/actions'
import { day, lists, read } from '../lib/data'
import { Empty, Section } from '../lib/ui'
import { Page } from '../shell/Page'
import { ResourceForm } from './ResourceForm'

/** P21: resources: add a file or link, share with students (none chosen = every active student). */
export default async function ResourcesPage() {
  const b = await read<any>('query { myBusiness { success error data } }', 'myBusiness')
  if (!b.ok || !b.data.setUp) return <Page title="Resources" error={b.ok ? null : b.error} needsSetup={!b.ok || !b.data.setUp} />
  const d = await lists<any>('query { resources(orderBy: { createdAt: desc }, take: 300) { id title linkUrl note createdAt file { filename filesize } students { id firstName } } students(where: { status: { equals: active } }, orderBy: { firstName: asc }, take: 500) { id firstName lastName } }')
  const tz = b.data.profile.timezone
  return (
    <Page title="Resources">
      <Section title="Shared resources">
        {!d?.resources?.length ? <Empty>Nothing shared yet.</Empty> : <ul className="grid gap-2 text-sm">{d.resources.map((r: any) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
            <span className="min-w-0"><b>{r.title}</b>{r.linkUrl ? <> · <a className="underline" href={r.linkUrl} target="_blank" rel="noreferrer">link</a></> : null}{r.file ? <> · <a className="underline" href={`/api/files/resource/${r.id}`}>{r.file.filename.replace(/^[^-]+-/, '')}</a></> : null} · {r.students.length ? r.students.map((s: any) => s.firstName).join(', ') : 'every active student'} · {day(r.createdAt, tz)}{r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}</span>
            <DeleteItemButton list="Resource" id={r.id} confirm="Remove this resource for everyone?" />
          </li>
        ))}</ul>}
      </Section>
      <Section title="Add a resource"><ResourceForm students={d?.students ?? []} /></Section>
    </Page>
  )
}
