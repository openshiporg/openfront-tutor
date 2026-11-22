import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import type { PrismaClient } from '@prisma/client'

import redirectToInit from './redirectToInit'
import type { Session } from '../access'
import { CommandError, fail, ok } from '../utils/business'
import * as pub from '../utils/publicOps'
import { claimFamilyAccount, handInHomework, requireFamily, saveStudent, submitReview, updateMyContact } from '../utils/family'
import { guarded } from '../utils/business'
import { tutorTypeDefs, tutorResolvers } from './tutor'

const graphql = String.raw

export type Ctx = { prisma: PrismaClient; session?: Session; sudo(): any }

export const run = async <T>(work: () => Promise<T>) => {
  try { return ok(await work()) } catch (error) {
    if (!(error instanceof CommandError)) console.error('[tutor] command failed', error instanceof Error ? error.stack || error.message : 'unknown')
    return fail(error)
  }
}

type A = Record<string, any>

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      type CommandResult { success: Boolean!, error: String, data: JSON }
      input VisitorInput { guardianName: String!, email: String, phone: String, studentName: String!, studentLevel: String, message: String, timezone: String }
      input StudentInput { id: ID, firstName: String!, lastName: String, level: String, school: String, goals: String, birthYear: Int }
      ${tutorTypeDefs.inputs}
      input ContactInput { guardianName: String, phone: String, secondContactName: String, secondContactPhone: String, address: String, timezone: String }

      type Query {
        redirectToInit: Boolean
        publicTutor(slug: String!): JSON
        homeTutor: JSON
        publicSlots(slug: String!, sessionTypeId: ID!, date: String!, timezone: String, excludeSessionId: ID, token: String): CommandResult!
        publicOpenDays(slug: String!, sessionTypeId: ID!, from: String!, days: Int, timezone: String): CommandResult!
        publicBooking(id: ID!, token: String!): CommandResult!
        publicInvoice(id: ID!, token: String!): CommandResult!
        myFamily: CommandResult!
        mySessions(range: String): CommandResult!
        mySession(id: ID!): CommandResult!
        myStudents: CommandResult!
        myHomework(status: String): CommandResult!
        myPackages: CommandResult!
        myInvoices: CommandResult!
        myInvoice(id: ID!): CommandResult!
        myResources: CommandResult!
        myProgress(studentId: ID!): CommandResult!
        myCalendarFeedUrl: CommandResult!
        ${tutorTypeDefs.query}
      }
      type Mutation {
        bookFirstSession(slug: String!, sessionTypeId: ID!, startsAt: String!, visitor: VisitorInput!, mode: String): CommandResult!
        payForBooking(id: ID!, token: String!): CommandResult!
        confirmBookingPayment(id: ID!, token: String!): CommandResult!
        cancelMyBooking(id: ID!, token: String!, reason: String): CommandResult!
        rescheduleMyBooking(id: ID!, token: String!, startsAt: String!): CommandResult!
        sendInquiry(slug: String!, name: String!, email: String, phone: String, studentLevel: String, subject: String, message: String): CommandResult!
        claimFamilyAccount(familyId: ID, token: String, bookingId: ID, bookingToken: String, email: String, name: String, password: String!): CommandResult!
        payInvoiceByLink(id: ID!, token: String!): CommandResult!
        bookSession(sessionTypeId: ID!, startsAt: String!, studentIds: [ID!]!, message: String, mode: String): CommandResult!
        cancelSession(id: ID!, reason: String): CommandResult!
        rescheduleSession(id: ID!, startsAt: String!): CommandResult!
        payForSession(id: ID!): CommandResult!
        confirmSessionPayment(id: ID!): CommandResult!
        saveStudent(student: StudentInput!): CommandResult!
        handInHomework(id: ID!, comment: String, url: String): CommandResult!
        buyPackage(packageId: ID!, method: String!): CommandResult!
        confirmPackagePayment(purchaseId: ID!): CommandResult!
        payInvoice(id: ID!): CommandResult!
        confirmInvoicePayment(id: ID!, token: String): CommandResult!
        reportPayment(target: String!, targetId: ID!, amountCents: Int!, method: String!, reference: String!): CommandResult!
        submitReview(rating: Int!, body: String, displayName: String): CommandResult!
        updateMyContact(contact: ContactInput!): CommandResult!
        ${tutorTypeDefs.mutation}
      }
    `,
    resolvers: {
      Query: {
        redirectToInit,
        publicTutor: (_r: unknown, a: A, c: Ctx) => pub.publicTutor(c.prisma, a.slug),
        homeTutor: (_r: unknown, _a: A, c: Ctx) => pub.homeTutor(c.prisma),
        publicSlots: (_r: unknown, a: A, c: Ctx) => run(() => pub.publicSlots(c.prisma, a as never, c.session)),
        publicOpenDays: (_r: unknown, a: A, c: Ctx) => run(() => pub.publicOpenDays(c.prisma, a as never)),
        publicBooking: (_r: unknown, a: A, c: Ctx) => run(() => pub.publicBooking(c.prisma, a.id, a.token)),
        publicInvoice: (_r: unknown, a: A, c: Ctx) => run(() => pub.publicInvoice(c.prisma, a.id, a.token)),
        myFamily: (_r: unknown, _a: A, c: Ctx) => run(() => pub.myFamily(c.prisma, c.session)),
        mySessions: (_r: unknown, a: A, c: Ctx) => run(() => pub.mySessions(c.prisma, c.session, a.range)),
        mySession: (_r: unknown, a: A, c: Ctx) => run(() => pub.mySession(c.prisma, c.session, a.id)),
        myStudents: (_r: unknown, _a: A, c: Ctx) => run(() => pub.myStudents(c.prisma, c.session)),
        myHomework: (_r: unknown, a: A, c: Ctx) => run(() => pub.myHomework(c.prisma, c.session, a.status)),
        myPackages: (_r: unknown, _a: A, c: Ctx) => run(() => pub.myPackages(c.prisma, c.session)),
        myInvoices: (_r: unknown, _a: A, c: Ctx) => run(() => pub.myInvoices(c.prisma, c.session)),
        myInvoice: (_r: unknown, a: A, c: Ctx) => run(() => pub.myInvoice(c.prisma, c.session, a.id)),
        myResources: (_r: unknown, _a: A, c: Ctx) => run(() => pub.myResources(c.prisma, c.session)),
        myProgress: (_r: unknown, a: A, c: Ctx) => run(() => pub.myProgress(c.prisma, c.session, a.studentId)),
        myCalendarFeedUrl: (_r: unknown, _a: A, c: Ctx) => run(() => pub.myCalendarFeedUrl(c.prisma, c.session)),
        ...tutorResolvers.Query,
      },
      Mutation: {
        bookFirstSession: (_r: unknown, a: A, c: Ctx) => run(() => pub.bookFirstSession(c.prisma, { slug: a.slug, sessionTypeId: a.sessionTypeId, startsAt: a.startsAt, mode: a.mode, ...a.visitor })),
        payForBooking: (_r: unknown, a: A, c: Ctx) => run(() => pub.payForBooking(c.prisma, a.id, a.token)),
        confirmBookingPayment: (_r: unknown, a: A, c: Ctx) => run(() => pub.confirmBookingPayment(c.prisma, a.id, a.token)),
        cancelMyBooking: (_r: unknown, a: A, c: Ctx) => run(() => pub.cancelMyBooking(c.prisma, a.id, a.token, a.reason)),
        rescheduleMyBooking: (_r: unknown, a: A, c: Ctx) => run(() => pub.rescheduleMyBooking(c.prisma, a.id, a.token, a.startsAt)),
        sendInquiry: (_r: unknown, a: A, c: Ctx) => run(() => pub.sendInquiry(c.prisma, a as never)),
        // The token is the authority; Keystone's sudo db API creates the user so the password field hashes it.
        claimFamilyAccount: (_r: unknown, a: A, c: Ctx) => run(() => claimFamilyAccount(c.prisma, c, a as never)),
        payInvoiceByLink: (_r: unknown, a: A, c: Ctx) => run(() => pub.payInvoiceByToken(c.prisma, a.id, a.token)),
        bookSession: (_r: unknown, a: A, c: Ctx) => run(() => pub.bookSession(c.prisma, c.session, a as never)),
        cancelSession: (_r: unknown, a: A, c: Ctx) => run(() => pub.cancelMySession(c.prisma, c.session, a.id, a.reason)),
        rescheduleSession: (_r: unknown, a: A, c: Ctx) => run(() => pub.rescheduleMySession(c.prisma, c.session, a.id, a.startsAt)),
        payForSession: (_r: unknown, a: A, c: Ctx) => run(() => pub.payForSession(c.prisma, c.session, a.id)),
        confirmSessionPayment: (_r: unknown, a: A, c: Ctx) => run(() => pub.confirmSessionPayment(c.prisma, c.session, a.id)),
        saveStudent: (_r: unknown, a: A, c: Ctx) => run(async () => saveStudent(guarded(c.prisma), await requireFamily(guarded(c.prisma), c.session), a.student)),
        handInHomework: (_r: unknown, a: A, c: Ctx) => run(async () => handInHomework(guarded(c.prisma), (await requireFamily(guarded(c.prisma), c.session)).id, a as never)),
        buyPackage: (_r: unknown, a: A, c: Ctx) => run(() => pub.buyPackage(c.prisma, c.session, a.packageId, a.method)),
        confirmPackagePayment: (_r: unknown, a: A, c: Ctx) => run(() => pub.confirmPackagePayment(c.prisma, c.session, a.purchaseId)),
        payInvoice: (_r: unknown, a: A, c: Ctx) => run(() => pub.payInvoice(c.prisma, c.session, a.id)),
        confirmInvoicePayment: (_r: unknown, a: A, c: Ctx) => run(() => pub.confirmInvoicePayment(c.prisma, c.session, a.id, a.token)),
        reportPayment: (_r: unknown, a: A, c: Ctx) => run(() => pub.reportPayment(c.prisma, c.session, a as never)),
        submitReview: (_r: unknown, a: A, c: Ctx) => run(async () => submitReview(c.prisma, await requireFamily(guarded(c.prisma), c.session), a as never)),
        updateMyContact: (_r: unknown, a: A, c: Ctx) => run(async () => updateMyContact(guarded(c.prisma), (await requireFamily(guarded(c.prisma), c.session)).id, a.contact)),
        ...tutorResolvers.Mutation,
      },
    },
  })
}
