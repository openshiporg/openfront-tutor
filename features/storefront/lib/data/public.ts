'use server'

import { command, jsonQuery } from './request'
import type { Checkout, InvoiceDetail, PublicTutor, SessionDetail } from '../types'

const TUTOR_FIELDS = '' // publicTutor and homeTutor return JSON; no selection set.

/** S1: the tutor on `/` (the first tutor with booking open on this deployment). */
export async function getHomeTutor() {
  return jsonQuery<PublicTutor>(`query { homeTutor${TUTOR_FIELDS} }`, {}, 'homeTutor')
}

/** S1: a tutor's page by slug. */
export async function getPublicTutor(slug: string) {
  return jsonQuery<PublicTutor>('query($slug: String!) { publicTutor(slug: $slug) }', { slug }, 'publicTutor')
}

export type SlotDay = { date: string; timezone: string; tutorTimezone: string; slots: string[] }

/** S2/S5/S10/S11: open times on a day, as the viewer sees it. */
export async function loadSlots(input: { slug: string; sessionTypeId: string; date: string; timezone: string; excludeSessionId?: string | null; token?: string | null }) {
  return command<SlotDay>(
    'query($slug: String!, $sessionTypeId: ID!, $date: String!, $timezone: String, $excludeSessionId: ID, $token: String) { publicSlots(slug: $slug, sessionTypeId: $sessionTypeId, date: $date, timezone: $timezone, excludeSessionId: $excludeSessionId, token: $token) { success error data } }',
    { ...input, excludeSessionId: input.excludeSessionId || null, token: input.token || null }, 'publicSlots')
}

/** Days with at least one open time (for the day picker). */
export async function loadOpenDays(input: { slug: string; sessionTypeId: string; from: string; days: number; timezone: string }) {
  return command<{ days: string[] }>(
    'query($slug: String!, $sessionTypeId: ID!, $from: String!, $days: Int, $timezone: String) { publicOpenDays(slug: $slug, sessionTypeId: $sessionTypeId, from: $from, days: $days, timezone: $timezone) { success error data } }',
    input, 'publicOpenDays')
}

export type Visitor = { guardianName: string; email?: string; phone?: string; studentName: string; studentLevel?: string; message?: string; timezone?: string }
export type FirstBooking = { bookingId: string; token: string; status: string; funding: string; needsPayment: boolean; holdEndsAt: string | null; bookingUrl: string }

/** S2: a new family books a first session. */
export async function bookFirstSession(input: { slug: string; sessionTypeId: string; startsAt: string; visitor: Visitor; mode?: string | null }) {
  return command<FirstBooking>(
    'mutation($slug: String!, $sessionTypeId: ID!, $startsAt: String!, $visitor: VisitorInput!, $mode: String) { bookFirstSession(slug: $slug, sessionTypeId: $sessionTypeId, startsAt: $startsAt, visitor: $visitor, mode: $mode) { success error data } }',
    { ...input, mode: input.mode || null }, 'bookFirstSession')
}

/** S4: booking by private link. */
export async function getPublicBooking(id: string, token: string) {
  return command<SessionDetail>('query($id: ID!, $token: String!) { publicBooking(id: $id, token: $token) { success error data } }', { id, token }, 'publicBooking')
}

/** S3. */
export async function payForBooking(id: string, token: string) {
  return command<Checkout>('mutation($id: ID!, $token: String!) { payForBooking(id: $id, token: $token) { success error data } }', { id, token }, 'payForBooking')
}

export async function confirmBookingPayment(id: string, token: string) {
  return command<{ paid: boolean }>('mutation($id: ID!, $token: String!) { confirmBookingPayment(id: $id, token: $token) { success error data } }', { id, token }, 'confirmBookingPayment')
}

export type CancelResult = { status: string; charged: string; refundedCents: number }
export type RescheduleResult = { id: string; startsAt: string; endsAt: string; from: string }

/** S5. */
export async function cancelMyBooking(id: string, token: string, reason: string) {
  return command<CancelResult>('mutation($id: ID!, $token: String!, $reason: String) { cancelMyBooking(id: $id, token: $token, reason: $reason) { success error data } }', { id, token, reason }, 'cancelMyBooking')
}

export async function rescheduleMyBooking(id: string, token: string, startsAt: string) {
  return command<RescheduleResult>('mutation($id: ID!, $token: String!, $startsAt: String!) { rescheduleMyBooking(id: $id, token: $token, startsAt: $startsAt) { success error data } }', { id, token, startsAt }, 'rescheduleMyBooking')
}

/** S6. */
export async function sendInquiry(input: { slug: string; name: string; email?: string; phone?: string; studentLevel?: string; subject?: string; message?: string }) {
  return command<{ id: string; sent: boolean }>(
    'mutation($slug: String!, $name: String!, $email: String, $phone: String, $studentLevel: String, $subject: String, $message: String) { sendInquiry(slug: $slug, name: $name, email: $email, phone: $phone, studentLevel: $studentLevel, subject: $subject, message: $message) { success error data } }',
    input, 'sendInquiry')
}

/** S16 by private link. */
export async function getPublicInvoice(id: string, token: string) {
  return command<InvoiceDetail>('query($id: ID!, $token: String!) { publicInvoice(id: $id, token: $token) { success error data } }', { id, token }, 'publicInvoice')
}

export async function payInvoiceByLink(id: string, token: string) {
  return command<Checkout>('mutation($id: ID!, $token: String!) { payInvoiceByLink(id: $id, token: $token) { success error data } }', { id, token }, 'payInvoiceByLink')
}

export async function confirmInvoiceByLink(id: string, token: string) {
  return command<{ paid: boolean; status: string; balanceCents: number }>('mutation($id: ID!, $token: String) { confirmInvoicePayment(id: $id, token: $token) { success error data } }', { id, token }, 'confirmInvoicePayment')
}
