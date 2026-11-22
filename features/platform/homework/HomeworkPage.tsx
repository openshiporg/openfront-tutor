import { ActionForm } from '../lib/actions'
import { day, read, when } from '../lib/data'
import { Empty, Field, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'
import Link from 'next/link'

/** P20: the homework board: assigned, handed in, to review; write feedback. */
export default async function HomeworkPage() {
  const r = await read<any>('query { homeworkBoard { success error data } }', 'homeworkBoard')
  if (!r.ok) return <Page title="Homework" error={r.error} needsSetup={r.needsSetup} />
  const { assigned, handedIn, reviewed, timezone: tz } = r.data
  const row = (h: any) => <span><Link className="underline" href={`/dashboard/platform/students/${h.student?.id}`}>{h.student?.firstName}</Link> · {h.title}{h.dueAt ? ` · due ${day(h.dueAt, tz)}` : ''}</span>
  const review = (h: any) => (
    <ActionForm op="reviewHomework" submit="Mark reviewed" className="grid gap-2" toVars={(f) => ({ id: h.id, feedback: f.get('feedback') })}>
      <Field label="Feedback for the family"><input name="feedback" className={inputClass} /></Field>
    </ActionForm>
  )
  return (
    <Page title="Homework">
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={`Handed in (${handedIn.length})`}>
          {!handedIn.length ? <Empty>Nothing to review.</Empty> : handedIn.map((h: any) => (
            <div key={h.id} className="grid gap-1.5 rounded-md border p-3 text-sm">{row(h)}<p className="text-muted-foreground">Handed in {when(h.handedInAt, tz)}{h.guardianComment ? `: “${h.guardianComment}”` : ''}</p>{h.handInUrl ? <a className="underline" href={h.handInUrl} target="_blank" rel="noreferrer">Their work</a> : null}{h.file_filename ? <a className="underline" href={`/api/files/homework/${h.id}`}>Attached file</a> : null}{review(h)}</div>
          ))}
        </Section>
        <Section title={`Assigned (${assigned.length})`}>
          {!assigned.length ? <Empty>No open homework.</Empty> : assigned.map((h: any) => <details key={h.id} className="rounded-md border p-3 text-sm"><summary className="cursor-pointer">{row(h)}</summary><div className="mt-2">{h.instructions ? <p>{h.instructions}</p> : null}{review(h)}</div></details>)}
        </Section>
        <Section title="Reviewed (last 30 days)">
          {!reviewed.length ? <Empty>Nothing reviewed recently.</Empty> : <ul className="grid gap-1 text-sm">{reviewed.map((h: any) => <li key={h.id}>{row(h)}{h.feedback ? <span className="text-muted-foreground"> · {h.feedback}</span> : null}</li>)}</ul>}
        </Section>
      </div>
    </Page>
  )
}
