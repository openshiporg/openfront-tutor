'use server'

import { cancelMyBooking, confirmBookingPayment, payForBooking, rescheduleMyBooking } from './public'
import { cancelMySession, confirmSessionPayment, payForSession, rescheduleMySession } from './account'

/** One booking, reached either by its private link (token) or from a signed-in account. */
export type SessionAccess = { id: string; token?: string | null }

export async function startPayment(a: SessionAccess) {
  return a.token ? payForBooking(a.id, a.token) : payForSession(a.id)
}

export async function confirmPayment(a: SessionAccess) {
  return a.token ? confirmBookingPayment(a.id, a.token) : confirmSessionPayment(a.id)
}

export async function cancelBooking(a: SessionAccess, reason: string) {
  return a.token ? cancelMyBooking(a.id, a.token, reason) : cancelMySession(a.id, reason)
}

export async function rescheduleBooking(a: SessionAccess, startsAt: string) {
  return a.token ? rescheduleMyBooking(a.id, a.token, startsAt) : rescheduleMySession(a.id, startsAt)
}
