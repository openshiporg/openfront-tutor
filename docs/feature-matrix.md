# Openfront Tutor: feature matrix

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
  canPayByCard, takesCards (same), payDirectly, paymentInstructions, canCancel, cancelTerms (sentence shown before confirming), cancelIsLate,
  canReschedule, rescheduleClosedReason, calendarUrl (.ics for this session) }

Checkout = { url (redirect the browser here: Stripe Checkout), checkoutId }
```

Stripe returns to fixed pages, with `paid=1` (or `paid=0`) added. No `returnPath` is taken: these are built server-side from `APP_ORIGIN`, so a link can never send a family elsewhere.
- `payForBooking` → `/booking/<id>?t=<token>&paid=1`
- `payForSession` → `/account/sessions/<id>?paid=1`
- `buyPackage` (card) → `/account/packages?purchase=<purchaseId>&paid=1`
- `payInvoice` → `/account/invoices/<id>?paid=1`; `payInvoiceByLink` → `/invoice/<id>?t=<token>&paid=1`
- Per-session `.ics`: `GET /api/calendar/session/<id>?t=<token>` (or signed in as the family). `SessionDetail.calendarUrl` already has it.
- `paymentInstructions` is filled whenever the family may pay directly: an unpaid session they can pay, an invoice-funded session, or an open invoice.

 On `paid=1`, call the matching `confirm…Payment` operation once, then re-read. Payment is confirmed by reading the Checkout Session back from Stripe, never from the browser.

| # | Capability | Operation(s) | Inputs | `data` |
|---|---|---|---|---|
| S1 | Tutor's page | `query homeTutor: JSON` (the `/` page: first tutor with booking open), `query publicTutor(slug: String!): JSON` | slug | `{ id, slug, businessName, tutorName, headline, bio, qualifications, photoUrl, heroImageUrl, phone, email, city, country, timezone, currencyCode, teachesOnline, teachesInPerson, inPersonArea, bookingOpen, minNoticeHours, maxAdvanceDays, cancellationWindowHours, lateCancelPercent, noShowPercent, unpaidHoldMinutes, reschedulesAllowed, policiesText, cardPayments, takesCards (same value: true only when Stripe is really usable), reviewsEnabled, subjects: [{ id, name, levels, description, imageUrl }], sessionTypes: [{ id, name, description, durationMinutes, priceCents, mode: 'online'\|'in_person'\|'either', openToNewFamilies, maxStudents, subjectIds }], packages: [{ id, name, description, minutes, priceCents, validMonths, appliesTo: [{ id, name }], appliesToIds }], hours: [{ dayOfWeek: 'monday'…, isWorking, startMinute, endMinute, breakStartMinute, breakEndMinute }] (tutor timezone, minutes after midnight), reviews: [{ id, displayName, rating, body, createdAt }], rating: { average, count } \| null }` or `null` |
| S2 | Book a first session as a new family | `query publicSlots(slug, sessionTypeId, date: "YYYY-MM-DD", timezone | timeZone)` (the viewer's IANA zone; `date` is a day as the viewer sees it); `query publicOpenDays(slug, sessionTypeId, from: "YYYY-MM-DD", days: Int (≤42), timezone)`; `mutation bookFirstSession(slug, sessionTypeId, startsAt: ISO, visitor: VisitorInput!, mode)` | `VisitorInput { guardianName!, email, phone (one of email/phone required), studentName!, studentLevel, message, timezone }`; `mode` only for `either` types | slots: `{ date, timezone, tutorTimezone, slots: [ISO] }`; open days: `{ days: ["YYYY-MM-DD"] }`; book: `{ bookingId, sessionId (same id), token, status, funding, needsPayment, holdEndsAt, bookingUrl }`. Only types with `openToNewFamilies` are accepted ("This kind of session is for current families…"). A taken slot answers "That time was just taken. Choose another." |
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
| S16 | Invoices | `query myInvoices`, `query myInvoice(id)`, `mutation payInvoice(id)`, `mutation confirmInvoicePayment(id)`; by link: `query publicInvoice(id, token)`, `mutation payInvoiceByLink(id, token)`, `mutation confirmInvoicePayment(id, token)` | | list: `{ currencyCode, invoices: [{ id, number, status, issuedAt, dueAt, totalCents, paidCents, overdue, balanceCents }] }`; one: `{ id, number, status, issuedAt, dueAt, subtotalCents, totalCents, paidCents, note, lines: [{ description, quantity, unitCents, totalCents }], payments: [{ id, method, status, amountCents, reference, paidAt, kind }], guardianName, overdue, balanceCents, currencyCode, tutor: { businessName, email, phone, slug }, canPayByCard, takesCards, paymentInstructions }`; pay: `Checkout`; confirm: `{ paid, status, balanceCents }` |
| S17 | Report an outside payment | `mutation reportPayment(target: 'session'\|'package'\|'invoice', targetId, amountCents, method: 'cash'\|'bank_transfer'\|'mobile_money'\|'other', reference!)` | | `{ id, status: 'reported' }`. Nothing changes until the tutor confirms. |
| S18 | Shared resources | `query myResources` | | `{ resources: [{ id, title, linkUrl, fileUrl, file_filesize, note, createdAt, students: [{ id, firstName }] }] }` |
| S19 | Write a review | `mutation submitReview(rating: 1..5, body, displayName)`; offered when `myFamily.canReview` | | `{ id, status: 'pending' }` (shown after the tutor publishes it) |
| S20 | Contact details and timezone | `mutation updateMyContact(contact: ContactInput!)` | `{ guardianName, phone, secondContactName, secondContactPhone, address, timezone }` | `{ saved: true }` |
| S21 | Calendar feed and `.ics` | `query myCalendarFeedUrl` (a new call replaces the old link); per session: `SessionDetail.calendarUrl` | | `{ url, webcalUrl }`; `GET /api/calendar/session/<id>[?t=token]` returns `text/calendar` |


## Platform rows (tutor)

Pages are under `/dashboard/platform/` (thin wrappers in `app/dashboard/(admin)/platform/`, logic in `features/platform/*`). Operations are in `features/keystone/mutations/tutor.ts`; the dashboard calls them by name through `features/platform/lib/request.ts`. The tutor's invoice creation is `draftInvoice` (Keystone already owns `createInvoice`). "X create/update" means the generic Keystone mutation, where the list's access rules keep status, money and ledger fields out of reach.

| # | Capability | Page | Operations | Reached from |
|---|---|---|---|---|
| P1 | First-run setup, typical starting set | setup | `setUpMyBusiness` | `/dashboard` → Today → "Set up your business" (shown until set up) |
| P2 | Today: sessions in order, last "work on next", homework, lesson link | today | `today` | Sidebar → Today |
| P3 | Complete a session: note and homework in one form | today, sessions/[id] | `completeSession(sessionId, note, homework[], share)`; later edits `saveSessionNote` | Today → Complete |
| P4 | Mark no-show | today, sessions/[id] | `markNoShow` | Today → No-show |
| P5 | Cancel or move as tutor | sessions/[id], calendar | `cancelSessionAsTutor`, `rescheduleSessionAsTutor` | Today/Calendar → session |
| P6 | Excuse a late cancel or no-show | sessions/[id] | `excuseSession` | Session page |
| P7 | Reopen a completed session | sessions/[id] | `reopenSession` | Session page |
| P8 | Attention list | today | `today.attention` (+ `confirmPayment`, `rejectPayment`) | Sidebar → Today |
| P9 | Week calendar: sessions, time off, open hours | calendar | `calendar(from, to)` | Sidebar → Calendar |
| P10 | Add a session by hand | calendar | `createSessionAsTutor` | Calendar → Add a session |
| P11 | Weekly series: create, pause, end, skipped weeks | calendar/series | `saveSeries`, `pauseSeries`, `endSeries`, `clearSkippedWeek` | Sidebar → Weekly series |
| P12 | Time off with affected sessions | calendar | TimeOff create/delete + `calendar` | Calendar → Time off |
| P13 | Weekly hours | settings/hours | WeeklyHours create/update | Sidebar → Settings → Weekly hours |
| P14 | Families list | families | `familiesOverview(status, search)`; add a family: Family create | Sidebar → Families |
| P15 | Family page: contacts, students, billing mode, sessions, packages and ledger, invoices, payments, private notes | families/[id] | `tutorFamily(id)`, Family update, `saveStudentAsTutor` | Families → a family |
| P16 | Invite a family; replace an invite; issue a password link for a claimed account | families/[id] | `inviteFamily(familyId, send)` returns a claim link for a new account or a one-time Keystone `/account/reset` link for a claimed account (60 minutes; new link replaces the old). Link is always available to copy, including without SMTP. | Family page → Account |
| P17 | Block or pause a family | families/[id] | Family update `status` | Family page |
| P18 | Student page | students/[id] | `tutorStudent(id)`, `saveStudentAsTutor` | Family page / Today → student |
| P19 | Progress marks | students/[id] | ProgressMark create/delete | Student page |
| P20 | Homework board, feedback | homework | `homeworkBoard`, `reviewHomework` | Sidebar → Homework |
| P21 | Resources | resources | Resource create/delete (file or link) | Sidebar → Resources |
| P22 | Session page: facts, note, money trail | sessions/[id] | `tutorSession(id)`, `sessionLink` | Today/Calendar → session |
| P23 | Session types | settings/services | SessionType create/update | Settings → Session types and subjects |
| P24 | Subjects and levels | settings/services | Subject create/update/delete | Settings → Session types and subjects |
| P25 | Packages | settings/packages | Package create/update | Settings → Packages |
| P26 | Sell a package by hand | families/[id] | `sellPackage`, `cancelPackagePurchase` | Family page |
| P27 | Refund unused minutes | families/[id] | `refundPackage` | Family page |
| P28 | Adjust minutes with a reason | families/[id] | `adjustMinutes` | Family page |
| P29 | Ready to invoice | billing | `readyToInvoice` | Sidebar → Billing |
| P30 | Create, edit draft, send, void an invoice | billing, billing/invoices/[id] | `draftInvoice`, `addInvoiceLine`, `removeInvoiceLine`, `sendInvoice`, `invoiceLink`, `voidInvoice`, `tutorInvoice` | Billing → invoice |
| P31 | Confirm or reject a reported payment | billing, today | `confirmPayment`, `rejectPayment` | Billing / Today |
| P32 | Record cash, transfer, mobile money | billing, families/[id], sessions/[id] | `recordPayment` | Billing / Family / Session |
| P33 | Refund a payment | billing/payments/[id] | `refundPayment` | Billing → All payments → a payment |
| P34 | Payments list with filters | billing/payments | Payment query | Billing → All payments |
| P35 | Earnings and CSV | earnings | `myEarnings(from, to)`, `exportCsv(kind, from, to)` | Sidebar → Earnings |
| P36 | Expenses | earnings | Expense create/delete | Sidebar → Earnings |
| P37 | Inquiries | inquiries | `setInquiryStatus`, `convertInquiry` | Sidebar → Inquiries |
| P38 | Reviews | reviews | `moderateReview` | Sidebar → Reviews |
| P39 | Business details, page text, photo | settings | TutorProfile update; `tutorCalendarFeedUrl` | Sidebar → Settings |
| P40 | Booking rules | settings/booking | TutorProfile update | Settings → Booking rules and policies |
| P41 | Policies | settings/booking | TutorProfile update | Settings → Booking rules and policies |
| P42 | Payments: Stripe status from Stripe, instructions, due days, currency | settings/payments | `paymentSettings`, TutorProfile update | Settings → Payments |
| P43 | Default lesson link | settings | TutorProfile update `defaultMeetingUrl` | Sidebar → Settings |
| P44 | Message log | settings/messages | NotificationLog query | Settings → Messages |
| P45 | Every list as a plain table (fallback) | /dashboard/[listKey] | generic Keystone CRUD (access rules apply) | Sidebar → Models |
