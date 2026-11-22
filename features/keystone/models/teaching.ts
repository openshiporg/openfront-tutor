import { list } from '@keystone-6/core'
import { file, integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { ownProfileFilter } from '../utils/ownership'
import { trackingFields } from './trackingFields'
import { ownCrud, profileField, sameProfileHooks, fieldKit } from './fields'

/** Command-only with extra ui (description, textarea). */
const co = (ui: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ ...extra, access: fieldKit.commandOnly.access, ui: { ...fieldKit.commandOnly.ui, ...ui } })

const no = () => false
const textarea = { ui: { displayMode: 'textarea' as const } }
const opt = (...values: string[]) => values.map((value) => ({ label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value }))
const readonlyEnum = (values: string[], defaultValue: string) => select({ type: 'enum', options: opt(...values), defaultValue, validation: { isRequired: true }, ...fieldKit.commandOnly })

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
    family: relationship({ ref: 'Family.sessions', ...fieldKit.commandOnly }),
    students: relationship({ ref: 'Student.sessions', many: true, ...fieldKit.commandOnly }),
    sessionType: relationship({ ref: 'SessionType.sessions', ...fieldKit.commandOnly }),
    series: relationship({ ref: 'RecurringSeries.sessions', ...fieldKit.commandOnly }),
    startsAt: timestamp({ validation: { isRequired: true }, ...fieldKit.commandOnly }),
    endsAt: timestamp({ validation: { isRequired: true }, ...fieldKit.commandOnly }),
    mode: select({ type: 'enum', options: opt('online', 'in_person'), defaultValue: 'online', validation: { isRequired: true } }),
    meetingUrl: text({ ui: { description: 'Overrides the student and default lesson link for this session.' } }),
    locationText: text(),
    status: readonlyEnum([...SESSION_STATUSES], 'scheduled'),
    funding: readonlyEnum([...FUNDINGS], 'free'),
    source: readonlyEnum(['online', 'tutor', 'series'], 'tutor'),
    typeNameSnapshot: text(fieldKit.commandOnly),
    priceCents: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    chargedCents: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    chargedMinutes: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    billable: select({ type: 'enum', options: opt('no', 'yes'), defaultValue: 'no', validation: { isRequired: true }, ...fieldKit.commandOnly }),
    paymentStatus: readonlyEnum(['not_due', 'unpaid', 'paid', 'refunded', 'part_refunded'], 'not_due'),
    holdEndsAt: timestamp(fieldKit.commandOnly),
    guardianMessage: text(co({ displayMode: 'textarea' })),
    cancellationReason: text(fieldKit.commandOnly),
    cancelledBy: readonlyEnum(['none', 'guardian', 'tutor', 'system'], 'none'),
    cancelledAt: timestamp(fieldKit.commandOnly),
    completedAt: timestamp(fieldKit.commandOnly),
    rescheduleCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 }, ...fieldKit.commandOnly }),
    rescheduledFrom: timestamp(fieldKit.commandOnly),
    reminderSentAt: timestamp(fieldKit.commandOnly),
    publicAccessTokenHash: text(fieldKit.secret),
    note: relationship({ ref: 'SessionNote.session', ...fieldKit.commandOnly }),
    homework: relationship({ ref: 'Homework.session', many: true, ...fieldKit.commandOnly }),
    creditEntries: relationship({ ref: 'CreditEntry.session', many: true, ...fieldKit.commandOnly }),
    payments: relationship({ ref: 'Payment.session', many: true, ...fieldKit.commandOnly }),
    paymentSessions: relationship({ ref: 'PaymentSession.session', many: true, ...fieldKit.commandOnly }),
    invoiceLines: relationship({ ref: 'InvoiceLine.session', many: true, ...fieldKit.commandOnly }),
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
    session: relationship({ ref: 'Session.note', db: { foreignKey: true }, ...fieldKit.commandOnly }),
    covered: text(textarea),
    wentWell: text(textarea),
    workOnNext: text(textarea),
    effort: integer({ validation: { min: 1, max: 5 } }),
    privateNote: text({ ui: { displayMode: 'textarea', description: 'Only you see this.' } }),
    sharedAt: timestamp(fieldKit.commandOnly),
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
    session: relationship({ ref: 'Session.homework', ...fieldKit.commandOnly }),
    title: text({ validation: { isRequired: true } }),
    instructions: text(textarea),
    dueAt: timestamp(),
    linkUrl: text(),
    file: file({ storage: 'tutor_files' }),
    status: readonlyEnum(['assigned', 'handed_in', 'reviewed'], 'assigned'),
    handedInAt: timestamp(fieldKit.commandOnly),
    guardianComment: text(co({ displayMode: 'textarea' })),
    handInUrl: text(fieldKit.commandOnly),
    feedback: text(co({ displayMode: 'textarea' })),
    reviewedAt: timestamp(fieldKit.commandOnly),
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
    family: relationship({ ref: 'Family.series', ...fieldKit.commandOnly }),
    students: relationship({ ref: 'Student.series', many: true, ...fieldKit.commandOnly }),
    sessionType: relationship({ ref: 'SessionType.series', ...fieldKit.commandOnly }),
    dayOfWeek: integer(co({ description: '0 = Sunday … 6 = Saturday, in your timezone.' }, { validation: { isRequired: true, min: 0, max: 6 } })),
    startMinute: integer({ validation: { isRequired: true, min: 0, max: 1439 }, ...fieldKit.commandOnly }),
    mode: select({ type: 'enum', options: opt('online', 'in_person'), defaultValue: 'online', validation: { isRequired: true }, ...fieldKit.commandOnly }),
    startsOn: text(co({ description: 'YYYY-MM-DD' }, { validation: { isRequired: true } })),
    endsOn: text(fieldKit.commandOnly),
    status: readonlyEnum(['active', 'paused', 'ended'], 'active'),
    generatedThrough: text(fieldKit.commandOnly),
    skippedDates: text(co({ displayMode: 'textarea', description: 'Weeks that could not be booked (one YYYY-MM-DD per line).' })),
    sessions: relationship({ ref: 'Session.series', many: true, ...fieldKit.commandOnly }),
    ...trackingFields,
  },
})
