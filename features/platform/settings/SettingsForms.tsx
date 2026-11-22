'use client'

import { ItemForm, DeleteItemButton } from '../lib/actions'
import { Field, inputClass, textareaClass } from '../lib/ui'
import { toCents } from '../earnings/EarningsForms'

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const int = (f: FormData, k: string) => {
  const n = Number(f.get(k))
  if (!Number.isInteger(n)) throw new Error('Use whole numbers.')
  return n
}
const on = (f: FormData, k: string) => f.get(k) === 'on'
const Check = ({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) => (
  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4" />{label}</label>
)

/** P39 business details and page text, P43 default lesson link. */
export function BusinessForm({ p }: { p: any }) {
  return (
    <ItemForm list="TutorProfile" id={p.id} submit="Save" className="grid gap-3 sm:grid-cols-2" toData={(f) => ({
      businessName: str(f, 'businessName'), tutorName: str(f, 'tutorName'), slug: str(f, 'slug').toLowerCase(), headline: str(f, 'headline'), bio: str(f, 'bio'), qualifications: str(f, 'qualifications'),
      photoUrl: str(f, 'photoUrl'), heroImageUrl: str(f, 'heroImageUrl'), phone: str(f, 'phone'), email: str(f, 'email'), city: str(f, 'city'), country: str(f, 'country').toUpperCase(), timezone: str(f, 'timezone'),
      teachesOnline: on(f, 'teachesOnline'), teachesInPerson: on(f, 'teachesInPerson'), inPersonArea: str(f, 'inPersonArea'), defaultMeetingUrl: str(f, 'defaultMeetingUrl'), bookingOpen: on(f, 'bookingOpen'), reviewsEnabled: on(f, 'reviewsEnabled'),
    })}>
      <Field label="Business name"><input name="businessName" required defaultValue={p.businessName} className={inputClass} /></Field>
      <Field label="Your name"><input name="tutorName" defaultValue={p.tutorName} className={inputClass} /></Field>
      <Field label="Page address" hint="Your page is /t/ followed by this."><input name="slug" required defaultValue={p.slug} pattern="[a-z0-9][a-z0-9-]{1,40}" className={inputClass} /></Field>
      <Field label="Headline"><input name="headline" defaultValue={p.headline} placeholder="Maths and physics, grades 8 to 12" className={inputClass} /></Field>
      <div className="sm:col-span-2"><Field label="About you"><textarea name="bio" defaultValue={p.bio} className={textareaClass} /></Field></div>
      <div className="sm:col-span-2"><Field label="Qualifications"><textarea name="qualifications" defaultValue={p.qualifications} className={textareaClass} /></Field></div>
      <Field label="Photo address" hint="https://… or /storefront/…"><input name="photoUrl" defaultValue={p.photoUrl} className={inputClass} /></Field>
      <Field label="Page header picture"><input name="heroImageUrl" defaultValue={p.heroImageUrl} className={inputClass} /></Field>
      <Field label="Phone"><input name="phone" type="tel" defaultValue={p.phone} className={inputClass} /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={p.email} className={inputClass} /></Field>
      <Field label="City"><input name="city" defaultValue={p.city} className={inputClass} /></Field>
      <Field label="Country" hint="Two letters, e.g. US, PK, GB."><input name="country" maxLength={2} defaultValue={p.country} className={inputClass} /></Field>
      <Field label="Timezone" hint="e.g. America/Chicago, Asia/Karachi"><input name="timezone" required defaultValue={p.timezone} className={inputClass} /></Field>
      <Field label="Lesson link (default)" hint="Zoom, Google Meet, Teams… Students and sessions can override it."><input name="defaultMeetingUrl" type="url" defaultValue={p.defaultMeetingUrl} className={inputClass} /></Field>
      <Field label="In-person area"><input name="inPersonArea" defaultValue={p.inPersonArea} className={inputClass} /></Field>
      <div className="grid sm:col-span-2 sm:grid-cols-2">
        <Check name="teachesOnline" label="I teach online" defaultChecked={p.teachesOnline} />
        <Check name="teachesInPerson" label="I teach in person" defaultChecked={p.teachesInPerson} />
        <Check name="bookingOpen" label="Families can book from my page" defaultChecked={p.bookingOpen} />
        <Check name="reviewsEnabled" label="Show reviews on my page" defaultChecked={p.reviewsEnabled} />
      </div>
    </ItemForm>
  )
}

/** P40 booking rules and P41 policies. */
export function BookingRulesForm({ p }: { p: any }) {
  const n = (name: string, l: string, hint?: string) => <Field label={l} hint={hint}><input name={name} type="number" required defaultValue={p[name]} className={inputClass} /></Field>
  return (
    <ItemForm list="TutorProfile" id={p.id} submit="Save" className="grid gap-3 sm:grid-cols-2" toData={(f) => ({
      slotMinutes: int(f, 'slotMinutes'), bufferMinutes: int(f, 'bufferMinutes'), minNoticeHours: int(f, 'minNoticeHours'), maxAdvanceDays: int(f, 'maxAdvanceDays'),
      unpaidHoldMinutes: int(f, 'unpaidHoldMinutes'), reschedulesAllowed: int(f, 'reschedulesAllowed'), cancellationWindowHours: int(f, 'cancellationWindowHours'),
      lateCancelPercent: int(f, 'lateCancelPercent'), noShowPercent: int(f, 'noShowPercent'), policiesText: str(f, 'policiesText'),
    })}>
      {n('slotMinutes', 'Start times every (minutes)', '30 means 3:00, 3:30, 4:00…')}
      {n('bufferMinutes', 'Gap between sessions (minutes)')}
      {n('minNoticeHours', 'Least notice for a booking (hours)')}
      {n('maxAdvanceDays', 'Furthest ahead families can book (days)')}
      {n('unpaidHoldMinutes', 'Time held while a card payment is made (minutes)', '30 to 1440')}
      {n('reschedulesAllowed', 'Moves a family may make per session')}
      {n('cancellationWindowHours', 'Cancellation window (hours before)', 'Inside it, a family cancel is a late cancel.')}
      {n('lateCancelPercent', 'Late cancel charge (%)')}
      {n('noShowPercent', 'No-show charge (%)')}
      <div className="sm:col-span-2"><Field label="Policy text on your page"><textarea name="policiesText" defaultValue={p.policiesText} className={textareaClass} /></Field></div>
    </ItemForm>
  )
}

/** P42 the tutor's own payment settings. */
export function PaymentSettingsForm({ p }: { p: any }) {
  return (
    <ItemForm list="TutorProfile" id={p.id} submit="Save" className="grid gap-3 sm:grid-cols-2" toData={(f) => ({ paymentInstructions: str(f, 'paymentInstructions'), invoiceDueDays: int(f, 'invoiceDueDays'), currencyCode: str(f, 'currencyCode').toUpperCase() })}>
      <div className="sm:col-span-2"><Field label="How families pay you directly" hint="Bank details, Zelle, JazzCash, M-Pesa… Shown to your families on bookings and invoices."><textarea name="paymentInstructions" defaultValue={p.paymentInstructions} className={textareaClass} /></Field></div>
      <Field label="Invoices due after (days)"><input name="invoiceDueDays" type="number" min={0} max={90} required defaultValue={p.invoiceDueDays} className={inputClass} /></Field>
      <Field label="Currency" hint="Three letters, e.g. USD. Changing it does not convert past amounts."><input name="currencyCode" required maxLength={3} defaultValue={p.currencyCode} className={inputClass} /></Field>
    </ItemForm>
  )
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const hm = (m: number | null | undefined) => m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const mins = (v: string) => { if (!v) return null; const [h, m] = v.split(':').map(Number); return h * 60 + m }

/** P13: one day of weekly hours (one break). */
export function HoursRow({ day, row }: { day: string; row: any | null }) {
  return (
    <ItemForm list="WeeklyHours" id={row?.id ?? null} submit={row ? 'Save' : 'Add'} className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[7rem_auto_1fr_1fr_1fr_1fr]" toData={(f) => {
      const start = mins(str(f, 'start')); const end = mins(str(f, 'end'))
      const bs = mins(str(f, 'bs')); const be = mins(str(f, 'be'))
      if (start == null || end == null || end <= start) throw new Error('End must be after start.')
      if ((bs == null) !== (be == null) || (bs != null && be != null && (be <= bs || bs < start || be > end))) throw new Error('A break needs a start and end inside the day.')
      return { ...(row ? {} : { dayOfWeek: day }), isWorking: on(f, 'isWorking'), startMinute: start, endMinute: end, breakStartMinute: bs, breakEndMinute: be }
    }}>
      <span className="font-medium capitalize">{day}</span>
      <Check name="isWorking" label="Working" defaultChecked={row ? row.isWorking : true} />
      <Field label="From"><input name="start" type="time" step={300} required defaultValue={hm(row?.startMinute ?? 900)} className={inputClass} /></Field>
      <Field label="To"><input name="end" type="time" step={300} required defaultValue={hm(row?.endMinute ?? 1200)} className={inputClass} /></Field>
      <Field label="Break from"><input name="bs" type="time" step={300} defaultValue={hm(row?.breakStartMinute)} className={inputClass} /></Field>
      <Field label="Break to"><input name="be" type="time" step={300} defaultValue={hm(row?.breakEndMinute)} className={inputClass} /></Field>
    </ItemForm>
  )
}
export { DAYS }

/** P23: a session type. */
export function SessionTypeForm({ t, subjects, currency }: { t?: any; subjects: any[]; currency: string }) {
  const chosen = new Set((t?.subjects ?? []).map((s: any) => s.id))
  return (
    <ItemForm list="SessionType" id={t?.id ?? null} submit={t ? 'Save' : 'Add session type'} resetOnDone={!t} className="grid gap-3 sm:grid-cols-3" toData={(f) => {
      const ids = f.getAll('subject').map(String)
      return {
        name: str(f, 'name'), description: str(f, 'description'), durationMinutes: int(f, 'durationMinutes'), priceCents: toCents(f.get('price')), mode: str(f, 'mode'),
        maxStudents: int(f, 'maxStudents'), openToNewFamilies: on(f, 'openToNewFamilies'), active: on(f, 'active'), sortOrder: int(f, 'sortOrder'),
        subjects: t ? { set: ids.map((id) => ({ id })) } : { connect: ids.map((id) => ({ id })) },
      }
    }}>
      <Field label="Name"><input name="name" required defaultValue={t?.name} className={inputClass} /></Field>
      <Field label="Length (minutes)"><input name="durationMinutes" type="number" min={10} max={480} required defaultValue={t?.durationMinutes ?? 60} className={inputClass} /></Field>
      <Field label={`Price (${currency})`} hint="0 is free."><input name="price" inputMode="decimal" required defaultValue={t ? (t.priceCents / 100).toFixed(2) : ''} className={inputClass} /></Field>
      <Field label="Where"><select name="mode" defaultValue={t?.mode ?? 'online'} className={inputClass}><option value="online">Online</option><option value="in_person">In person</option><option value="either">Either</option></select></Field>
      <Field label="Students in one session" hint="Siblings, 1 to 4."><input name="maxStudents" type="number" min={1} max={4} required defaultValue={t?.maxStudents ?? 1} className={inputClass} /></Field>
      <Field label="Order"><input name="sortOrder" type="number" defaultValue={t?.sortOrder ?? 0} className={inputClass} /></Field>
      <div className="sm:col-span-3"><Field label="Description"><textarea name="description" defaultValue={t?.description} className={textareaClass} /></Field></div>
      {subjects.length ? <fieldset className="flex flex-wrap gap-x-4 text-sm sm:col-span-3"><legend className="font-medium">Subjects</legend>{subjects.map((s) => <Check key={s.id} name="subject" label={s.name} defaultChecked={chosen.has(s.id)} />)}</fieldset> : null}
      <div className="flex flex-wrap gap-x-4 sm:col-span-3"><Check name="openToNewFamilies" label="New families can book it" defaultChecked={t?.openToNewFamilies ?? false} /><Check name="active" label="Offered" defaultChecked={t?.active ?? true} /></div>
    </ItemForm>
  )
}

/** P24: a subject and its levels. */
export function SubjectForm({ s }: { s?: any }) {
  return (
    <span className="grid gap-2">
      <ItemForm list="Subject" id={s?.id ?? null} submit={s ? 'Save' : 'Add subject'} resetOnDone={!s} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]" toData={(f) => ({ name: str(f, 'name'), levels: str(f, 'levels'), sortOrder: int(f, 'sortOrder'), active: on(f, 'active') })}>
        <Field label="Subject"><input name="name" required defaultValue={s?.name} className={inputClass} /></Field>
        <Field label="Levels"><input name="levels" defaultValue={s?.levels} placeholder="Grades 6 to 12" className={inputClass} /></Field>
        <Field label="Order"><input name="sortOrder" type="number" defaultValue={s?.sortOrder ?? 0} className={inputClass} /></Field>
        <Check name="active" label="Shown" defaultChecked={s?.active ?? true} />
      </ItemForm>
      {s ? <span><DeleteItemButton list="Subject" id={s.id} confirm={`Remove ${s.name}?`} /></span> : null}
    </span>
  )
}

/** P25: a package of prepaid minutes. */
export function PackageForm({ pk, types, currency }: { pk?: any; types: any[]; currency: string }) {
  const chosen = new Set((pk?.appliesTo ?? []).map((t: any) => t.id))
  return (
    <ItemForm list="Package" id={pk?.id ?? null} submit={pk ? 'Save' : 'Add package'} resetOnDone={!pk} className="grid gap-3 sm:grid-cols-3" toData={(f) => {
      const hours = Number(f.get('hours'))
      if (!Number.isFinite(hours) || hours <= 0) throw new Error('Enter the hours, e.g. 10 or 7.5.')
      const ids = f.getAll('type').map(String)
      return {
        name: str(f, 'name'), description: str(f, 'description'), minutes: Math.round(hours * 60), priceCents: toCents(f.get('price')), validMonths: int(f, 'validMonths'), active: on(f, 'active'), sortOrder: int(f, 'sortOrder'),
        appliesTo: pk ? { set: ids.map((id) => ({ id })) } : { connect: ids.map((id) => ({ id })) },
      }
    }}>
      <Field label="Name"><input name="name" required defaultValue={pk?.name} placeholder="10 hours" className={inputClass} /></Field>
      <Field label="Hours"><input name="hours" inputMode="decimal" required defaultValue={pk ? String(pk.minutes / 60) : ''} className={inputClass} /></Field>
      <Field label={`Price (${currency})`}><input name="price" inputMode="decimal" required defaultValue={pk ? (pk.priceCents / 100).toFixed(2) : ''} className={inputClass} /></Field>
      <Field label="Valid for (months)"><input name="validMonths" type="number" min={1} max={60} required defaultValue={pk?.validMonths ?? 12} className={inputClass} /></Field>
      <Field label="Order"><input name="sortOrder" type="number" defaultValue={pk?.sortOrder ?? 0} className={inputClass} /></Field>
      <Check name="active" label="On sale" defaultChecked={pk?.active ?? true} />
      <div className="sm:col-span-3"><Field label="Description"><textarea name="description" defaultValue={pk?.description} className={textareaClass} /></Field></div>
      <fieldset className="flex flex-wrap gap-x-4 text-sm sm:col-span-3"><legend className="font-medium">Can be used for (none ticked = any session type)</legend>{types.map((t) => <Check key={t.id} name="type" label={t.name} defaultChecked={chosen.has(t.id)} />)}</fieldset>
    </ItemForm>
  )
}
