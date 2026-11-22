import type { Ctx } from './index'
import { CommandError, fail, ok } from '../utils/business'
import * as t from '../utils/tutorOps'

/** Tutor (dashboard) operations of §5.7, each a CommandResult. */

const run = async <T>(work: () => Promise<T>) => {
  try { return ok(await work()) } catch (error) {
    if (!(error instanceof CommandError)) console.error('[tutor] command failed', error instanceof Error ? error.stack || error.message : 'unknown')
    return fail(error)
  }
}

export const tutorTypeDefs = {
  query: `
    myBusiness: CommandResult!
    today: CommandResult!
    calendar(from: String!, to: String!): CommandResult!
    tutorSession(id: ID!): CommandResult!
    familiesOverview(status: String, search: String): CommandResult!
    tutorFamily(id: ID!): CommandResult!
    tutorStudent(id: ID!): CommandResult!
    homeworkBoard: CommandResult!
    readyToInvoice: CommandResult!
    tutorInvoice(id: ID!): CommandResult!
    myEarnings(from: String!, to: String!): CommandResult!
    paymentSettings: CommandResult!
    tutorCalendarFeedUrl: CommandResult!
    exportCsv(kind: String!, from: String!, to: String!): CommandResult!
  `,
  mutation: `
    setUpMyBusiness(businessName: String!, tutorName: String, slug: String!, timezone: String!, currencyCode: String, country: String, subjects: [String!], levels: String, teachesOnline: Boolean, teachesInPerson: Boolean, hourlyRateCents: Int, typicalSetup: Boolean, email: String): CommandResult!
    createSessionAsTutor(familyId: ID!, sessionTypeId: ID!, startsAt: String!, studentIds: [ID!]!, mode: String, meetingUrl: String, notify: Boolean): CommandResult!
    completeSession(sessionId: ID!, note: SessionNoteInput, homework: [HomeworkInput!], share: Boolean): CommandResult!
    saveSessionNote(sessionId: ID!, covered: String, wentWell: String, workOnNext: String, effort: Int, privateNote: String, share: Boolean): CommandResult!
    markNoShow(sessionId: ID!): CommandResult!
    cancelSessionAsTutor(sessionId: ID!, reason: String, notify: Boolean): CommandResult!
    rescheduleSessionAsTutor(sessionId: ID!, startsAt: String!, notify: Boolean): CommandResult!
    excuseSession(sessionId: ID!): CommandResult!
    reopenSession(sessionId: ID!): CommandResult!
    sessionLink(sessionId: ID!): CommandResult!
    saveSeries(id: ID, familyId: ID!, sessionTypeId: ID!, studentIds: [ID!]!, dayOfWeek: Int!, startMinute: Int!, startsOn: String!, endsOn: String, mode: String): CommandResult!
    pauseSeries(id: ID!, resume: Boolean): CommandResult!
    endSeries(id: ID!): CommandResult!
    clearSkippedWeek(id: ID!, date: String!): CommandResult!
    inviteFamily(familyId: ID!, send: Boolean): CommandResult!
    saveStudentAsTutor(student: TutorStudentInput!): CommandResult!
    convertInquiry(id: ID!, studentName: String, billingMode: String): CommandResult!
    setInquiryStatus(id: ID!, status: String!): CommandResult!
    reviewHomework(id: ID!, feedback: String): CommandResult!
    moderateReview(id: ID!, status: String!): CommandResult!
    sellPackage(familyId: ID!, packageId: ID!, method: String!, reference: String): CommandResult!
    cancelPackagePurchase(purchaseId: ID!): CommandResult!
    refundPackage(purchaseId: ID!): CommandResult!
    adjustMinutes(purchaseId: ID!, minutes: Int!, reason: String!): CommandResult!
    confirmPayment(paymentId: ID!): CommandResult!
    rejectPayment(paymentId: ID!, note: String): CommandResult!
    recordPayment(target: String!, targetId: ID!, amountCents: Int, method: String!, reference: String): CommandResult!
    refundPayment(paymentId: ID!, amountCents: Int, note: String): CommandResult!
    createInvoice(familyId: ID!, sessionIds: [ID!], includeFlatFee: Boolean, extraLines: [InvoiceLineInput!], dueDays: Int, note: String): CommandResult!
    addInvoiceLine(invoiceId: ID!, line: InvoiceLineInput!): CommandResult!
    removeInvoiceLine(lineId: ID!): CommandResult!
    sendInvoice(invoiceId: ID!, send: Boolean): CommandResult!
    invoiceLink(invoiceId: ID!): CommandResult!
    voidInvoice(invoiceId: ID!): CommandResult!
  `,
  inputs: `
    input SessionNoteInput { covered: String, wentWell: String, workOnNext: String, effort: Int, privateNote: String }
    input HomeworkInput { title: String!, instructions: String, dueAt: String, linkUrl: String, studentId: ID }
    input InvoiceLineInput { description: String!, quantity: Int, unitCents: Int! }
    input TutorStudentInput { id: ID, familyId: ID!, firstName: String!, lastName: String, level: String, school: String, goals: String, needs: String, meetingUrl: String, birthYear: Int, status: String, subjectIds: [ID!] }
  `,
}

type A = Record<string, any>
const q = (fn: (c: Ctx, a: A) => Promise<unknown>) => (_r: unknown, a: A, c: Ctx) => run(() => fn(c, a))

export const tutorResolvers = {
  Query: {
    myBusiness: q((c) => t.myBusiness(c.prisma, c.session)),
    today: q((c) => t.today(c.prisma, c.session)),
    calendar: q((c, a) => t.calendar(c.prisma, c.session, a as never)),
    tutorSession: q((c, a) => t.tutorSession(c.prisma, c.session, a.id)),
    familiesOverview: q((c, a) => t.familiesOverview(c.prisma, c.session, a)),
    tutorFamily: q((c, a) => t.tutorFamily(c.prisma, c.session, a.id)),
    tutorStudent: q((c, a) => t.tutorStudent(c.prisma, c.session, a.id)),
    homeworkBoard: q((c) => t.homeworkBoard(c.prisma, c.session)),
    readyToInvoice: q((c) => t.readyToInvoice(c.prisma, c.session)),
    tutorInvoice: q((c, a) => t.tutorInvoice(c.prisma, c.session, a.id)),
    myEarnings: q((c, a) => t.myEarnings(c.prisma, c.session, a as never)),
    paymentSettings: q((c) => t.paymentSettings(c.prisma, c.session)),
    tutorCalendarFeedUrl: q((c) => t.tutorCalendarFeedUrl(c.prisma, c.session)),
    exportCsv: q((c, a) => t.exportCsv(c.prisma, c.session, a as never)),
  },
  Mutation: {
    setUpMyBusiness: q((c, a) => t.setUpMyBusiness(c.prisma, c.session, a as never)),
    createSessionAsTutor: q((c, a) => t.createSessionAsTutor(c.prisma, c.session, a as never)),
    completeSession: q((c, a) => t.completeSession(c.prisma, c.session, a as never)),
    saveSessionNote: q((c, a) => t.saveSessionNote(c.prisma, c.session, a as never)),
    markNoShow: q((c, a) => t.markNoShow(c.prisma, c.session, a.sessionId)),
    cancelSessionAsTutor: q((c, a) => t.cancelSessionAsTutor(c.prisma, c.session, a.sessionId, a.reason, a.notify)),
    rescheduleSessionAsTutor: q((c, a) => t.rescheduleSessionAsTutor(c.prisma, c.session, a.sessionId, a.startsAt, a.notify)),
    excuseSession: q((c, a) => t.excuseSession(c.prisma, c.session, a.sessionId)),
    reopenSession: q((c, a) => t.reopenSession(c.prisma, c.session, a.sessionId)),
    sessionLink: q((c, a) => t.sessionLink(c.prisma, c.session, a.sessionId)),
    saveSeries: q((c, a) => t.saveSeries(c.prisma, c.session, a as never)),
    pauseSeries: q((c, a) => t.pauseSeries(c.prisma, c.session, a.id, a.resume)),
    endSeries: q((c, a) => t.endSeries(c.prisma, c.session, a.id)),
    clearSkippedWeek: q((c, a) => t.clearSkippedWeek(c.prisma, c.session, a.id, a.date)),
    inviteFamily: q((c, a) => t.inviteFamily(c.prisma, c.session, a.familyId, a.send)),
    saveStudentAsTutor: q((c, a) => t.saveStudentAsTutor(c.prisma, c.session, a.student)),
    convertInquiry: q((c, a) => t.convertInquiry(c.prisma, c.session, a as never)),
    setInquiryStatus: q((c, a) => t.setInquiryStatus(c.prisma, c.session, a.id, a.status)),
    reviewHomework: q((c, a) => t.reviewHomework(c.prisma, c.session, a.id, a.feedback)),
    moderateReview: q((c, a) => t.moderateReview(c.prisma, c.session, a.id, a.status)),
    sellPackage: q((c, a) => t.sellPackage(c.prisma, c.session, a as never)),
    cancelPackagePurchase: q((c, a) => t.cancelPurchase(c.prisma, c.session, a.purchaseId)),
    refundPackage: q((c, a) => t.refundPackage(c.prisma, c.session, a.purchaseId)),
    adjustMinutes: q((c, a) => t.adjustMinutes(c.prisma, c.session, a as never)),
    confirmPayment: q((c, a) => t.confirmPayment(c.prisma, c.session, a.paymentId)),
    rejectPayment: q((c, a) => t.rejectPayment(c.prisma, c.session, a.paymentId, a.note)),
    recordPayment: q((c, a) => t.recordPayment(c.prisma, c.session, a as never)),
    refundPayment: q((c, a) => t.refundPayment(c.prisma, c.session, a.paymentId, a.amountCents, a.note)),
    createInvoice: q((c, a) => t.createInvoice(c.prisma, c.session, a as never)),
    addInvoiceLine: q((c, a) => t.addInvoiceLine(c.prisma, c.session, a.invoiceId, a.line)),
    removeInvoiceLine: q((c, a) => t.removeInvoiceLine(c.prisma, c.session, a.lineId)),
    sendInvoice: q((c, a) => t.sendInvoice(c.prisma, c.session, a.invoiceId, a.send)),
    invoiceLink: q((c, a) => t.invoiceLinkFor(c.prisma, c.session, a.invoiceId)),
    voidInvoice: q((c, a) => t.voidInvoice(c.prisma, c.session, a.invoiceId)),
  },
}
