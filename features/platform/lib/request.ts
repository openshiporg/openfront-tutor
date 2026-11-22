'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type Command<T = unknown> = { success: boolean; error: string | null; data: T | null }

/** One GraphQL command that answers { success, error, data }. (Barber.) */
export async function command<T = unknown>(query: string, variables: Record<string, unknown>, field: string): Promise<Command<T>> {
  const response = await keystoneClient<Record<string, Command<T>>>(query, variables)
  if (!response.success) return { success: false, error: 'Connection problem. Try again.', data: null }
  return response.data[field] ?? { success: false, error: 'No answer from the server.', data: null }
}

/**
 * The tutor operations the dashboard may call by name, with their GraphQL
 * argument types. Only names on this list can be run from a form.
 */
const MUTATIONS: Record<string, Record<string, string>> = {
  setUpMyBusiness: { businessName: 'String!', tutorName: 'String', slug: 'String!', timezone: 'String!', currencyCode: 'String', country: 'String', subjects: '[String!]', levels: 'String', teachesOnline: 'Boolean', teachesInPerson: 'Boolean', hourlyRateCents: 'Int', typicalSetup: 'Boolean', email: 'String' },
  createSessionAsTutor: { familyId: 'ID!', sessionTypeId: 'ID!', startsAt: 'String!', studentIds: '[ID!]!', mode: 'String', meetingUrl: 'String', notify: 'Boolean' },
  completeSession: { sessionId: 'ID!', note: 'SessionNoteInput', homework: '[HomeworkInput!]', share: 'Boolean' },
  saveSessionNote: { sessionId: 'ID!', covered: 'String', wentWell: 'String', workOnNext: 'String', effort: 'Int', privateNote: 'String', share: 'Boolean' },
  markNoShow: { sessionId: 'ID!' },
  cancelSessionAsTutor: { sessionId: 'ID!', reason: 'String', notify: 'Boolean' },
  rescheduleSessionAsTutor: { sessionId: 'ID!', startsAt: 'String!', notify: 'Boolean' },
  excuseSession: { sessionId: 'ID!' },
  reopenSession: { sessionId: 'ID!' },
  sessionLink: { sessionId: 'ID!' },
  saveSeries: { id: 'ID', familyId: 'ID!', sessionTypeId: 'ID!', studentIds: '[ID!]!', dayOfWeek: 'Int!', startMinute: 'Int!', startsOn: 'String!', endsOn: 'String', mode: 'String' },
  pauseSeries: { id: 'ID!', resume: 'Boolean' },
  endSeries: { id: 'ID!' },
  clearSkippedWeek: { id: 'ID!', date: 'String!' },
  inviteFamily: { familyId: 'ID!', send: 'Boolean' },
  saveStudentAsTutor: { student: 'TutorStudentInput!' },
  convertInquiry: { id: 'ID!', studentName: 'String', billingMode: 'String' },
  setInquiryStatus: { id: 'ID!', status: 'String!' },
  reviewHomework: { id: 'ID!', feedback: 'String' },
  moderateReview: { id: 'ID!', status: 'String!' },
  sellPackage: { familyId: 'ID!', packageId: 'ID!', method: 'String!', reference: 'String' },
  cancelPackagePurchase: { purchaseId: 'ID!' },
  refundPackage: { purchaseId: 'ID!' },
  adjustMinutes: { purchaseId: 'ID!', minutes: 'Int!', reason: 'String!' },
  confirmPayment: { paymentId: 'ID!' },
  rejectPayment: { paymentId: 'ID!', note: 'String' },
  recordPayment: { target: 'String!', targetId: 'ID!', amountCents: 'Int', method: 'String!', reference: 'String' },
  refundPayment: { paymentId: 'ID!', amountCents: 'Int', note: 'String' },
  draftInvoice: { familyId: 'ID!', sessionIds: '[ID!]', includeFlatFee: 'Boolean', extraLines: '[InvoiceLineInput!]', dueDays: 'Int', note: 'String' },
  addInvoiceLine: { invoiceId: 'ID!', line: 'InvoiceLineInput!' },
  removeInvoiceLine: { lineId: 'ID!' },
  sendInvoice: { invoiceId: 'ID!', send: 'Boolean' },
  invoiceLink: { invoiceId: 'ID!' },
  voidInvoice: { invoiceId: 'ID!' },
}

const QUERIES: Record<string, Record<string, string>> = {
  tutorCalendarFeedUrl: {},
  exportCsv: { kind: 'String!', from: 'String!', to: 'String!' },
}

/** Runs one named tutor operation with the given variables; refreshes the dashboard on success. */
export async function runOperation(name: string, variables: Record<string, unknown>): Promise<Command> {
  const args = MUTATIONS[name] ?? QUERIES[name]
  if (!args) return { success: false, error: 'Unknown action.', data: null }
  const keys = Object.keys(args).filter((k) => variables[k] !== undefined)
  const sig = keys.length ? `(${keys.map((k) => `$${k}: ${args[k]}`).join(', ')})` : ''
  const call = keys.length ? `(${keys.map((k) => `${k}: $${k}`).join(', ')})` : ''
  const kind = MUTATIONS[name] ? 'mutation' : 'query'
  const result = await command(`${kind}${sig} { ${name}${call} { success error data } }`, Object.fromEntries(keys.map((k) => [k, variables[k]])), name)
  if (result.success && kind === 'mutation') revalidatePath('/dashboard/platform', 'layout')
  return result
}

/** Generic CRUD on one list for the plain settings tables (WeeklyHours, TimeOff, SessionType…): access rules still apply. */
export async function saveItem(list: string, id: string | null, data: Record<string, unknown>): Promise<Command> {
  if (!/^[A-Z][A-Za-z]+$/.test(list)) return { success: false, error: 'Unknown list.', data: null }
  const q = id
    ? `mutation($id: ID!, $data: ${list}UpdateInput!) { r: update${list}(where: { id: $id }, data: $data) { id } }`
    : `mutation($data: ${list}CreateInput!) { r: create${list}(data: $data) { id } }`
  const response = await keystoneClient<{ r: { id: string } | null }>(q, id ? { id, data } : { data })
  if (!response.success || !response.data.r) return { success: false, error: response.success ? 'Not saved.' : friendly(response.error), data: null }
  revalidatePath('/dashboard/platform', 'layout')
  return { success: true, error: null, data: response.data.r }
}

export async function deleteItem(list: string, id: string): Promise<Command> {
  if (!/^[A-Z][A-Za-z]+$/.test(list)) return { success: false, error: 'Unknown list.', data: null }
  const response = await keystoneClient<{ r: { id: string } | null }>(`mutation($id: ID!) { r: delete${list}(where: { id: $id }) { id } }`, { id })
  if (!response.success || !response.data.r) return { success: false, error: response.success ? 'Not removed.' : friendly(response.error), data: null }
  revalidatePath('/dashboard/platform', 'layout')
  return { success: true, error: null, data: response.data.r }
}

function friendly(error: string) {
  const m = /:\s*([^:]+)$/.exec(error || '')
  return (m?.[1] || error || 'Not saved.').slice(0, 300)
}
