# Openfront Tutor: feature matrix (storefront rows)

The contract between the backend (`main`) and the storefront (`storefront` branch). Every operation is on `POST /api/graphql`.
Every operation except `publicTutor` and `homeTutor` returns `CommandResult { success: Boolean!, error: String, data: JSON }`.
When `success` is false, `error` is a sentence to show to the person as it is. `publicTutor` and `homeTutor` return the JSON itself, or `null`.

Conventions:
- Money is integer minor units (`…Cents`) in `currencyCode`.
- Times are ISO 8601 UTC strings. Show them in the viewer's timezone and name it (D15). `timezone` inputs are IANA names, e.g. `America/Chicago`.
- A booking link is `/booking/<id>?t=<token>` and an invoice link is `/invoice/<id>?t=<token>`. The `token` is returned once, at creation or send.
- Guardian operations (`my…`, `bookSession` …) need the signed-in Keystone session cookie (`authenticateUserWithPassword`). The family is resolved from the session; a user without a family gets `success:false`.
- Card buttons render only when `cardPayments` / `canPayByCard` is true. Otherwise show `paymentInstructions` ("pay your tutor directly"). Nothing is shown as "not available in this mode".

Shared shapes:

```
Session (family view) = { id, startsAt, endsAt, mode: 'online'|'in_person', meetingUrl, locationText,
  status: 'pending_payment'|'scheduled'|'completed'|'cancelled'|'late_cancelled'|'no_show'|'excused'|'released',
  funding: 'package'|'card'|'invoice'|'flat'|'free', typeNameSnapshot, priceCents, chargedCents, chargedMinutes,
  paymentStatus: 'not_due'|'unpaid'|'paid'|'refunded'|'part_refunded', holdEndsAt, cancellationReason, cancelledBy,
  rescheduleCount, rescheduledFrom, sessionTypeId,
  students: [{ id, firstName, meetingUrl }], note: { covered, wentWell, workOnNext, effort, sharedAt } | null,
  homework: [{ id, title, dueAt, status }] }

SessionDetail = { id, status, funding, paymentStatus, startsAt, endsAt, durationMinutes, sessionName, sessionTypeId,
  priceCents, chargedCents, chargedMinutes, currencyCode, mode, meetingUrl, locationText, holdEndsAt, released,
  cancellationReason, cancelledBy, rescheduleCount, rescheduledFrom, students: [{ id, firstName }],
  note: { covered, wentWell, workOnNext, effort, sharedAt } | null, homework: [{ id, title, dueAt, status }],
  payments: [{ id, method, status, amountCents, reference, paidAt }],
  tutor: { slug, businessName, tutorName, photoUrl, phone, email, timezone }, familyTimezone, guardianName, hasAccount,
  canPayByCard, payDirectly, paymentInstructions, canCancel, cancelTerms (sentence shown before confirming), cancelIsLate,
  canReschedule, rescheduleClosedReason, calendarUrl (.ics for this session) }

Checkout = { url (redirect the browser here: Stripe Checkout), checkoutId }
```

Stripe returns to the page that opened it with `paid=1` (or `paid=0`) added. On `paid=1`, call the matching `confirm…Payment` operation once, then re-read. Payment is confirmed by reading the Checkout Session back from Stripe, never from the browser.

| # | Capability | Operation(s) | Inputs | `data` |
|---|---|---|---|---|
| S1 | Tutor's page | `query homeTutor: JSON` (the `/` page: first tutor with booking open), `query publicTutor(slug: String!): JSON` | slug | `{ slug, businessName, tutorName, headline, bio, qualifications, photoUrl, heroImageUrl, phone, email, city, country, timezone, currencyCode, teachesOnline, teachesInPerson, inPersonArea, bookingOpen, minNoticeHours, maxAdvanceDays, cancellationWindowHours, lateCancelPercent, noShowPercent, unpaidHoldMinutes, reschedulesAllowed, policiesText, cardPayments, reviewsEnabled, subjects: [{ id, name, levels, description, imageUrl }], sessionTypes: [{ id, name, description, durationMinutes, priceCents, mode: 'online'\|'in_person'\|'either', openToNewFamilies, maxStudents, subjectIds }], packages: [{ id, name, description, minutes, priceCents, validMonths, appliesTo: [{ id, name }] }], hours: [{ dayOfWeek: 'monday'…, isWorking, startMinute, endMinute, breakStartMinute, breakEndMinute }] (tutor timezone, minutes after midnight), reviews: [{ id, displayName, rating, body, createdAt }], rating: { average, count } \| null }` or `null` |
| S2 | Book a first session as a new family | `query publicSlots(slug, sessionTypeId, date: "YYYY-MM-DD", timezone)`; `query publicOpenDays(slug, sessionTypeId, from: "YYYY-MM-DD", days: Int (≤42), timezone)`; `mutation bookFirstSession(slug, sessionTypeId, startsAt: ISO, visitor: VisitorInput!, mode)` | `VisitorInput { guardianName!, email, phone (one of email/phone required), studentName!, studentLevel, message, timezone }`; `mode` only for `either` types | slots: `{ date, timezone, tutorTimezone, slots: [ISO] }`; open days: `{ days: ["YYYY-MM-DD"] }`; book: `{ bookingId, token, status, funding, needsPayment, holdEndsAt, bookingUrl }`. Only types with `openToNewFamilies` are accepted ("This kind of session is for current families…"). A taken slot answers "That time was just taken. Choose another." |
| S3 | Pay for a booking by card; hold countdown | `mutation payForBooking(id, token)`; on return `mutation confirmBookingPayment(id, token)` | id, token | pay: `Checkout`; confirm: `{ paid: Boolean }`. The countdown is `publicBooking.holdEndsAt`. After it ends, `status` becomes `released`. |
| S4 | Booking status by private link | `query publicBooking(id, token)` | id, token | `SessionDetail` (`calendarUrl` carries the token). The meeting link is hidden while the time is only held. |
| S5 | Cancel or reschedule from the link | `mutation cancelMyBooking(id, token, reason)`; `mutation rescheduleMyBooking(id, token, startsAt)`. Show `publicBooking.cancelTerms` before confirming. Reschedule slots: `publicSlots(slug, sessionTypeId, date, timezone, excludeSessionId: id, token)` | | cancel: `{ status: 'cancelled'\|'late_cancelled', charged: 'nothing'\|'<n>%', refundedCents }`; reschedule: `{ id, startsAt, endsAt, from }`. Closed inside the window or past `reschedulesAllowed` (error sentence). |
| S6 | Ask about tutoring | `mutation sendInquiry(slug, name!, email, phone, studentLevel, subject, message)` | | `{ id, sent: true }` |
| S7 | Create the family account from a booking or invite | `mutation claimFamilyAccount(password!, email, name, bookingId + bookingToken \| familyId + token)`, then `authenticateUserWithPassword(email, password)` (Keystone) | invite links are `/account/claim?f=<familyId>&t=<token>`; from a booking use its id and token | `{ email }` |
| S8 | Sign in, sign out, reset password | Keystone: `authenticateUserWithPassword(email, password)`, `endSession`, `sendUserPasswordResetLink(email)`, `redeemUserPasswordResetToken(email, token, password)` | | Keystone's own result types. A dashboard user (tutor) is told to use `/dashboard`. |
| S9 | Account home | `query myFamily` | | `{ family: { id, guardianName, email, phone, secondContactName, secondContactPhone, address, timezone, billingMode, status, monthlyFeeCents }, tutor: { slug, businessName, tutorName, photoUrl, email, phone, timezone, currencyCode, paymentInstructions, cancellationWindowHours, lateCancelPercent, noShowPercent, policiesText, cardPayments }, upcoming: [Session], students: [Student], packages: [{ id, nameSnapshot, minutesRemaining, minutesGranted, status, expiresAt }], minutesLeft, lowBalance, owingCents, overdueInvoices, openInvoices: [{ id, number, totalCents, paidCents, dueAt, status }], homeworkDue: [{ id, title, dueAt, student: { firstName } }], newNotes: [{ covered, workOnNext, sharedAt, session: { id, startsAt, typeNameSnapshot } }], canReview }` |
| S10 | Book as a known family | `publicSlots(slug, sessionTypeId, date, timezone)` (every active type), then `mutation bookSession(sessionTypeId, startsAt, studentIds: [ID!]!, message, mode)` | | `{ sessionId, status, funding, needsPayment, holdEndsAt, packageMinutesLeft, priceCents }`. Funding is chosen for them: package if one covers it, else the billing mode. If `needsPayment`, call `payForSession`. |
| S11 | Sessions list and one session | `query mySessions(range: 'upcoming'\|'past'\|'all')`, `query mySession(id)`, `mutation cancelSession(id, reason)`, `mutation rescheduleSession(id, startsAt)`, `mutation payForSession(id)`, `mutation confirmSessionPayment(id)` | reschedule slots: `publicSlots(…, excludeSessionId: id)` while signed in | list: `{ range, timezone, currencyCode, sessions: [Session] }`; one: `SessionDetail`; cancel and reschedule as S5; pay: `Checkout`; confirm: `{ paid }` |
| S12 | Students | `query myStudents`, `mutation saveStudent(student: StudentInput!)` | `StudentInput { id (omit to add), firstName!, lastName, level, school, goals, birthYear }` | `{ students: [{ id, firstName, lastName, level, school, birthYear, goals, status, subjects: [{ id, name }] }] }`; save: `{ id }` |
| S13 | Homework | `query myHomework(status: 'assigned'\|'handed_in'\|'reviewed')`, `mutation handInHomework(id, comment, url)` | | `{ homework: [{ id, title, instructions, dueAt, linkUrl, file_filename (download: GET /api/files/homework/<id>), file_filesize, status, handedInAt, guardianComment, handInUrl, feedback, reviewedAt, createdAt, student: { id, firstName } }] }`; hand in: `{ id, status: 'handed_in' }` |
| S14 | Progress | `query myProgress(studentId)` | | `{ student, marks: [{ id, label, takenOn, score, outOf, note, percent }], notes: [{ covered, wentWell, workOnNext, effort, sharedAt, session: { id, startsAt, typeNameSnapshot } }], homework: [...] }` |
| S15 | Packages | `query myPackages`, `mutation buyPackage(packageId, method: 'card'\|'direct')`, on return `mutation confirmPackagePayment(purchaseId)` (Stripe returns to `/account/packages?purchase=<id>&paid=1`) | | `{ currencyCode, cardPayments, paymentInstructions, purchases: [{ id, nameSnapshot, minutesGranted, minutesRemaining, pricePaidCents, refundedCents, status: 'awaiting_payment'\|'active'\|'used_up'\|'expired'\|'refunded', purchasedAt, expiresAt, entries: [{ kind, minutes, createdAt, note, session }], payments }], packages: [offer] }`; buy: `{ purchaseId, status, paymentInstructions, checkoutUrl \| null }`; confirm: `{ paid, status, minutesRemaining }` |
| S16 | Invoices | `query myInvoices`, `query myInvoice(id)`, `mutation payInvoice(id)`, `mutation confirmInvoicePayment(id)`; by link: `query publicInvoice(id, token)`, `mutation payInvoiceByLink(id, token)`, `mutation confirmInvoicePayment(id, token)` | | list: `{ currencyCode, invoices: [{ id, number, status, issuedAt, dueAt, totalCents, paidCents, overdue, balanceCents }] }`; one: `{ id, number, status, issuedAt, dueAt, subtotalCents, totalCents, paidCents, note, lines: [{ description, quantity, unitCents, totalCents }], payments: [{ id, method, status, amountCents, reference, paidAt, kind }], guardianName, overdue, balanceCents, currencyCode, tutor: { businessName, email, phone, slug }, canPayByCard, paymentInstructions }`; pay: `Checkout`; confirm: `{ paid, status, balanceCents }` |
| S17 | Report an outside payment | `mutation reportPayment(target: 'session'\|'package'\|'invoice', targetId, amountCents, method: 'cash'\|'bank_transfer'\|'mobile_money'\|'other', reference!)` | | `{ id, status: 'reported' }`. Nothing changes until the tutor confirms. |
| S18 | Shared resources | `query myResources` | | `{ resources: [{ id, title, linkUrl, fileUrl, file_filesize, note, createdAt, students: [{ id, firstName }] }] }` |
| S19 | Write a review | `mutation submitReview(rating: 1..5, body, displayName)`; offered when `myFamily.canReview` | | `{ id, status: 'pending' }` (shown after the tutor publishes it) |
| S20 | Contact details and timezone | `mutation updateMyContact(contact: ContactInput!)` | `{ guardianName, phone, secondContactName, secondContactPhone, address, timezone }` | `{ saved: true }` |
| S21 | Calendar feed and `.ics` | `query myCalendarFeedUrl` (a new call replaces the old link); per session: `SessionDetail.calendarUrl` | | `{ url, webcalUrl }`; `GET /api/calendar/session/<id>[?t=token]` returns `text/calendar` |

Platform rows (P1–P45) live in the dashboard under `/dashboard/platform/*` and are listed in the dissertation §6.2. Their operations are added in `features/keystone/mutations/tutor.ts`.
