'use client'

import { useState } from 'react'
import { ActionForm } from '../lib/actions'
import { Field, inputClass } from '../lib/ui'

type Fam = { id: string; guardianName: string; students: Array<{ id: string; firstName: string }> }

export function SeriesForm({ families, types }: { families: Fam[]; types: Array<{ id: string; name: string; durationMinutes: number }> }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')
  const fam = families.find((f) => f.id === familyId)
  return (
    <ActionForm op="saveSeries" submit="Create series" className="grid gap-3 sm:grid-cols-2" done={(d) => `Created ${d?.created ?? 0} sessions${d?.skipped?.length ? `; ${d.skipped.length} weeks need a time` : ''}.`}
      toVars={(f) => { const [h, m] = String(f.get('time') || '16:00').split(':').map(Number); return { familyId, sessionTypeId: f.get('type'), studentIds: f.getAll('student').map(String), dayOfWeek: Number(f.get('day')), startMinute: h * 60 + m, startsOn: f.get('startsOn'), endsOn: f.get('endsOn') || null, mode: f.get('mode') || null } }}>
      <Field label="Family"><select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={inputClass}>{families.map((f) => <option key={f.id} value={f.id}>{f.guardianName}</option>)}</select></Field>
      <Field label="Session type"><select name="type" className={inputClass}>{types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.durationMinutes} min)</option>)}</select></Field>
      <Field label="Day"><select name="day" defaultValue="1" className={inputClass}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
      <Field label="Time (your timezone)"><input name="time" type="time" defaultValue="16:00" step={300} required className={inputClass} /></Field>
      <Field label="From"><input name="startsOn" type="date" required className={inputClass} /></Field>
      <Field label="To (optional)"><input name="endsOn" type="date" className={inputClass} /></Field>
      <Field label="Where"><select name="mode" className={inputClass} defaultValue=""><option value="">As the session type says</option><option value="online">Online</option><option value="in_person">In person</option></select></Field>
      <fieldset className="grid gap-1 text-sm"><legend className="font-medium">Students</legend>{fam?.students.map((s, i) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="student" value={s.id} defaultChecked={i === 0} className="size-4" />{s.firstName}</label>)}</fieldset>
    </ActionForm>
  )
}
