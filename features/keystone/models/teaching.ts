import { list } from '@keystone-6/core'
import { file, integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { ownProfileFilter } from '../utils/ownership'
import { trackingFields } from './trackingFields'
import { commandOnly, ownCrud, profileField, secret, sameProfileHooks } from './fields'

const no = () => false
const textarea = { ui: { displayMode: 'textarea' as const } }
const opt = (...values: string[]) => values.map((value) => ({ label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value }))
const readonlyEnum = (values: string[], defaultValue: string) => select({ type: 'enum', options: opt(...values), defaultValue, validation: { isRequired: true }, ...commandOnly })

export const SESSION_STATUSES = ['pending_payment', 'scheduled', 'completed', 'cancelled', 'late_cancelled', 'no_show', 'excused', 'released'] as const
export const FUNDINGS = ['package', 'card', 'invoice', 'flat', 'free'] as const

/**
 * §5.4 One lesson. Every booking path (visitor, guardian, tutor, series) goes
 * through the locked booking command, so generic create and delete are off,
 * and the facts that carry money or state can be changed only by commands.
 */
export const Session = list({
  access: {
    operation: { query: permissions.canManageSessions, create: no, update: permissions.canManageSessions, delete: no },
    filter: { query: ownProfileFilter, update: ownProfileFilter },
  },
  ui: { labelField: 'typeNameSnapshot', listView: { initialColumns: ['startsAt', 'family', 'typeNameSnapshot', 'status', 'funding', 'paymentStatus'] } },
  fields: {
    profile: profileField('sessions'),
    family: relationship({ ref: 'Family.sessions', ...commandOnly }),
    students: relationship({ ref: 'Student.sessions', many: true, ...commandOnly }),
    sessionType: relationship({ ref: 'SessionType.sessions', ...commandOnly }),
    series: relationship({ ref: 'RecurringSeries.sessions', ...commandOnly }),
    startsAt: timestamp({ validation: { isRequired: true }, ...commandOnly }),
    endsAt: timestamp({ validation: { isRequired: true }, ...commandOnly }),
    mode: select({ type: 'enum', options: opt('online', 'in_person'), defaultValue: 'online', validation: { isRequired: true } }),
    meetingUrl: text({ ui: { description: 'Overrides the student and default lesson link for this session.' } }),
    locationText: text(),
    status: readonlyEnum([...SESSION_STATUSES], 'scheduled'),
    funding: readonlyEnum([...FUNDINGS], 'free'),
    source: readonlyEnum(['online', 'tutor', 'series'], 'tutor'),
    typeNameSnapshot: text(commandOnly),
    priceCents: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    chargedCents: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    chargedMinutes: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    billable: select({ type: 'enum', options: opt('no', 'yes'), defaultValue: 'no', validation: { isRequired: true }, ...commandOnly }),
    paymentStatus: readonlyEnum(['not_due', 'unpaid', 'paid', 'refunded', 'part_refunded'], 'not_due'),
    holdEndsAt: timestamp(commandOnly),
    guardianMessage: text({ ui: { displayMode: 'textarea' }, ...commandOnly }),
    cancellationReason: text(commandOnly),
    cancelledBy: readonlyEnum(['none', 'guardian', 'tutor', 'system'], 'none'),
    cancelledAt: timestamp(commandOnly),
    completedAt: timestamp(commandOnly),
    rescheduleCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...commandOnly }),
    rescheduledFrom: timestamp(commandOnly),
    reminderSentAt: timestamp(commandOnly),
    publicAccessTokenHash: text(secret),
    note: relationship({ ref: 'SessionNote.session', ...commandOnly }),
    homework: relationship({ ref: 'Homework.session', many: true, ...commandOnly }),
    creditEntries: relationship({ ref: 'CreditEntry.session', many: true, ...commandOnly }),
    payments: relationship({ ref: 'Payment.session', many: true, ...commandOnly }),
    paymentSessions: relationship({ ref: 'PaymentSession.session', many: true, ...commandOnly }),
    invoiceLines: relationship({ ref: 'InvoiceLine.session', many: true, ...commandOnly }),
    ...trackingFields,
  },
})

/** The tutor's note after a lesson: a part the family sees and a private part. Created by `completeSession`. */
export const SessionNote = list({
  access: {
    operation: { query: permissions.canManageSessions, create: no, update: permissions.canManageSessions, delete: no },
    filter: { query: ownProfileFilter, update: ownProfileFilter },
  },
  ui: { listView: { initialColumns: ['session', 'covered', 'workOnNext', 'sharedAt'] } },
  fields: {
    profile: profileField('sessionNotes'),
    session: relationship({ ref: 'Session.note', db: { foreignKey: true }, ...commandOnly }),
    covered: text(textarea),
    wentWell: text(textarea),
    workOnNext: text(textarea),
    effort: integer({ validation: { min: 1, max: 5 } }),
    privateNote: text({ ui: { displayMode: 'textarea', description: 'Only you see this.' } }),
    sharedAt: timestamp(commandOnly),
    ...trackingFields,
  },
})

export const Homework = list({
  hooks: sameProfileHooks([{ field: 'student', list: 'Student' }]),
  access: ownCrud(permissions.canManageSessions),
  graphql: { plural: 'HomeworkItems' },
  ui: { listView: { initialColumns: ['title', 'student', 'dueAt', 'status'] } },
  fields: {
    profile: profileField('homework'),
    student: relationship({ ref: 'Student.homework' }),
    session: relationship({ ref: 'Session.homework', ...commandOnly }),
    title: text({ validation: { isRequired: true } }),
    instructions: text(textarea),
    dueAt: timestamp(),
    linkUrl: text(),
    file: file({ storage: 'tutor_files' }),
    status: readonlyEnum(['assigned', 'handed_in', 'reviewed'], 'assigned'),
    handedInAt: timestamp(commandOnly),
    guardianComment: text({ ui: { displayMode: 'textarea' }, ...commandOnly }),
    handInUrl: text(commandOnly),
    feedback: text({ ui: { displayMode: 'textarea' }, ...commandOnly }),
    reviewedAt: timestamp(commandOnly),
    ...trackingFields,
  },
})

export const ProgressMark = list({
  hooks: sameProfileHooks([{ field: 'student', list: 'Student' }]),
  access: ownCrud(permissions.canManageSessions),
  ui: { listView: { initialColumns: ['student', 'label', 'takenOn', 'score', 'outOf'] } },
  fields: {
    profile: profileField('progressMarks'),
    student: relationship({ ref: 'Student.marks' }),
    label: text({ validation: { isRequired: true }, ui: { description: 'e.g. "Unit 3 test", "SAT practice 4".' } }),
    takenOn: timestamp({ validation: { isRequired: true } }),
    score: integer({ validation: { isRequired: true, min: 0 } }),
    outOf: integer({ validation: { isRequired: true, min: 1 } }),
    note: text(),
    ...trackingFields,
  },
})

export const Resource = list({
  hooks: sameProfileHooks([{ field: 'students', list: 'Student' }]),
  access: ownCrud(permissions.canManageSessions),
  ui: { listView: { initialColumns: ['title', 'linkUrl', 'students'] } },
  fields: {
    profile: profileField('resources'),
    title: text({ validation: { isRequired: true } }),
    linkUrl: text(),
    file: file({ storage: 'tutor_files' }),
    students: relationship({ ref: 'Student.resources', many: true, ui: { description: 'Leave empty to share with every active student.' } }),
    note: text(textarea),
    ...trackingFields,
  },
})

/** A weekly standing lesson. Created and changed only by `saveSeries`, `pauseSeries`, `endSeries`. */
export const RecurringSeries = list({
  access: {
    operation: { query: permissions.canManageSessions, create: no, update: no, delete: no },
    filter: { query: ownProfileFilter },
  },
  graphql: { plural: 'RecurringSeriesItems' },
  ui: { listView: { initialColumns: ['family', 'sessionType', 'dayOfWeek', 'startMinute', 'status'] } },
  fields: {
    profile: profileField('series'),
    family: relationship({ ref: 'Family.series', ...commandOnly }),
    students: relationship({ ref: 'Student.series', many: true, ...commandOnly }),
    sessionType: relationship({ ref: 'SessionType.series', ...commandOnly }),
    dayOfWeek: integer({ validation: { isRequired: true, min: 0, max: 6 }, ...commandOnly, ui: { description: '0 = Sunday … 6 = Saturday, in your timezone.' } }),
    startMinute: integer({ validation: { isRequired: true, min: 0, max: 1439 }, ...commandOnly }),
    mode: select({ type: 'enum', options: opt('online', 'in_person'), defaultValue: 'online', validation: { isRequired: true }, ...commandOnly }),
    startsOn: text({ validation: { isRequired: true }, ...commandOnly, ui: { description: 'YYYY-MM-DD' } }),
    endsOn: text(commandOnly),
    status: readonlyEnum(['active', 'paused', 'ended'], 'active'),
    generatedThrough: text(commandOnly),
    skippedDates: text({ ui: { displayMode: 'textarea', description: 'Weeks that could not be booked (one YYYY-MM-DD per line).' }, ...commandOnly }),
    sessions: relationship({ ref: 'Session.series', many: true, ...commandOnly }),
    ...trackingFields,
  },
})
