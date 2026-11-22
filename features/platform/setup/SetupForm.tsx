'use client'

import { useRouter } from 'next/navigation'
import { ActionForm } from '../lib/actions'
import { Field, inputClass } from '../lib/ui'

const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Toronto', 'Europe/London', 'Europe/Dublin', 'Europe/Berlin', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Africa/Nairobi', 'Africa/Lagos', 'Australia/Sydney']

/** P1: first-run setup (W1, §8). */
export function SetupForm({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const browserZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York'
  return (
    <ActionForm
      op="setUpMyBusiness"
      submit="Set up my business"
      className="grid max-w-2xl gap-4 sm:grid-cols-2"
      after={() => router.push('/dashboard/platform/today')}
      toVars={(f) => ({
        businessName: String(f.get('businessName') || ''), tutorName: String(f.get('tutorName') || ''), slug: String(f.get('slug') || '').toLowerCase(),
        timezone: String(f.get('timezone') || ''), currencyCode: String(f.get('currencyCode') || 'USD'), country: String(f.get('country') || ''),
        subjects: String(f.get('subjects') || '').split(',').map((s) => s.trim()).filter(Boolean), levels: String(f.get('levels') || ''),
        teachesOnline: f.get('mode') !== 'in_person', teachesInPerson: f.get('mode') !== 'online', email,
        hourlyRateCents: Math.round(Number(f.get('rate') || 60) * 100), typicalSetup: f.get('typical') === 'on',
      })}
    >
      <Field label="Your name"><input name="tutorName" defaultValue={name} className={inputClass} /></Field>
      <Field label="Business name"><input name="businessName" required placeholder={`${name || 'Your name'} Tutoring`} className={inputClass} /></Field>
      <Field label="Page address" hint="Families open /t/<this>. Lowercase letters, numbers and hyphens."><input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,40}" placeholder="jane-smith" className={inputClass} /></Field>
      <Field label="Country (two letters)"><input name="country" maxLength={2} placeholder="US" className={inputClass} /></Field>
      <Field label="Timezone">
        <select name="timezone" defaultValue={ZONES.includes(browserZone) ? browserZone : 'America/New_York'} className={inputClass}>
          {[...new Set([browserZone, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <Field label="Currency"><input name="currencyCode" defaultValue="USD" maxLength={3} className={inputClass} /></Field>
      <Field label="Subjects you teach" hint="Separate with commas."><input name="subjects" placeholder="Maths, Physics, SAT maths" className={inputClass} /></Field>
      <Field label="Levels"><input name="levels" placeholder="Grades 6 to 12" className={inputClass} /></Field>
      <Field label="Where you teach">
        <select name="mode" defaultValue="online" className={inputClass}><option value="online">Online</option><option value="in_person">In person</option><option value="both">Both</option></select>
      </Field>
      <Field label="Your hourly rate" hint="Used to price the starting lessons and packages. You can change every price later."><input name="rate" type="number" min="0" step="1" defaultValue="60" className={inputClass} /></Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="typical" defaultChecked className="mt-1 size-4" /><span><b>Start with a typical setup</b>: a free 20-minute consultation, a first lesson, 60 and 90-minute lessons and an exam review session; 5, 10 and 20-hour packages; Monday to Thursday 3 to 8 pm and Saturday 9 am to 1 pm; a 24-hour cancellation policy.</span></label>
    </ActionForm>
  )
}
