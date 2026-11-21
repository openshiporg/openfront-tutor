import { list } from '@keystone-6/core'
import { checkbox, integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { trackingFields } from './trackingFields'
import { attachProfileHook, commandOnly, ownCrud, ownReadOnly, profileField, secret } from './fields'

const no = () => false
const opt = (...values: string[]) => values.map((value) => ({ label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value }))
const readonlyEnum = (values: string[], defaultValue: string) => select({ type: 'enum', options: opt(...values), defaultValue, validation: { isRequired: true }, ...commandOnly })
const ro = (extra: Record<string, unknown> = {}) => ({ ...commandOnly, ...extra })

/** §5.5 One bought package. Minutes move only through the ledger commands. */
export const PackagePurchase = list({
  access: ownReadOnly(permissions.canManageFamilies),
  ui: { labelField: 'nameSnapshot', listView: { initialColumns: ['family', 'nameSnapshot', 'minutesRemaining', 'status', 'expiresAt'] } },
  fields: {
    profile: profileField('purchases'),
    family: relationship({ ref: 'Family.purchases', ...commandOnly }),
    package: relationship({ ref: 'Package.purchases', ...commandOnly }),
    nameSnapshot: text(commandOnly),
    appliesToIds: text({ ...commandOnly, ui: { ...commandOnly.ui, description: 'Session type ids this package covers, copied when bought (empty = any).' } }),
    minutesGranted: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    minutesRemaining: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    pricePaidCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundedCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    status: readonlyEnum(['awaiting_payment', 'active', 'used_up', 'expired', 'refunded', 'cancelled'], 'awaiting_payment'),
    purchasedAt: timestamp(commandOnly),
    expiresAt: timestamp(commandOnly),
    entries: relationship({ ref: 'CreditEntry.purchase', many: true, ...commandOnly }),
    payments: relationship({ ref: 'Payment.purchase', many: true, ...commandOnly }),
    paymentSessions: relationship({ ref: 'PaymentSession.purchase', many: true, ...commandOnly }),
    ...trackingFields,
  },
})

/** Append-only minutes ledger. Nobody may update or delete an entry. */
export const CreditEntry = list({
  access: ownReadOnly(permissions.canManageFamilies),
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['purchase', 'kind', 'minutes', 'session', 'createdAt'] } },
  fields: {
    profile: profileField('creditEntries'),
    purchase: relationship({ ref: 'PackagePurchase.entries', ...commandOnly }),
    session: relationship({ ref: 'Session.creditEntries', ...commandOnly }),
    kind: readonlyEnum(['grant', 'hold', 'release', 'debit', 'reversal', 'expire', 'refund', 'adjustment'], 'grant'),
    minutes: integer(ro({ validation: { isRequired: true } })),
    note: text(commandOnly),
    key: text({ ...secret, isIndexed: 'unique' }),
    ...trackingFields,
  },
})

/** Fixed once sent: corrected only by voiding and issuing a new one. */
export const Invoice = list({
  db: { extendPrismaSchema: (schema: string) => schema.replace(/\n}\s*$/, '\n  @@unique([profileId, number])\n}') },
  access: ownReadOnly(permissions.canManagePayments),
  ui: { labelField: 'number', listView: { initialColumns: ['number', 'family', 'status', 'totalCents', 'paidCents', 'dueAt'] } },
  fields: {
    profile: profileField('invoices'),
    family: relationship({ ref: 'Family.invoices', ...commandOnly }),
    number: text(ro({ validation: { isRequired: true } })),
    status: readonlyEnum(['draft', 'sent', 'paid', 'void'], 'draft'),
    issuedAt: timestamp(commandOnly),
    dueAt: timestamp(commandOnly),
    periodMonth: text(ro({ ui: { ...commandOnly.ui, description: 'YYYY-MM of a flat monthly fee on this invoice.' } })),
    subtotalCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    totalCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    paidCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    note: text(commandOnly),
    voidedAt: timestamp(commandOnly),
    lines: relationship({ ref: 'InvoiceLine.invoice', many: true, ...commandOnly }),
    payments: relationship({ ref: 'Payment.invoice', many: true, ...commandOnly }),
    paymentSessions: relationship({ ref: 'PaymentSession.invoice', many: true, ...commandOnly }),
    publicAccessTokenHash: text(secret),
    ...trackingFields,
  },
})

export const InvoiceLine = list({
  access: ownReadOnly(permissions.canManagePayments),
  ui: { listView: { initialColumns: ['invoice', 'description', 'quantity', 'unitCents', 'totalCents'] } },
  fields: {
    profile: profileField('invoiceLines'),
    invoice: relationship({ ref: 'Invoice.lines', ...commandOnly }),
    session: relationship({ ref: 'Session.invoiceLines', ...commandOnly }),
    description: text(ro({ validation: { isRequired: true } })),
    quantity: integer(ro({ defaultValue: 1, validation: { isRequired: true, min: 1 } })),
    unitCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    totalCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    sortOrder: integer(ro({ defaultValue: 0 })),
    ...trackingFields,
  },
})

/** Money received or refunded. Written by payment commands only. */
export const Payment = list({
  access: ownReadOnly(permissions.canReadPayments),
  ui: { listView: { initialColumns: ['family', 'kind', 'method', 'status', 'amountCents', 'paidAt'] } },
  fields: {
    profile: profileField('payments'),
    family: relationship({ ref: 'Family.payments', ...commandOnly }),
    session: relationship({ ref: 'Session.payments', ...commandOnly }),
    purchase: relationship({ ref: 'PackagePurchase.payments', ...commandOnly }),
    invoice: relationship({ ref: 'Invoice.payments', ...commandOnly }),
    refundOf: relationship({ ref: 'Payment.refunds', ...commandOnly }),
    refunds: relationship({ ref: 'Payment.refundOf', many: true, ...commandOnly }),
    kind: readonlyEnum(['session', 'package', 'invoice', 'refund'], 'session'),
    method: readonlyEnum(['stripe', 'cash', 'bank_transfer', 'mobile_money', 'other'], 'cash'),
    status: readonlyEnum(['reported', 'confirmed', 'rejected', 'refunded', 'partially_refunded'], 'confirmed'),
    amountCents: integer(ro({ validation: { isRequired: true, min: 0 } })),
    refundedCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundCount: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    refundPendingCents: integer(ro({ defaultValue: 0, validation: { isRequired: true, min: 0 } })),
    currencyCode: text(ro({ defaultValue: 'USD' })),
    reference: text(commandOnly),
    providerReference: text(commandOnly),
    paidAt: timestamp(commandOnly),
    reportedByGuardian: checkbox({ defaultValue: false, ...commandOnly }),
    decidedAt: timestamp(commandOnly),
    note: text(commandOnly),
    ...trackingFields,
  },
})

const adapter = { validation: { isRequired: true }, defaultValue: 'manual', ui: { description: 'Name of the payment adapter this operation uses.' } } as const

export const PaymentProvider = list({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canManagePayments),
  ui: { listView: { initialColumns: ['name', 'code', 'isInstalled'] } },
  fields: {
    profile: profileField('paymentProviders'),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true, match: { regex: /^pp_(manual|stripe)$/, explanation: 'Provider code is pp_manual or pp_stripe.' } } }),
    isInstalled: checkbox({ defaultValue: true }),
    createPaymentFunction: text(adapter),
    capturePaymentFunction: text(adapter),
    refundPaymentFunction: text(adapter),
    getPaymentStatusFunction: text(adapter),
    generatePaymentLinkFunction: text(adapter),
    handleWebhookFunction: text(adapter),
    paymentSessions: relationship({ ref: 'PaymentSession.paymentProvider', many: true, ...commandOnly }),
    ...trackingFields,
  },
})

/** A Stripe Checkout opened for one target: a session, a package purchase or an invoice. */
export const PaymentSession = list({
  access: ownReadOnly(permissions.canReadPayments),
  ui: { listView: { initialColumns: ['target', 'status', 'amountCents', 'expiresAt'] } },
  fields: {
    profile: profileField('paymentSessions'),
    target: readonlyEnum(['session', 'package', 'invoice'], 'session'),
    session: relationship({ ref: 'Session.paymentSessions', ...commandOnly }),
    purchase: relationship({ ref: 'PackagePurchase.paymentSessions', ...commandOnly }),
    invoice: relationship({ ref: 'Invoice.paymentSessions', ...commandOnly }),
    paymentProvider: relationship({ ref: 'PaymentProvider.paymentSessions', ...commandOnly }),
    status: readonlyEnum(['pending', 'captured', 'expired', 'cancelled', 'refunded'], 'pending'),
    amountCents: integer(ro({ validation: { isRequired: true, min: 0 } })),
    currencyCode: text(ro({ defaultValue: 'USD' })),
    providerPaymentId: text({ ...commandOnly, isIndexed: true }),
    expiresAt: timestamp(commandOnly),
    capturedAt: timestamp(commandOnly),
    ...trackingFields,
  },
})

/** Webhook inbox (Barbershop): one row per provider event, so an event settles once. Server only. */
export const PaymentWebhookEvent = list({
  access: { operation: { query: no, create: no, update: no, delete: no } },
  ui: { isHidden: true },
  fields: {
    replayKey: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    providerCode: text({ validation: { isRequired: true } }),
    providerEventId: text({ validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true } }),
    payloadHash: text({ validation: { isRequired: true } }),
    processedAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})

export const Expense = list({
  hooks: attachProfileHook,
  access: ownCrud(permissions.canViewEarnings),
  ui: { listView: { initialColumns: ['spentOn', 'category', 'amountCents', 'note'] } },
  fields: {
    profile: profileField('expenses'),
    spentOn: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
    category: select({ type: 'enum', options: opt('travel', 'materials', 'software', 'room', 'other'), defaultValue: 'other', validation: { isRequired: true } }),
    amountCents: integer({ validation: { isRequired: true, min: 0, max: 100_000_000 } }),
    note: text(),
    ...trackingFields,
  },
})

/** Every email the product tried to send: sent, failed, or skipped (no mail set up). */
export const NotificationLog = list({
  access: ownReadOnly(permissions.canManageBusiness),
  ui: { listView: { initialColumns: ['kind', 'to', 'subject', 'status', 'createdAt'] } },
  fields: {
    profile: profileField('notifications'),
    kind: text(ro({ validation: { isRequired: true } })),
    to: text(commandOnly),
    subject: text(commandOnly),
    link: text(commandOnly),
    status: readonlyEnum(['sent', 'failed', 'skipped'], 'skipped'),
    error: text(commandOnly),
    session: relationship({ ref: 'Session', ...commandOnly }),
    invoice: relationship({ ref: 'Invoice', ...commandOnly }),
    ...trackingFields,
  },
})
