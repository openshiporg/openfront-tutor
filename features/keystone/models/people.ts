import { list } from '@keystone-6/core'
import { integer, relationship, select, text } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { trackingFields } from './trackingFields'
import { ownCrud, profileField, sameProfileHooks, fieldKit } from './fields'

const textarea = { ui: { displayMode: 'textarea' as const } }
const opt = (...values: string[]) => values.map((value) => ({ label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value }))

/** §5.3 A paying household: a parent, or an adult student acting for themselves. */
export const Family = list({
  hooks: sameProfileHooks([]),
  access: ownCrud(permissions.canManageFamilies, { delete: false }),
  ui: { labelField: 'guardianName', listView: { initialColumns: ['guardianName', 'email', 'phone', 'status', 'billingMode'] } },
  fields: {
    profile: profileField('families'),
    guardianName: text({ validation: { isRequired: true } }),
    email: text({ isIndexed: true }),
    phone: text(),
    secondContactName: text(),
    secondContactPhone: text(),
    status: select({ type: 'enum', options: opt('lead', 'active', 'paused', 'former', 'blocked'), defaultValue: 'lead', validation: { isRequired: true } }),
    billingMode: select({ type: 'enum', options: opt('pay_as_you_book', 'invoice', 'flat_monthly'), defaultValue: 'pay_as_you_book', validation: { isRequired: true } }),
    monthlyFeeCents: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 100_000_000 }, ui: { description: 'Fixed monthly fee in minor units (flat monthly billing only).' } }),
    address: text({ ui: { displayMode: 'textarea', description: 'For in-person lessons.' } }),
    timezone: text(),
    howTheyFoundMe: text(),
    privateNotes: text({ ui: { displayMode: 'textarea', description: 'Only you see this.' } }),
    user: relationship({ ref: 'User.family', ...fieldKit.commandOnly }),
    inviteTokenHash: text(fieldKit.secret),
    calendarTokenHash: text(fieldKit.secret),
    students: relationship({ ref: 'Student.family', many: true, ...fieldKit.commandOnly }),
    sessions: relationship({ ref: 'Session.family', many: true, ...fieldKit.commandOnly }),
    series: relationship({ ref: 'RecurringSeries.family', many: true, ...fieldKit.commandOnly }),
    purchases: relationship({ ref: 'PackagePurchase.family', many: true, ...fieldKit.commandOnly }),
    invoices: relationship({ ref: 'Invoice.family', many: true, ...fieldKit.commandOnly }),
    payments: relationship({ ref: 'Payment.family', many: true, ...fieldKit.commandOnly }),
    reviews: relationship({ ref: 'Review.family', many: true, ...fieldKit.commandOnly }),
    inquiries: relationship({ ref: 'Inquiry.family', many: true, ...fieldKit.commandOnly }),
    ...trackingFields,
  },
})

export const Student = list({
  hooks: sameProfileHooks([{ field: 'family', list: 'Family' }, { field: 'subjects', list: 'Subject' }]),
  access: ownCrud(permissions.canManageFamilies, { delete: false }),
  ui: { labelField: 'firstName', listView: { initialColumns: ['firstName', 'lastName', 'family', 'level', 'status'] } },
  fields: {
    profile: profileField('students'),
    family: relationship({ ref: 'Family.students', db: { foreignKey: true } }),
    firstName: text({ validation: { isRequired: true } }),
    lastName: text(),
    level: text({ ui: { description: 'Grade or year, e.g. "Grade 10", "Year 11".' } }),
    school: text(),
    birthYear: integer({ validation: { min: 1900, max: 2100 } }),
    goals: text(textarea),
    needs: text({ ui: { displayMode: 'textarea', description: 'What to watch for. Only you see this.' } }),
    meetingUrl: text({ ui: { description: 'Overrides your default lesson link for this student.' } }),
    status: select({ type: 'enum', options: opt('active', 'paused', 'finished'), defaultValue: 'active', validation: { isRequired: true } }),
    subjects: relationship({ ref: 'Subject.students', many: true }),
    sessions: relationship({ ref: 'Session.students', many: true, ...fieldKit.commandOnly }),
    series: relationship({ ref: 'RecurringSeries.students', many: true, ...fieldKit.commandOnly }),
    homework: relationship({ ref: 'Homework.student', many: true, ...fieldKit.commandOnly }),
    marks: relationship({ ref: 'ProgressMark.student', many: true, ...fieldKit.commandOnly }),
    resources: relationship({ ref: 'Resource.students', many: true, ...fieldKit.commandOnly }),
    ...trackingFields,
  },
})

export const Inquiry = list({
  access: {
    // Created by the public `sendInquiry` command only.
    operation: { query: permissions.canManageFamilies, create: () => false, update: permissions.canManageFamilies, delete: () => false },
    filter: { query: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false, update: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false },
  },
  ui: { listView: { initialColumns: ['name', 'email', 'studentLevel', 'subject', 'status', 'createdAt'] } },
  fields: {
    profile: profileField('inquiries'),
    name: text({ validation: { isRequired: true } }),
    email: text(),
    phone: text(),
    studentLevel: text(),
    subject: text(),
    message: text(textarea),
    status: select({ type: 'enum', options: opt('new', 'contacted', 'converted', 'closed'), defaultValue: 'new', validation: { isRequired: true }, ...fieldKit.commandOnly }),
    family: relationship({ ref: 'Family.inquiries', ...fieldKit.commandOnly }),
    ...trackingFields,
  },
})

export const Review = list({
  access: {
    // Written by `submitReview`; published or hidden by `moderateReview`.
    operation: { query: permissions.canManageFamilies, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => session ? { profile: { owner: { id: { equals: session.itemId } } } } : false },
  },
  ui: { listView: { initialColumns: ['displayName', 'rating', 'status', 'createdAt'] } },
  fields: {
    profile: profileField('reviews'),
    // One per family, enforced by `submitReview` under the family lock.
    family: relationship({ ref: 'Family.reviews', ...fieldKit.commandOnly }),
    displayName: text({ validation: { isRequired: true } }),
    rating: integer({ validation: { isRequired: true, min: 1, max: 5 } }),
    body: text(textarea),
    status: select({ type: 'enum', options: opt('pending', 'published', 'hidden'), defaultValue: 'pending', validation: { isRequired: true } }),
    ...trackingFields,
  },
})
