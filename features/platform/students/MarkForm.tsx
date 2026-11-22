'use client'

import { ItemForm } from '../lib/actions'
import { Field, inputClass } from '../lib/ui'

export function MarkForm({ studentId }: { studentId: string }) {
  return (
    <ItemForm list="ProgressMark" submit="Add mark" resetOnDone className="grid gap-2 sm:grid-cols-2" toData={(f) => ({ student: { connect: { id: studentId } }, label: f.get('label'), takenOn: new Date(`${f.get('takenOn')}T12:00:00`).toISOString(), score: Number(f.get('score')), outOf: Number(f.get('outOf')), note: f.get('note') })}>
      <Field label="Test"><input name="label" required placeholder="Unit 3 test" className={inputClass} /></Field>
      <Field label="Date"><input name="takenOn" type="date" required className={inputClass} /></Field>
      <Field label="Score"><input name="score" type="number" min="0" required className={inputClass} /></Field>
      <Field label="Out of"><input name="outOf" type="number" min="1" defaultValue="100" required className={inputClass} /></Field>
      <Field label="Note"><input name="note" className={inputClass} /></Field>
    </ItemForm>
  )
}
