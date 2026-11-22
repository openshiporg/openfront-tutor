import Link from 'next/link'

import { DeleteItemButton } from '../lib/actions'
import { SetHomeworkForm } from '../lib/forms'
import { day, label, lists, read, when } from '../lib/data'
import { Empty, Field, Section, inputClass } from '../lib/ui'
import { Page } from '../shell/Page'
import { StudentForm } from '../families/FamilyForms'
import { MarkForm } from './MarkForm'

/** P18 student page (level, goals, needs, notes history, homework, marks, link) and P19 marks. */
export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await read<any>('query($id: ID!) { tutorStudent(id: $id) { success error data } }', 'tutorStudent', { id })
  if (!r.ok) return <Page title="Student" crumbs={[{ label: 'Families', href: '/dashboard/platform/families' }]} error={r.error} needsSetup={r.needsSetup} />
  const s = r.data
  const tz = s.timezone
  const subj = await lists<any>('query { subjects(where: { active: { equals: true } }) { id name } }')
  const max = Math.max(...s.marks.map((m: any) => (m.score / m.outOf) * 100), 100)
  return (
    <Page title={`${s.firstName} ${s.lastName}`.trim()} crumbs={[{ label: 'Families', href: '/dashboard/platform/families' }, { label: s.family?.guardianName ?? 'Family', href: `/dashboard/platform/families/${s.family?.id}` }]}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Student"><StudentForm familyId={s.family?.id} s={s} subjects={subj?.subjects ?? []} /></Section>
        <Section title="Progress marks">
          {s.marks.length ? (
            <div className="grid gap-2">
              <div className="flex h-32 items-end gap-1 rounded-md border p-2" aria-label="Marks over time">
                {s.marks.map((m: any) => { const pct = Math.round((m.score / m.outOf) * 100); return <div key={m.id} className="flex min-w-6 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] tabular-nums">{pct}%</span><div className="w-full rounded-t bg-foreground/70" style={{ height: `${(pct / max) * 90}%` }} /></div> })}
              </div>
              <ul className="grid gap-1 text-sm">{s.marks.map((m: any) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2"><span>{day(m.takenOn, tz)} · {m.label} · {m.score}/{m.outOf}{m.note ? ` · ${m.note}` : ''}</span><DeleteItemButton list="ProgressMark" id={m.id} confirm="Remove this mark?" /></li>)}</ul>
            </div>
          ) : <Empty>No marks yet.</Empty>}
          <MarkForm studentId={s.id} />
        </Section>
        <Section title="Notes history">
          {!s.sessions.some((x: any) => x.note) ? <Empty>No notes yet.</Empty> : <ul className="grid max-h-[32rem] gap-3 overflow-y-auto text-sm">{s.sessions.filter((x: any) => x.note).map((x: any) => (
            <li key={x.id} className="grid gap-0.5 border-b pb-2"><Link className="font-medium underline" href={`/dashboard/platform/sessions/${x.id}`}>{when(x.startsAt, tz)} · {x.typeNameSnapshot}</Link>
              {x.note.covered ? <p>Covered: {x.note.covered}</p> : null}{x.note.wentWell ? <p>Went well: {x.note.wentWell}</p> : null}{x.note.workOnNext ? <p>Next: {x.note.workOnNext}</p> : null}{x.note.privateNote ? <p className="text-muted-foreground">Private: {x.note.privateNote}</p> : null}
            </li>
          ))}</ul>}
        </Section>
        <Section title="Homework">
          {!s.homework.length ? <Empty>No homework yet.</Empty> : <ul className="grid gap-1 text-sm">{s.homework.map((h: any) => <li key={h.id}>{h.title} · {label(h.status)}{h.dueAt ? ` · due ${day(h.dueAt, tz)}` : ''}</li>)}</ul>}
          <SetHomeworkForm studentId={s.id} className="grid gap-2 sm:grid-cols-2">
            <Field label="Title"><input name="title" required className={inputClass} /></Field>
            <Field label="Due"><input name="due" type="date" className={inputClass} /></Field>
            <Field label="Instructions"><input name="instructions" className={inputClass} /></Field>
            <Field label="Link"><input name="link" type="url" className={inputClass} /></Field>
          </SetHomeworkForm>
        </Section>
      </div>
    </Page>
  )
}
