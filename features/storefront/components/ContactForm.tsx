'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MyFamily } from '../lib/types'
import { updateMyContact } from '../lib/data/account'
import { Button, Field, Notice, inputClass } from './ui'

function zones(current: string) {
  let list: string[] = []
  try { list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [] } catch { list = [] }
  if (!list.includes(current)) list = [current, ...list]
  return list
}

/** S20: contact details and the timezone every time is shown in. */
export function ContactForm({ family, tutorTimezone }: { family: MyFamily['family']; tutorTimezone: string }) {
  const router = useRouter()
  const current = family.timezone || tutorTimezone
  const options = useMemo(() => zones(current), [current])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null); setSaved(false)
      start(async () => {
        const r = await updateMyContact({
          guardianName: String(f.get('guardianName') || '').trim(),
          phone: String(f.get('phone') || '').trim(),
          secondContactName: String(f.get('secondContactName') || '').trim(),
          secondContactPhone: String(f.get('secondContactPhone') || '').trim(),
          address: String(f.get('address') || '').trim(),
          timezone: String(f.get('timezone') || ''),
        })
        if (!r.success) { setError(r.error); return }
        setSaved(true)
        router.refresh()
      })
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><input name="guardianName" required maxLength={120} defaultValue={family.guardianName} autoComplete="name" className={inputClass} /></Field>
        <Field label="Phone"><input name="phone" type="tel" maxLength={40} defaultValue={family.phone ?? ''} autoComplete="tel" className={inputClass} /></Field>
        <Field label="Second contact"><input name="secondContactName" maxLength={120} defaultValue={family.secondContactName ?? ''} className={inputClass} /></Field>
        <Field label="Second contact’s phone"><input name="secondContactPhone" type="tel" maxLength={40} defaultValue={family.secondContactPhone ?? ''} className={inputClass} /></Field>
      </div>
      <Field label="Address" hint="Only needed for lessons at your home."><textarea name="address" rows={2} maxLength={500} defaultValue={family.address ?? ''} autoComplete="street-address" className={`${inputClass} py-3`} /></Field>
      <Field label="Timezone" hint="Every lesson time on this site and in emails is shown in this timezone.">
        <select name="timezone" defaultValue={current} className={inputClass}>
          {options.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </select>
      </Field>
      <p className="text-[14px] text-ink-soft">Sign-in email: <span className="font-semibold text-ink">{family.email || 'none'}</span>. Ask your tutor to change it.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved ? <Notice tone="success">Saved.</Notice> : null}
      <div><Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button></div>
    </form>
  )
}
