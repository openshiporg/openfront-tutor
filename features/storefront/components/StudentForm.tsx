'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyStudent } from '../lib/types'
import { saveStudent } from '../lib/data/account'
import { Button, Field, Notice, inputClass } from './ui'

/** S12: add a student or edit one. */
export function StudentForm({ student, onDone }: { student?: FamilyStudent; onDone?: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      const year = String(f.get('birthYear') || '').trim()
      setError(null); setSaved(false)
      start(async () => {
        const r = await saveStudent({
          ...(student ? { id: student.id } : {}),
          firstName: String(f.get('firstName') || '').trim(),
          lastName: String(f.get('lastName') || '').trim(),
          level: String(f.get('level') || '').trim(),
          school: String(f.get('school') || '').trim(),
          goals: String(f.get('goals') || '').trim(),
          birthYear: year ? Number(year) : null,
        })
        if (!r.success) { setError(r.error); return }
        setSaved(true)
        if (!student) (e.target as HTMLFormElement).reset()
        router.refresh()
        onDone?.()
      })
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name"><input name="firstName" required maxLength={80} defaultValue={student?.firstName ?? ''} className={inputClass} /></Field>
        <Field label="Last name"><input name="lastName" maxLength={80} defaultValue={student?.lastName ?? ''} className={inputClass} /></Field>
        <Field label="Grade or level"><input name="level" maxLength={80} defaultValue={student?.level ?? ''} className={inputClass} /></Field>
        <Field label="School"><input name="school" maxLength={120} defaultValue={student?.school ?? ''} className={inputClass} /></Field>
        <Field label="Birth year"><input name="birthYear" inputMode="numeric" pattern="\d{4}" maxLength={4} defaultValue={student?.birthYear ?? ''} className={inputClass} /></Field>
      </div>
      <Field label="Goals" hint="What would you like the lessons to help with?"><textarea name="goals" rows={3} maxLength={2000} defaultValue={student?.goals ?? ''} className={`${inputClass} py-3`} /></Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">{student ? 'Saved.' : 'Student added.'}</Notice> : null}
      <div><Button type="submit" disabled={pending}>{pending ? 'Saving…' : student ? 'Save changes' : 'Add student'}</Button></div>
    </form>
  )
}
