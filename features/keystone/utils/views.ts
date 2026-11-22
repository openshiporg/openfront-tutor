import type { Prisma } from '@prisma/client'

/**
 * Hand-built projections for everything a family or a visitor sees. Each one
 * is a Prisma `select`, so private fields (`needs`, `privateNote`,
 * `privateNotes`, token hashes) are never read, let alone returned.
 */

export const familySessionSelect = {
  id: true, startsAt: true, endsAt: true, mode: true, meetingUrl: true, locationText: true, status: true, funding: true,
  typeNameSnapshot: true, priceCents: true, chargedCents: true, chargedMinutes: true, paymentStatus: true, holdEndsAt: true,
  cancellationReason: true, cancelledBy: true, rescheduleCount: true, rescheduledFrom: true, sessionTypeId: true,
  students: { select: { id: true, firstName: true, meetingUrl: true } },
  note: { select: { covered: true, wentWell: true, workOnNext: true, effort: true, sharedAt: true } },
  homework: { select: { id: true, title: true, dueAt: true, status: true } },
} satisfies Prisma.SessionSelect

export const familyStudentSelect = {
  id: true, firstName: true, lastName: true, level: true, school: true, birthYear: true, goals: true, status: true,
  subjects: { select: { id: true, name: true } },
} satisfies Prisma.StudentSelect

export const familyHomeworkSelect = {
  id: true, title: true, instructions: true, dueAt: true, linkUrl: true, file_filename: true, file_filesize: true, status: true,
  handedInAt: true, guardianComment: true, handInUrl: true, feedback: true, reviewedAt: true, createdAt: true,
  student: { select: { id: true, firstName: true } },
} satisfies Prisma.HomeworkSelect

export const familyPurchaseSelect = {
  id: true, nameSnapshot: true, minutesGranted: true, minutesRemaining: true, pricePaidCents: true, refundedCents: true, status: true, purchasedAt: true, expiresAt: true, createdAt: true,
  entries: { select: { kind: true, minutes: true, createdAt: true, note: true, session: { select: { startsAt: true, typeNameSnapshot: true } } }, orderBy: { createdAt: 'desc' as const }, take: 100 },
} satisfies Prisma.PackagePurchaseSelect

export const familyInvoiceSelect = {
  id: true, number: true, status: true, issuedAt: true, dueAt: true, subtotalCents: true, totalCents: true, paidCents: true, note: true, createdAt: true,
  lines: { select: { description: true, quantity: true, unitCents: true, totalCents: true }, orderBy: { sortOrder: 'asc' as const } },
  payments: { select: { id: true, method: true, status: true, amountCents: true, reference: true, paidAt: true, kind: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.InvoiceSelect

/** A sent invoice past its due date and not paid (§4.3, computed). */
export const isOverdue = (i: { status: string; dueAt: Date | null; paidCents: number; totalCents: number }) =>
  i.status === 'sent' && Boolean(i.dueAt && i.dueAt.getTime() < Date.now()) && i.paidCents < i.totalCents

export function iso<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
