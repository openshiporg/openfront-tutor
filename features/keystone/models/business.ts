import { list } from '@keystone-6/core'
import { checkbox, integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { ownerFilter } from '../utils/ownership'
import { trackingFields } from './trackingFields'
import { attachProfileHook, ownCrud, ownedMany, profileField, sameProfileHooks, fieldKit } from './fields'

const no = () => false
const textarea = { ui: { displayMode: 'textarea' as const } }

/** §5.2 The tutor's business. One per tutor; created only by `setUpMyBusiness`. */
export const TutorProfile = list({
  access: {
    operation: { query: permissions.canManageBusiness, create: no, update: permissions.canManageBusiness, delete: no },
    filter: { query: ownerFilter, update: ownerFilter },
  },
  ui: { labelField: 'businessName', listView: { initialColumns: ['businessName', 'slug', 'timezone', 'bookingOpen'] } },
  fields: {
    owner: relationship({ ref: 'User.tutorProfile', ...fieldKit.commandOnly }),
    businessName: text({ validation: { isRequired: true } }),
    tutorName: text({ ui: { description: 'Your own name as families see it.' } }),
    slug: text({
      isIndexed: 'unique',
      validation: { isRequired: true, match: { regex: /^[a-z0-9][a-z0-9-]{1,40}$/, explanation: 'Use lowercase letters, numbers and hyphens (2 to 41 characters).' } },
      ui: { description: 'Your page address: /t/<this>.' },
    }),
    headline: text(),
    bio: text(textarea),
    photoUrl: text({ ui: { description: 'Your profile photo: an image address, e.g. /storefront/tutor.webp or https://…' } }),
    heroImageUrl: text({ ui: { description: 'The large picture at the top of your page: an image address (https://… or /storefront/…).' } }),
    qualifications: text(textarea),
    phone: text(),
    email: text(),
    city: text(),
    country: text({ ui: { description: 'Two-letter country code, e.g. US, PK, GB.' } }),
    timezone: text({ defaultValue: 'America/New_York', validation: { isRequired: true } }),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: 'A three-letter currency code, e.g. USD.' } } }),
    teachesOnline: checkbox({ defaultValue: true }),
    teachesInPerson: checkbox({ defaultValue: false }),
    inPersonArea: text({ ui: { description: 'Where you teach in person, e.g. "North Austin and Round Rock".' } }),
    defaultMeetingUrl: text({ ui: { description: 'Your Zoom room, Google Meet or any lesson link.' } }),
    bookingOpen: checkbox({ defaultValue: true, ui: { description: 'Families can book from your page.' } }),
    slotMinutes: integer({ defaultValue: 30, validation: { isRequired: true, min: 5, max: 120 } }),
    bufferMinutes: integer({ defaultValue: 10, validation: { isRequired: true, min: 0, max: 120 } }),
    minNoticeHours: integer({ defaultValue: 12, validation: { isRequired: true, min: 0, max: 720 } }),
    maxAdvanceDays: integer({ defaultValue: 60, validation: { isRequired: true, min: 1, max: 365 } }),
    cancellationWindowHours: integer({ defaultValue: 24, validation: { isRequired: true, min: 0, max: 168 } }),
    lateCancelPercent: integer({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 100 } }),
    noShowPercent: integer({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 100 } }),
    unpaidHoldMinutes: integer({ defaultValue: 60, validation: { isRequired: true, min: 30, max: 1440 }, ui: { description: 'How long an online booking waiting for card payment keeps its time (30 to 1440 minutes).' } }),
    reschedulesAllowed: integer({ defaultValue: 2, validation: { isRequired: true, min: 0, max: 10 } }),
    paymentInstructions: text({ ui: { displayMode: 'textarea', description: 'How families pay you directly: bank transfer, Zelle, JazzCash, M-Pesa…' } }),
    policiesText: text(textarea),
    invoiceDueDays: integer({ defaultValue: 7, validation: { isRequired: true, min: 0, max: 90 } }),
    invoiceCounter: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    reviewsEnabled: checkbox({ defaultValue: true }),
    calendarTokenHash: text(fieldKit.secret),
    subjects: ownedMany('Subject.profile'),
    sessionTypes: ownedMany('SessionType.profile'),
    weeklyHours: ownedMany('WeeklyHours.profile'),
    timeOff: ownedMany('TimeOff.profile'),
    packages: ownedMany('Package.profile'),
    families: ownedMany('Family.profile'),
    students: ownedMany('Student.profile'),
    inquiries: ownedMany('Inquiry.profile'),
    reviews: ownedMany('Review.profile'),
    sessions: ownedMany('Session.profile'),
    sessionNotes: ownedMany('SessionNote.profile'),
    homework: ownedMany('Homework.profile'),
    progressMarks: ownedMany('ProgressMark.profile'),
    resources: ownedMany('Resource.profile'),
    series: ownedMany('RecurringSeries.profile'),
    purchases: ownedMany('PackagePurchase.profile'),
    creditEntries: ownedMany('CreditEntry.profile'),
    invoices: ownedMany('Invoice.profile'),
    invoiceLines: ownedMany('InvoiceLine.profile'),
    payments: ownedMany('Payment.profile'),
    paymentProviders: ownedMany('PaymentProvider.profile'),
    paymentSessions: ownedMany('PaymentSession.profile'),
    expenses: ownedMany('Expense.profile'),
    notifications: ownedMany('NotificationLog.profile'),
    ...trackingFields,
  },
})

export const Subject = list({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ['name', 'levels', 'active', 'sortOrder'] } },
  fields: {
    profile: profileField('subjects'),
    name: text({ validation: { isRequired: true } }),
    levels: text({ ui: { description: 'e.g. "Grades 6 to 12", "IGCSE and A level".' } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    imageUrl: text({ ui: { description: 'Optional picture for this subject: an image address.' } }),
    sortOrder: integer({ defaultValue: 0 }),
    active: checkbox({ defaultValue: true }),
    sessionTypes: relationship({ ref: 'SessionType.subjects', many: true }),
    students: relationship({ ref: 'Student.subjects', many: true }),
    ...trackingFields,
  },
})

export const SessionType = list({
  hooks: sameProfileHooks([{ field: 'subjects', list: 'Subject' }]),
  access: ownCrud(permissions.canManageBusiness, { delete: false }),
  ui: { listView: { initialColumns: ['name', 'durationMinutes', 'priceCents', 'mode', 'openToNewFamilies', 'active'] } },
  fields: {
    profile: profileField('sessionTypes'),
    name: text({ validation: { isRequired: true } }),
    description: text(textarea),
    durationMinutes: integer({ defaultValue: 60, validation: { isRequired: true, min: 10, max: 480 } }),
    priceCents: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 10_000_000 }, ui: { description: 'Price in minor units (cents). 0 is free.' } }),
    mode: select({ type: 'enum', options: [{ label: 'Online', value: 'online' }, { label: 'In person', value: 'in_person' }, { label: 'Either', value: 'either' }], defaultValue: 'online', validation: { isRequired: true } }),
    openToNewFamilies: checkbox({ defaultValue: false, ui: { description: 'New families may book this type from your page.' } }),
    maxStudents: integer({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 4 }, ui: { description: 'Siblings from one family in one session (1 to 4).' } }),
    subjects: relationship({ ref: 'Subject.sessionTypes', many: true }),
    packages: relationship({ ref: 'Package.appliesTo', many: true, ...fieldKit.commandOnly }),
    active: checkbox({ defaultValue: true }),
    sortOrder: integer({ defaultValue: 0 }),
    sessions: relationship({ ref: 'Session.sessionType', many: true, ...fieldKit.commandOnly }),
    series: relationship({ ref: 'RecurringSeries.sessionType', many: true, ...fieldKit.commandOnly }),
    ...trackingFields,
  },
})

export const WeeklyHours = list({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  graphql: { plural: 'WeeklyHoursRows' },
  ui: { listView: { initialColumns: ['dayOfWeek', 'isWorking', 'startMinute', 'endMinute'] } },
  fields: {
    profile: profileField('weeklyHours'),
    dayOfWeek: select({
      type: 'enum',
      options: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value })),
      validation: { isRequired: true },
    }),
    isWorking: checkbox({ defaultValue: true }),
    startMinute: integer({ defaultValue: 900, validation: { isRequired: true, min: 0, max: 1439 }, ui: { description: 'Minutes after midnight (900 = 3:00 PM).' } }),
    endMinute: integer({ defaultValue: 1200, validation: { isRequired: true, min: 1, max: 1440 }, ui: { description: 'Minutes after midnight (1200 = 8:00 PM).' } }),
    breakStartMinute: integer({ validation: { min: 0, max: 1439 } }),
    breakEndMinute: integer({ validation: { min: 1, max: 1440 } }),
    ...trackingFields,
  },
})

export const TimeOff = list({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ['startsAt', 'endsAt', 'reason'] } },
  fields: {
    profile: profileField('timeOff'),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp({ validation: { isRequired: true } }),
    reason: text(),
    ...trackingFields,
  },
})

export const Package = list({
  hooks: sameProfileHooks([{ field: 'appliesTo', list: 'SessionType' }]),
  access: ownCrud(permissions.canManageBusiness, { delete: false }),
  ui: { listView: { initialColumns: ['name', 'minutes', 'priceCents', 'validMonths', 'active'] } },
  fields: {
    profile: profileField('packages'),
    name: text({ validation: { isRequired: true } }),
    description: text(textarea),
    minutes: integer({ validation: { isRequired: true, min: 30, max: 60_000 }, ui: { description: 'Prepaid minutes (600 = 10 hours).' } }),
    priceCents: integer({ validation: { isRequired: true, min: 0, max: 100_000_000 } }),
    validMonths: integer({ defaultValue: 12, validation: { isRequired: true, min: 1, max: 60 } }),
    appliesTo: relationship({ ref: 'SessionType.packages', many: true, ui: { description: 'Leave empty to use on any session type.' } }),
    active: checkbox({ defaultValue: true }),
    sortOrder: integer({ defaultValue: 0 }),
    purchases: relationship({ ref: 'PackagePurchase.package', many: true, ...fieldKit.commandOnly }),
    ...trackingFields,
  },
})
