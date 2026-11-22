'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { command } from './request'
import type { Checkout, FamilyStudent, Homework, InvoiceDetail, InvoiceRow, MyFamily, MyPackages, Progress, Resource, SessionDetail, FamilySession } from '../types'
import type { CancelResult, RescheduleResult } from './public'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SESSION_COOKIE = 'keystonejs-session'

export type Viewer = { id: string; name: string; email: string; isTutor: boolean } | null

/** Who is signed in (a family, the tutor, or nobody). */
export async function getViewer(): Promise<Viewer> {
  const r = await keystoneClient<{ authenticatedItem: { id: string; name: string; email: string; role: { canAccessDashboard: boolean } | null } | null }>(
    'query { authenticatedItem { ... on User { id name email role { canAccessDashboard } } } }', {}, { cache: 'no-store' })
  if (!r.success || !r.data.authenticatedItem) return null
  const u = r.data.authenticatedItem
  return { id: u.id, name: u.name, email: u.email, isTutor: Boolean(u.role?.canAccessDashboard) }
}

async function setSession(token: string) {
  ;(await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
}

/** S8: sign in with Keystone's own password auth. */
export async function signIn(email: string, password: string): Promise<{ ok: boolean; error: string | null; isTutor?: boolean }> {
  const e = email.trim().toLowerCase()
  if (!EMAIL.test(e) || !password || password.length > 1000) return { ok: false, error: 'Enter your email and password.' }
  const r = await keystoneClient<{ authenticateUserWithPassword: { sessionToken?: string; message?: string; item?: { role: { canAccessDashboard: boolean } | null } } | null }>(
    'mutation($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { ... on UserAuthenticationWithPasswordSuccess { sessionToken item { role { canAccessDashboard } } } ... on UserAuthenticationWithPasswordFailure { message } } }',
    { email: e, password })
  if (!r.success) return { ok: false, error: r.error }
  const token = r.data.authenticateUserWithPassword?.sessionToken
  if (!token) return { ok: false, error: 'That email and password do not match. Try again, or reset your password.' }
  await setSession(token)
  revalidatePath('/', 'layout')
  return { ok: true, error: null, isTutor: Boolean(r.data.authenticateUserWithPassword?.item?.role?.canAccessDashboard) }
}

/** S8: sign out. */
export async function signOut() {
  await keystoneClient('mutation { endSession }')
  ;(await cookies()).delete(SESSION_COOKIE)
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** S8: request a reset link (same answer whether the account exists or not). */
export async function requestPasswordReset(email: string) {
  const e = email.trim().toLowerCase()
  if (!EMAIL.test(e)) return { ok: false, error: 'Enter the email you sign in with.' }
  const r = await keystoneClient<{ sendUserPasswordResetLink: boolean }>('mutation($email: String!) { sendUserPasswordResetLink(email: $email) }', { email: e })
  if (!r.success) return { ok: false, error: 'The reset email could not be sent from this site right now. Try again later, or ask your tutor to send you a new account link.' }
  return { ok: true, error: null }
}

/** S8: set a new password with the emailed token. */
export async function redeemPasswordReset(email: string, token: string, password: string) {
  const e = email.trim().toLowerCase()
  if (!EMAIL.test(e) || !token) return { ok: false, error: 'This reset link is not complete. Request a new one.' }
  if (password.length < 8) return { ok: false, error: 'Choose a password of at least 8 characters.' }
  const r = await keystoneClient<{ redeemUserPasswordResetToken: { code: string; message: string } | null }>(
    'mutation($email: String!, $token: String!, $password: String!) { redeemUserPasswordResetToken(email: $email, token: $token, password: $password) { code message } }', { email: e, token, password })
  if (!r.success) return { ok: false, error: r.error }
  if (r.data.redeemUserPasswordResetToken) return { ok: false, error: 'This reset link is not valid or has expired. Request a new one.' }
  return { ok: true, error: null }
}

/** S7: create the family account from a booking or an invite, then sign in. */
export async function claimAccount(input: { password: string; email?: string; name?: string; bookingId?: string; bookingToken?: string; familyId?: string; token?: string }) {
  const r = await command<{ email: string }>(
    'mutation($password: String!, $email: String, $name: String, $bookingId: ID, $bookingToken: String, $familyId: ID, $token: String) { claimFamilyAccount(password: $password, email: $email, name: $name, bookingId: $bookingId, bookingToken: $bookingToken, familyId: $familyId, token: $token) { success error data } }',
    { password: input.password, email: input.email || null, name: input.name || null, bookingId: input.bookingId || null, bookingToken: input.bookingToken || null, familyId: input.familyId || null, token: input.token || null },
    'claimFamilyAccount')
  if (!r.success || !r.data) return { ok: false, error: r.error }
  const s = await signIn(r.data.email, input.password)
  return s.ok ? { ok: true, error: null } : { ok: false, error: `Your account was created. ${s.error ?? ''} Sign in with ${r.data.email}.` }
}

// ---------- S9 to S21 (signed in) ----------

export async function getMyFamily() {
  return command<MyFamily>('query { myFamily { success error data } }', {}, 'myFamily')
}

export async function getMySessions(range: 'upcoming' | 'past' | 'all') {
  return command<{ range: string; timezone: string; currencyCode: string; sessions: FamilySession[] }>('query($range: String) { mySessions(range: $range) { success error data } }', { range }, 'mySessions')
}

export async function getMySession(id: string) {
  return command<SessionDetail>('query($id: ID!) { mySession(id: $id) { success error data } }', { id }, 'mySession')
}

export type BookedSession = { sessionId: string; status: string; funding: string; needsPayment: boolean; holdEndsAt: string | null; packageMinutesLeft: number | null; priceCents: number }

export async function bookSession(input: { sessionTypeId: string; startsAt: string; studentIds: string[]; message?: string; mode?: string | null }) {
  return command<BookedSession>(
    'mutation($sessionTypeId: ID!, $startsAt: String!, $studentIds: [ID!]!, $message: String, $mode: String) { bookSession(sessionTypeId: $sessionTypeId, startsAt: $startsAt, studentIds: $studentIds, message: $message, mode: $mode) { success error data } }',
    { ...input, mode: input.mode || null }, 'bookSession')
}

export async function cancelMySession(id: string, reason: string) {
  return command<CancelResult>('mutation($id: ID!, $reason: String) { cancelSession(id: $id, reason: $reason) { success error data } }', { id, reason }, 'cancelSession')
}

export async function rescheduleMySession(id: string, startsAt: string) {
  return command<RescheduleResult>('mutation($id: ID!, $startsAt: String!) { rescheduleSession(id: $id, startsAt: $startsAt) { success error data } }', { id, startsAt }, 'rescheduleSession')
}

export async function payForSession(id: string) {
  return command<Checkout>('mutation($id: ID!) { payForSession(id: $id) { success error data } }', { id }, 'payForSession')
}

export async function confirmSessionPayment(id: string) {
  return command<{ paid: boolean }>('mutation($id: ID!) { confirmSessionPayment(id: $id) { success error data } }', { id }, 'confirmSessionPayment')
}

export async function getMyStudents() {
  return command<{ students: FamilyStudent[] }>('query { myStudents { success error data } }', {}, 'myStudents')
}

export async function saveStudent(student: { id?: string; firstName: string; lastName?: string; level?: string; school?: string; goals?: string; birthYear?: number | null }) {
  return command<{ id: string }>('mutation($student: StudentInput!) { saveStudent(student: $student) { success error data } }', { student }, 'saveStudent')
}

export async function getMyHomework() {
  return command<{ homework: Homework[] }>('query { myHomework { success error data } }', {}, 'myHomework')
}

export async function handInHomework(id: string, comment: string, url: string) {
  return command<{ id: string; status: string }>('mutation($id: ID!, $comment: String, $url: String) { handInHomework(id: $id, comment: $comment, url: $url) { success error data } }', { id, comment, url }, 'handInHomework')
}

export async function getMyProgress(studentId: string) {
  return command<Progress>('query($studentId: ID!) { myProgress(studentId: $studentId) { success error data } }', { studentId }, 'myProgress')
}

export async function getMyPackages() {
  return command<MyPackages>('query { myPackages { success error data } }', {}, 'myPackages')
}

export async function buyPackage(packageId: string, method: 'card' | 'direct') {
  return command<{ purchaseId: string; status: string; paymentInstructions: string | null; checkoutUrl: string | null }>(
    'mutation($packageId: ID!, $method: String!) { buyPackage(packageId: $packageId, method: $method) { success error data } }', { packageId, method }, 'buyPackage')
}

export async function confirmPackagePayment(purchaseId: string) {
  return command<{ paid: boolean; status: string; minutesRemaining: number }>('mutation($purchaseId: ID!) { confirmPackagePayment(purchaseId: $purchaseId) { success error data } }', { purchaseId }, 'confirmPackagePayment')
}

export async function getMyInvoices() {
  return command<{ currencyCode: string; invoices: InvoiceRow[] }>('query { myInvoices { success error data } }', {}, 'myInvoices')
}

export async function getMyInvoice(id: string) {
  return command<InvoiceDetail>('query($id: ID!) { myInvoice(id: $id) { success error data } }', { id }, 'myInvoice')
}

export async function payInvoice(id: string) {
  return command<Checkout>('mutation($id: ID!) { payInvoice(id: $id) { success error data } }', { id }, 'payInvoice')
}

export async function confirmInvoicePayment(id: string) {
  return command<{ paid: boolean; status: string; balanceCents: number }>('mutation($id: ID!) { confirmInvoicePayment(id: $id) { success error data } }', { id }, 'confirmInvoicePayment')
}

/** S17. */
export async function reportPayment(input: { target: 'session' | 'package' | 'invoice'; targetId: string; amountCents: number; method: string; reference: string }) {
  return command<{ id: string; status: string }>(
    'mutation($target: String!, $targetId: ID!, $amountCents: Int!, $method: String!, $reference: String!) { reportPayment(target: $target, targetId: $targetId, amountCents: $amountCents, method: $method, reference: $reference) { success error data } }',
    input, 'reportPayment')
}

export async function getMyResources() {
  return command<{ resources: Resource[] }>('query { myResources { success error data } }', {}, 'myResources')
}

export async function submitReview(rating: number, body: string, displayName: string) {
  return command<{ id: string; status: string }>('mutation($rating: Int!, $body: String, $displayName: String) { submitReview(rating: $rating, body: $body, displayName: $displayName) { success error data } }', { rating, body, displayName }, 'submitReview')
}

export async function updateMyContact(contact: { guardianName?: string; phone?: string; secondContactName?: string; secondContactPhone?: string; address?: string; timezone?: string }) {
  return command<{ saved: boolean }>('mutation($contact: ContactInput!) { updateMyContact(contact: $contact) { success error data } }', { contact }, 'updateMyContact')
}

export async function getMyCalendarFeedUrl() {
  return command<{ url: string; webcalUrl: string }>('query { myCalendarFeedUrl { success error data } }', {}, 'myCalendarFeedUrl')
}
