'use client'

import { useState } from 'react'
import { ActionForm, ItemForm } from '../lib/actions'
import { Field, inputClass } from '../lib/ui'
import { zonedToIso } from '../lib/time'

type Fam = { id: string; guardianName: string; students: Array<{ id: string; firstName: string }> }
type Type = { id: string; name: string; durationMinutes: number; mode: string }

/** P10: a session by hand for any family, at any time that does not clash. */
export function AddSessionForm({ families, types, timezone, defaultDate }: { families: Fam[]; types: Type[]; timezone: string; defaultDate: string }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const fam = families.find((f) => f.id === familyId)
  return (
    <ActionForm op="createSessionAsTutor" submit="Add session" className="grid gap-3 sm:grid-cols-2" done={(d) => `Added (${String(d?.funding ?? '').replace('_', ' ')}).`}
      toVars={(f) => ({ familyId, sessionTypeId: f.get('type'), startsAt: zonedToIso(String(f.get('date')), String(f.get('time')), timezone), studentIds: f.getAll('student').map(String), mode: f.get('mode') || null, notify: f.get('notify') === 'on' })}>
      <Field label="Family"><select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={inputClass}>{families.map((f) => <option key={f.id} value={f.id}>{f.guardianName}</option>)}</select></Field>
      <Field label="Session type"><select name="type" className={inputClass}>{types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.durationMinutes} min)</option>)}</select></Field>
      <Field label="Date"><input name="date" type="date" required defaultValue={defaultDate} className={inputClass} /></Field>
      <Field label={`Time (${timezone})`}><input name="time" type="time" required defaultValue="16:00" step={300} className={inputClass} /></Field>
      <fieldset className="grid gap-1 text-sm sm:col-span-2"><legend className="font-medium">Students</legend>
        {fam?.students.length ? fam.students.map((s, i) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="student" value={s.id} defaultChecked={i === 0} className="size-4" />{s.firstName}</label>) : <span className="text-muted-foreground">This family has no active students. Add one on the family page.</span>}
      </fieldset>
      <Field label="Where"><select name="mode" className={inputClass} defaultValue=""><option value="">As the session type says</option><option value="online">Online</option><option value="in_person">In person</option></select></Field>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="notify" defaultChecked className="size-4" /> Email the family</label>
    </ActionForm>
  )
}

/** P12: time off. Open slots vanish at once; booked sessions inside it are listed on the calendar. */
export function TimeOffForm({ timezone }: { timezone: string }) {
  return (
    <ItemForm list="TimeOff" submit="Add time off" className="grid gap-3 sm:grid-cols-2" resetOnDone toData={(f) => {
      const startsAt = zonedToIso(String(f.get('from')), String(f.get('fromTime') || '00:00'), timezone)
      const endsAt = zonedToIso(String(f.get('to')), String(f.get('toTime') || '23:59'), timezone)
      if (endsAt <= startsAt) throw new Error('Time off must end after it starts.')
      return { startsAt, endsAt, reason: String(f.get('reason') || '') }
    }}>
      <Field label="From"><input name="from" type="date" required className={inputClass} /></Field>
      <Field label="From time"><input name="fromTime" type="time" defaultValue="00:00" className={inputClass} /></Field>
      <Field label="To"><input name="to" type="date" required className={inputClass} /></Field>
      <Field label="To time"><input name="toTime" type="time" defaultValue="23:59" className={inputClass} /></Field>
      <Field label="Reason (only you see it)"><input name="reason" className={inputClass} /></Field>
    </ItemForm>
  )
}
