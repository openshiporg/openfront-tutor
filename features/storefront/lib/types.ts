/** Shapes from docs/feature-matrix.md (the backend contract). */

export type SessionMode = 'online' | 'in_person' | 'either'

export type PublicSubject = { id: string; name: string; levels: string | null; description: string | null; imageUrl: string | null }
export type PublicSessionType = { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number; mode: SessionMode; openToNewFamilies: boolean; maxStudents: number; subjectIds: string[] }
export type PublicPackage = { id: string; name: string; description: string | null; minutes: number; priceCents: number; validMonths: number; appliesTo: Array<{ id: string; name: string }> }
export type PublicHours = { dayOfWeek: string; isWorking: boolean; startMinute: number; endMinute: number; breakStartMinute: number | null; breakEndMinute: number | null }
export type PublicReview = { id: string; displayName: string | null; rating: number; body: string | null; createdAt: string }

export type PublicTutor = {
  slug: string; businessName: string; tutorName: string | null; headline: string | null; bio: string | null; qualifications: string | null
  photoUrl: string | null; heroImageUrl: string | null; phone: string | null; email: string | null; city: string | null; country: string | null
  timezone: string; currencyCode: string; teachesOnline: boolean; teachesInPerson: boolean; inPersonArea: string | null
  bookingOpen: boolean; minNoticeHours: number; maxAdvanceDays: number; cancellationWindowHours: number; lateCancelPercent: number; noShowPercent: number
  unpaidHoldMinutes: number; reschedulesAllowed: number; policiesText: string | null; cardPayments: boolean; reviewsEnabled: boolean
  subjects: PublicSubject[]; sessionTypes: PublicSessionType[]; packages: PublicPackage[]; hours: PublicHours[]; reviews: PublicReview[]
  rating: { average: number; count: number } | null
}

export type SessionStatus = 'pending_payment' | 'scheduled' | 'completed' | 'cancelled' | 'late_cancelled' | 'no_show' | 'excused' | 'released'
export type Funding = 'package' | 'card' | 'invoice' | 'flat' | 'free'
export type PaymentStatus = 'not_due' | 'unpaid' | 'paid' | 'refunded' | 'part_refunded'

export type SessionNote = { covered: string | null; wentWell: string | null; workOnNext: string | null; effort: number | null; sharedAt: string | null }

export type FamilySession = {
  id: string; startsAt: string; endsAt: string; mode: 'online' | 'in_person'; meetingUrl: string | null; locationText: string | null
  status: SessionStatus; funding: Funding; typeNameSnapshot: string; priceCents: number; chargedCents: number; chargedMinutes: number
  paymentStatus: PaymentStatus; holdEndsAt: string | null; cancellationReason: string | null; cancelledBy: string | null
  rescheduleCount: number; rescheduledFrom: string | null; sessionTypeId: string | null
  students: Array<{ id: string; firstName: string; meetingUrl?: string | null }>; note: SessionNote | null
  homework: Array<{ id: string; title: string; dueAt: string | null; status: string }>
}

export type SessionDetail = {
  id: string; status: SessionStatus; funding: Funding; paymentStatus: PaymentStatus; startsAt: string; endsAt: string; durationMinutes: number
  sessionName: string; sessionTypeId: string | null; priceCents: number; chargedCents: number; chargedMinutes: number; currencyCode: string
  mode: 'online' | 'in_person'; meetingUrl: string | null; locationText: string | null; holdEndsAt: string | null; released: boolean
  cancellationReason: string | null; cancelledBy: string | null; rescheduleCount: number; rescheduledFrom: string | null
  students: Array<{ id: string; firstName: string }>; note: SessionNote | null; homework: Array<{ id: string; title: string; dueAt: string | null; status: string }>
  payments: Array<{ id: string; method: string; status: string; amountCents: number; reference: string | null; paidAt: string | null }>
  tutor: { slug: string; businessName: string; tutorName: string | null; photoUrl: string | null; phone: string | null; email: string | null; timezone: string }
  familyTimezone: string; guardianName: string; hasAccount: boolean
  canPayByCard: boolean; payDirectly: boolean; paymentInstructions: string | null
  canCancel: boolean; cancelTerms: string | null; cancelIsLate: boolean; canReschedule: boolean; rescheduleClosedReason: string | null; calendarUrl: string
}

export type Checkout = { url: string; checkoutId: string }

export type FamilyStudent = { id: string; firstName: string; lastName: string | null; level: string | null; school: string | null; birthYear: number | null; goals: string | null; status: string; subjects: Array<{ id: string; name: string }> }

export type MyFamily = {
  family: { id: string; guardianName: string; email: string | null; phone: string | null; secondContactName: string | null; secondContactPhone: string | null; address: string | null; timezone: string | null; billingMode: 'pay_as_you_book' | 'invoice' | 'flat_monthly'; status: string; monthlyFeeCents: number | null }
  tutor: { slug: string; businessName: string; tutorName: string | null; photoUrl: string | null; email: string | null; phone: string | null; timezone: string; currencyCode: string; paymentInstructions: string | null; cancellationWindowHours: number; lateCancelPercent: number; noShowPercent: number; policiesText: string | null; cardPayments: boolean }
  upcoming: FamilySession[]; students: FamilyStudent[]
  packages: Array<{ id: string; nameSnapshot: string; minutesRemaining: number; minutesGranted: number; status: string; expiresAt: string | null }>
  minutesLeft: number; lowBalance: boolean; owingCents: number; overdueInvoices: number
  openInvoices: Array<{ id: string; number: string; totalCents: number; paidCents: number; dueAt: string | null; status: string }>
  homeworkDue: Array<{ id: string; title: string; dueAt: string | null; student: { firstName: string } }>
  newNotes: Array<{ covered: string | null; workOnNext: string | null; sharedAt: string; session: { id: string; startsAt: string; typeNameSnapshot: string } }>
  canReview: boolean
}

export type Homework = {
  id: string; title: string; instructions: string | null; dueAt: string | null; linkUrl: string | null; file_filename: string | null; file_filesize: number | null
  status: 'assigned' | 'handed_in' | 'reviewed'; handedInAt: string | null; guardianComment: string | null; handInUrl: string | null; feedback: string | null
  reviewedAt: string | null; createdAt: string; student: { id: string; firstName: string }
}

export type LedgerEntry = { kind: string; minutes: number; createdAt: string; note: string | null; session: { startsAt: string; typeNameSnapshot: string } | null }
export type Purchase = {
  id: string; nameSnapshot: string; minutesGranted: number; minutesRemaining: number; pricePaidCents: number; refundedCents: number
  status: 'awaiting_payment' | 'active' | 'used_up' | 'expired' | 'refunded'; purchasedAt: string | null; expiresAt: string | null; createdAt: string
  entries: LedgerEntry[]; payments: Array<{ id: string; method: string; status: string; amountCents: number; reference: string | null }>
}
export type MyPackages = { currencyCode: string; cardPayments: boolean; paymentInstructions: string | null; purchases: Purchase[]; packages: PublicPackage[] }

export type InvoiceRow = { id: string; number: string; status: string; issuedAt: string | null; dueAt: string | null; totalCents: number; paidCents: number; overdue: boolean; balanceCents: number }
export type InvoiceDetail = {
  id: string; number: string; status: string; issuedAt: string | null; dueAt: string | null; subtotalCents: number; totalCents: number; paidCents: number; note: string | null
  lines: Array<{ description: string; quantity: number; unitCents: number; totalCents: number }>
  payments: Array<{ id: string; method: string; status: string; amountCents: number; reference: string | null; paidAt: string | null; kind: string }>
  guardianName: string; overdue: boolean; balanceCents: number; currencyCode: string
  tutor: { businessName: string; email: string | null; phone: string | null; slug: string }; canPayByCard: boolean; paymentInstructions: string | null
}

export type Resource = { id: string; title: string; linkUrl: string | null; fileUrl: string | null; file_filesize: number | null; note: string | null; createdAt: string; students: Array<{ id: string; firstName: string }> }

export type Progress = {
  student: FamilyStudent
  marks: Array<{ id: string; label: string; takenOn: string; score: number; outOf: number; note: string | null; percent: number }>
  notes: Array<SessionNote & { session: { id: string; startsAt: string; typeNameSnapshot: string } }>
  homework: Homework[]
}
