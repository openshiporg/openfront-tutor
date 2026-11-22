'use client'

import { useState } from 'react'
import { ActionButton, ActionForm } from '../lib/actions'
import { Btn, Field, inputClass, textareaClass } from '../lib/ui'

type Student = { id: string; firstName: string }

/** P3: complete with the note and homework in one form; P4 no-show; P5 cancel. */
export function SessionControls({ id, students, canComplete, canNoShow, canCancel, compact }: { id: string; students: Student[]; canComplete: boolean; canNoShow: boolean; canCancel: boolean; compact?: boolean }) {
  const [open, setOpen] = useState<'complete' | 'cancel' | null>(null)
  const [hw, setHw] = useState(1)
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {canComplete ? <Btn variant="primary" onClick={() => setOpen(open === 'complete' ? null : 'complete')} aria-expanded={open === 'complete'}>Complete</Btn> : null}
        {canNoShow ? <ActionButton op="markNoShow" vars={{ sessionId: id }} label="No-show" confirm="Mark as a no-show? Your no-show policy charge applies." /> : null}
        {canCancel ? <Btn variant="danger" onClick={() => setOpen(open === 'cancel' ? null : 'cancel')}>Cancel</Btn> : null}
        {compact ? <a className="inline-flex h-11 items-center px-2 text-sm underline md:h-10" href={`/dashboard/platform/sessions/${id}`}>Open</a> : null}
      </div>
      {open === 'complete' ? (
        <ActionForm
          op="completeSession"
          submit="Save and share"
          className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
          toVars={(f) => ({
            sessionId: id,
            share: f.get('share') === 'on',
            note: { covered: f.get('covered'), wentWell: f.get('wentWell'), workOnNext: f.get('workOnNext'), effort: f.get('effort') ? Number(f.get('effort')) : null, privateNote: f.get('privateNote') },
            homework: Array.from({ length: hw }, (_, i) => ({ title: String(f.get(`hw${i}title`) || ''), instructions: String(f.get(`hw${i}instructions`) || ''), dueAt: f.get(`hw${i}due`) ? new Date(`${f.get(`hw${i}due`)}T23:00:00`).toISOString() : null, linkUrl: String(f.get(`hw${i}link`) || ''), studentId: String(f.get(`hw${i}student`) || '') || null })).filter((h) => h.title),
          })}
        >
          <Field label="What we covered"><textarea name="covered" className={textareaClass} /></Field>
          <Field label="What went well"><textarea name="wentWell" className={textareaClass} /></Field>
          <Field label="What to work on next"><textarea name="workOnNext" className={textareaClass} /></Field>
          <Field label="Private note" hint="Only you see this."><textarea name="privateNote" className={textareaClass} /></Field>
          <Field label="Effort (optional)"><select name="effort" className={inputClass} defaultValue=""><option value="">Not recorded</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="share" defaultChecked className="size-4" /> Share the note with the family</label>
          {Array.from({ length: hw }, (_, i) => (
            <fieldset key={i} className="grid gap-2 rounded-md border p-3 sm:col-span-2 sm:grid-cols-2">
              <legend className="px-1 text-sm font-medium">Homework {i + 1}</legend>
              <Field label="Title"><input name={`hw${i}title`} className={inputClass} /></Field>
              <Field label="Due"><input name={`hw${i}due`} type="date" className={inputClass} /></Field>
              <Field label="Instructions"><textarea name={`hw${i}instructions`} className={textareaClass} /></Field>
              <Field label="Link (optional)"><input name={`hw${i}link`} type="url" placeholder="https://" className={inputClass} /></Field>
              {students.length > 1 ? <Field label="For"><select name={`hw${i}student`} className={inputClass}><option value="">Every student in the session</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}</select></Field> : null}
            </fieldset>
          ))}
          <div className="sm:col-span-2"><Btn onClick={() => setHw(hw + 1)}>Add homework</Btn></div>
        </ActionForm>
      ) : null}
      {open === 'cancel' ? (
        <ActionForm op="cancelSessionAsTutor" submit="Cancel the session" className="grid gap-3 rounded-md border p-3" toVars={(f) => ({ sessionId: id, reason: f.get('reason'), notify: f.get('notify') === 'on' })} done={(d) => d?.refundedCents ? 'Cancelled; the card payment was refunded.' : 'Cancelled. The family is not charged.'}>
          <Field label="Reason (shown to the family)"><input name="reason" className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="size-4" /> Email the family</label>
        </ActionForm>
      ) : null}
    </div>
  )
}
