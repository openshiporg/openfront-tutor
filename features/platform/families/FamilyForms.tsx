'use client'

import { useRouter } from 'next/navigation'
import { ActionForm, ItemForm } from '../lib/actions'
import { saveItem } from '../lib/request'
import { Btn, Field, Notice, inputClass, textareaClass } from '../lib/ui'
import { useState, useTransition } from 'react'

const cents = (v: FormDataEntryValue | null) => Math.round(Number(v || 0) * 100)

export function NewFamilyForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null)
      start(async () => {
        const r = await saveItem('Family', null, { guardianName: f.get('guardianName'), email: String(f.get('email') || '').toLowerCase(), phone: f.get('phone'), status: 'active', billingMode: f.get('billingMode') })
        if (!r.success) { setError(r.error); return }
        router.push(`/dashboard/platform/families/${(r.data as { id: string }).id}`)
      })
    }}>
      <Field label="Parent or adult student"><input name="guardianName" required className={inputClass} /></Field>
      <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
      <Field label="Phone"><input name="phone" className={inputClass} /></Field>
      <Field label="Billing"><select name="billingMode" className={inputClass} defaultValue="pay_as_you_book"><option value="pay_as_you_book">Pays as they book</option><option value="invoice">Invoiced later</option><option value="flat_monthly">Flat monthly fee</option></select></Field>
      <div className="sm:col-span-2"><Btn type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : 'Add family'}</Btn></div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </form>
  )
}

/** P15/P17: contacts, billing mode, monthly fee, status, private notes. */
export function FamilyDetailsForm({ f }: { f: any }) {
  return (
    <ItemForm list="Family" id={f.id} submit="Save" className="grid gap-3 sm:grid-cols-2" toData={(x) => ({
      guardianName: x.get('guardianName'), email: String(x.get('email') || '').toLowerCase(), phone: x.get('phone'), secondContactName: x.get('secondContactName'), secondContactPhone: x.get('secondContactPhone'),
      address: x.get('address'), timezone: x.get('timezone'), status: x.get('status'), billingMode: x.get('billingMode'), monthlyFeeCents: cents(x.get('monthlyFee')), howTheyFoundMe: x.get('howTheyFoundMe'), privateNotes: x.get('privateNotes'),
    })}>
      <Field label="Name"><input name="guardianName" defaultValue={f.guardianName} required className={inputClass} /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={f.email} className={inputClass} /></Field>
      <Field label="Phone"><input name="phone" defaultValue={f.phone} className={inputClass} /></Field>
      <Field label="Timezone" hint="Leave empty to use yours."><input name="timezone" defaultValue={f.timezone} placeholder="America/Chicago" className={inputClass} /></Field>
      <Field label="Second contact"><input name="secondContactName" defaultValue={f.secondContactName} className={inputClass} /></Field>
      <Field label="Second contact phone"><input name="secondContactPhone" defaultValue={f.secondContactPhone} className={inputClass} /></Field>
      <Field label="Status" hint="Blocked families cannot book online."><select name="status" defaultValue={f.status} className={inputClass}>{['lead', 'active', 'paused', 'former', 'blocked'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></Field>
      <Field label="Billing"><select name="billingMode" defaultValue={f.billingMode} className={inputClass}><option value="pay_as_you_book">Pays as they book</option><option value="invoice">Invoiced later</option><option value="flat_monthly">Flat monthly fee</option></select></Field>
      <Field label="Monthly fee (flat monthly only)"><input name="monthlyFee" type="number" min="0" step="0.01" defaultValue={(f.monthlyFeeCents / 100).toFixed(2)} className={inputClass} /></Field>
      <Field label="How they found you"><input name="howTheyFoundMe" defaultValue={f.howTheyFoundMe} className={inputClass} /></Field>
      <Field label="Address (for in-person lessons)"><textarea name="address" defaultValue={f.address} className={textareaClass} /></Field>
      <Field label="Private notes" hint="Only you see this."><textarea name="privateNotes" defaultValue={f.privateNotes} className={textareaClass} /></Field>
    </ItemForm>
  )
}

/** P18 on the family page: add or edit a student, including `needs` (tutor only). */
export function StudentForm({ familyId, s, subjects }: { familyId: string; s?: any; subjects: Array<{ id: string; name: string }> }) {
  return (
    <ActionForm op="saveStudentAsTutor" submit={s ? 'Save student' : 'Add student'} resetOnDone={!s} className="grid gap-3 sm:grid-cols-2" toVars={(x) => ({ student: {
      id: s?.id ?? null, familyId, firstName: x.get('firstName'), lastName: x.get('lastName'), level: x.get('level'), school: x.get('school'), goals: x.get('goals'), needs: x.get('needs'), meetingUrl: x.get('meetingUrl'),
      birthYear: x.get('birthYear') ? Number(x.get('birthYear')) : null, status: x.get('status') || 'active', subjectIds: x.getAll('subject').map(String),
    } })}>
      <Field label="First name"><input name="firstName" defaultValue={s?.firstName} required className={inputClass} /></Field>
      <Field label="Last name"><input name="lastName" defaultValue={s?.lastName} className={inputClass} /></Field>
      <Field label="Level"><input name="level" defaultValue={s?.level} placeholder="Grade 10" className={inputClass} /></Field>
      <Field label="School"><input name="school" defaultValue={s?.school} className={inputClass} /></Field>
      <Field label="Goals"><textarea name="goals" defaultValue={s?.goals} className={textareaClass} /></Field>
      <Field label="What to watch for" hint="Only you see this."><textarea name="needs" defaultValue={s?.needs} className={textareaClass} /></Field>
      <Field label="Lesson link for this student" hint="Overrides your default link."><input name="meetingUrl" type="url" defaultValue={s?.meetingUrl} className={inputClass} /></Field>
      <Field label="Birth year (optional)"><input name="birthYear" type="number" defaultValue={s?.birthYear ?? ''} className={inputClass} /></Field>
      <Field label="Status"><select name="status" defaultValue={s?.status ?? 'active'} className={inputClass}><option value="active">Active</option><option value="paused">Paused</option><option value="finished">Finished</option></select></Field>
      <fieldset className="grid gap-1 text-sm"><legend className="font-medium">Subjects</legend>{subjects.map((x) => <label key={x.id} className="flex items-center gap-2"><input type="checkbox" name="subject" value={x.id} defaultChecked={s?.subjects?.some((y: any) => y.id === x.id)} className="size-4" />{x.name}</label>)}</fieldset>
    </ActionForm>
  )
}
