'use client'

import { ActionForm } from '../lib/actions'
import { zonedToIso } from '../lib/time'
import { Field, inputClass } from '../lib/ui'


export function zonedParts(iso: string, timeZone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

/** P5: move a session to any time that does not clash (the tutor is not held to weekly hours). */
export function MoveSession({ id, startsAt, timezone }: { id: string; startsAt: string; timezone: string }) {
  const cur = zonedParts(startsAt, timezone)
  return (
    <ActionForm op="rescheduleSessionAsTutor" submit="Move the session" className="grid gap-3 rounded-md border p-3 sm:grid-cols-3" toVars={(f) => ({ sessionId: id, startsAt: zonedToIso(String(f.get('date')), String(f.get('time')), timezone), notify: f.get('notify') === 'on' })} done={() => 'Moved. The family was told.'}>
      <Field label="New date"><input name="date" type="date" required defaultValue={cur.date} className={inputClass} /></Field>
      <Field label={`Time (${timezone})`}><input name="time" type="time" required defaultValue={cur.time} step={300} className={inputClass} /></Field>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="notify" defaultChecked className="size-4" /> Email the family</label>
    </ActionForm>
  )
}
