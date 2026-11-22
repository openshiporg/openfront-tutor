/**
 * Fills ONE fictional tutor's business for our public deployment (dissertation
 * §8), so the pitch has life. Run by hand once; not reachable from the product.
 *
 *   SEED_TUTOR_EMAIL=… SEED_TUTOR_PASSWORD=… [SEED_FAMILY_PASSWORD=…] npx tsx scripts/seed-practice.ts
 *
 * Everything that is a real action goes through the product's own commands:
 * setup, the weekly series generator (the booking lock), package sales,
 * payments, invoices, reported payments and inquiries. Sessions already in the
 * past cannot be booked, so they are written directly as completed lessons,
 * with ledger entries made by the same ledger functions (hold, then debit).
 * The script ends by checking the §9 ledger invariant on every package.
 */
import 'dotenv/config'
import type { PrismaClient } from '@prisma/client'

import { keystoneContext } from '../features/keystone/context'
import { TUTOR_ROLE } from '../features/keystone/access'
import { addDays, businessDateKey, businessWallTime, dayIndexFor } from '../features/keystone/utils/availability'
import { createInvoice, recordPayment, reportPayment, sendInvoice, sellPackage } from '../features/keystone/utils/billing'
import { lockTutorBooking, transaction } from '../features/keystone/utils/business'
import { checkPurchase, holdMinutes, settleHold } from '../features/keystone/utils/ledger'
import { sendInquiry } from '../features/keystone/utils/publicOps'
import { topUpSeries } from '../features/keystone/utils/booking'
import { setUpMyBusiness } from '../features/keystone/utils/setup'

const SLUG = 'daniel-reyes'
const TZ = 'America/Chicago'

type Fam = {
  guardian: string; email: string; phone: string; billing: 'pay_as_you_book' | 'invoice' | 'flat_monthly'; monthlyFeeCents?: number
  students: Array<{ first: string; last: string; level: string; school: string; goals: string; needs: string; subjects: string[] }>
  day: number; minute: number; type: string; funding: 'package' | 'card' | 'invoice' | 'flat'; found: string
}

const FAMILIES: Fam[] = [
  { guardian: 'Maria Okafor', email: 'maria.okafor@example.com', phone: '(512) 555-0141', billing: 'pay_as_you_book', day: 1, minute: 900, type: '60-minute lesson', funding: 'package', found: 'Friend at school',
    students: [{ first: 'Chidi', last: 'Okafor', level: 'Grade 10', school: 'Westwood High', goals: 'Get from a C to a B in Algebra II this semester.', needs: 'Rushes word problems; slow him down on reading the question.', subjects: ['Maths'] }] },
  { guardian: 'Tom Lindqvist', email: 'tom.lindqvist@example.com', phone: '(512) 555-0172', billing: 'pay_as_you_book', day: 1, minute: 1050, type: '90-minute lesson', funding: 'package', found: 'Google',
    students: [{ first: 'Freya', last: 'Lindqvist', level: 'Grade 11', school: 'McNeil High', goals: 'SAT maths 650+ by the spring sitting.', needs: 'Gets anxious on timed sets.', subjects: ['SAT maths'] }] },
  { guardian: 'Priya Raman', email: 'priya.raman@example.com', phone: '(512) 555-0110', billing: 'invoice', day: 2, minute: 900, type: '60-minute lesson', funding: 'invoice', found: 'Neighbour',
    students: [
      { first: 'Arjun', last: 'Raman', level: 'Grade 12', school: 'Round Rock High', goals: 'AP Physics 1: a 4 or 5 on the exam.', needs: 'Strong at maths, weak at explaining reasoning in words.', subjects: ['Physics'] },
      { first: 'Meera', last: 'Raman', level: 'Grade 9', school: 'Round Rock High', goals: 'Keep an A in Geometry.', needs: '', subjects: ['Maths'] },
    ] },
  { guardian: 'Grace Whitfield', email: 'grace.whitfield@example.com', phone: '(512) 555-0193', billing: 'invoice', day: 2, minute: 1050, type: '60-minute lesson', funding: 'invoice', found: 'School counsellor',
    students: [{ first: 'Owen', last: 'Whitfield', level: 'Grade 8', school: 'Canyon Vista Middle', goals: 'Be ready for Algebra I next year.', needs: 'ADHD: short tasks, a break at 30 minutes.', subjects: ['Maths'] }] },
  { guardian: 'Samira Haddad', email: 'samira.haddad@example.com', phone: '(512) 555-0158', billing: 'flat_monthly', monthlyFeeCents: 52000, day: 3, minute: 900, type: '60-minute lesson', funding: 'flat', found: 'Facebook group',
    students: [
      { first: 'Layla', last: 'Haddad', level: 'Grade 10', school: 'Anderson High', goals: 'Chemistry maths and Algebra II.', needs: '', subjects: ['Maths'] },
      { first: 'Yusuf', last: 'Haddad', level: 'Grade 8', school: 'Murchison Middle', goals: 'Fractions and ratios with confidence.', needs: 'Shy; ask him to explain back.', subjects: ['Maths'] },
    ] },
  { guardian: 'Daniel Brooks', email: 'dbrooks@example.com', phone: '(512) 555-0126', billing: 'pay_as_you_book', day: 3, minute: 1050, type: '60-minute lesson', funding: 'card', found: 'Google',
    students: [{ first: 'Ava', last: 'Brooks', level: 'Grade 11', school: 'Westlake High', goals: 'Pre-calculus: understand, not memorise.', needs: '', subjects: ['Maths'] }] },
  { guardian: 'Keiko Tanaka', email: 'keiko.tanaka@example.com', phone: '(512) 555-0185', billing: 'pay_as_you_book', day: 4, minute: 900, type: '60-minute lesson', funding: 'package', found: 'Friend at school',
    students: [{ first: 'Hana', last: 'Tanaka', level: 'Grade 12', school: 'Westwood High', goals: 'AP Calculus AB: a 5.', needs: 'Perfectionist; praise process.', subjects: ['Maths'] }] },
  { guardian: 'Luis Herrera', email: 'luis.herrera@example.com', phone: '(512) 555-0133', billing: 'pay_as_you_book', day: 4, minute: 1050, type: '60-minute lesson', funding: 'card', found: 'Nextdoor',
    students: [
      { first: 'Sofia', last: 'Herrera', level: 'Grade 9', school: 'Cedar Ridge High', goals: 'Physical science: forces and motion.', needs: '', subjects: ['Physics'] },
      { first: 'Mateo', last: 'Herrera', level: 'Grade 11', school: 'Cedar Ridge High', goals: 'SAT maths practice.', needs: 'Skips steps.', subjects: ['SAT maths'] },
    ] },
  { guardian: 'Rachel Stein', email: 'rachel.stein@example.com', phone: '(512) 555-0164', billing: 'pay_as_you_book', day: 6, minute: 600, type: '60-minute lesson', funding: 'card', found: 'Google',
    students: [{ first: 'Noah', last: 'Stein', level: 'Grade 10', school: 'Austin High', goals: 'Physics honors: kinematics and energy.', needs: '', subjects: ['Physics'] }] },
]

const NOTES = [
  { covered: 'Solving linear equations with fractions; checking answers by substitution.', wentWell: 'Clearing denominators first, every time.', workOnNext: 'Word problems: write the equation before solving.' },
  { covered: 'Systems of equations by elimination and substitution.', wentWell: 'Chose the faster method without being told.', workOnNext: 'Sign errors when subtracting equations.' },
  { covered: 'Quadratics: factoring and the quadratic formula.', wentWell: 'Factoring with a leading coefficient of 1 is solid.', workOnNext: 'Completing the square.' },
  { covered: 'Kinematics: displacement, velocity and acceleration graphs.', wentWell: 'Reads slopes off a v–t graph correctly.', workOnNext: 'Area under the curve as displacement.' },
  { covered: 'Newton’s second law with free-body diagrams.', wentWell: 'Diagrams are neat and labelled.', workOnNext: 'Choosing axes on inclined planes.' },
  { covered: 'SAT heart of algebra: timed set of 15.', wentWell: '12 of 15 in time, up from 9.', workOnNext: 'Pacing: skip and come back after 90 seconds.' },
  { covered: 'Exponential growth and decay models.', wentWell: 'Wrote the model from a table quickly.', workOnNext: 'Interpreting the base as a percent change.' },
  { covered: 'Derivatives: power, product and chain rules.', wentWell: 'Chain rule clicked today.', workOnNext: 'Implicit differentiation.' },
  { covered: 'Ratios, rates and proportional reasoning.', wentWell: 'Used a ratio table without prompting.', workOnNext: 'Percent increase and decrease.' },
]
const HOMEWORK = ['Practice set: 12 problems from today', 'Khan Academy unit quiz', 'Past-paper questions 3–8', 'Timed SAT set (15 questions, 18 minutes)', 'Worksheet: show every step']

async function main() {
  const email = process.env.SEED_TUTOR_EMAIL
  const password = process.env.SEED_TUTOR_PASSWORD
  if (!email || !password || password.length < 8) throw new Error('Set SEED_TUTOR_EMAIL and SEED_TUTOR_PASSWORD (8+ characters).')
  const prisma = keystoneContext.prisma as PrismaClient
  const sudo = keystoneContext.sudo()
  if (await prisma.tutorProfile.findUnique({ where: { slug: SLUG } })) { console.log(`Already seeded: /t/${SLUG}. Tutor login: ${email}; guardian login: ${FAMILIES[0].email} (if SEED_FAMILY_PASSWORD was set on the first run).`); return }

  // The tutor's account (Keystone hashes the password) and role.
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const role = (await prisma.role.findFirst({ where: { name: TUTOR_ROLE.name } })) ?? await prisma.role.create({ data: { ...TUTOR_ROLE } })
    const created = await sudo.db.User.createOne({ data: { name: 'Daniel Reyes', email, password, role: { connect: { id: role.id } } } })
    user = await prisma.user.findUniqueOrThrow({ where: { id: String(created.id) } })
  }

  const { profileId } = await setUpMyBusiness(prisma, user.id, {
    businessName: 'Daniel Reyes Tutoring', tutorName: 'Daniel Reyes', slug: SLUG, timezone: TZ, currencyCode: 'USD', country: 'US',
    subjects: ['Maths', 'Physics', 'SAT maths'], levels: 'Grades 8 to 12', teachesOnline: true, teachesInPerson: true, hourlyRateCents: 7000, typicalSetup: true, email,
  })
  await prisma.tutorProfile.update({
    where: { id: profileId },
    data: {
      headline: 'Maths and physics for grades 8 to 12, online and in North Austin.',
      bio: 'I taught high-school maths and physics for nine years before tutoring full time. I work with students who are behind and want to catch up, and with students who are ahead and want a top score. Every session ends with a short note for parents: what we covered, what went well and what to work on next.',
      qualifications: 'B.S. Physics, UT Austin. Texas teaching certificate (Mathematics 7–12, Physics 8–12). 9 years in the classroom; full-time tutor since 2021.',
      phone: '(512) 555-0100', city: 'Austin', inPersonArea: 'North Austin, Round Rock and Cedar Park (your home or a library)',
      defaultMeetingUrl: 'https://meet.google.com/dry-tutr-ing',
      photoUrl: '/storefront/tutor-portrait.webp', heroImageUrl: '/storefront/hero.webp',
      paymentInstructions: 'Zelle to pay@danielreyestutoring.com or Venmo @DanielReyesTutoring. Put your child’s name as the note.',
    },
  })
  const subjects = await prisma.subject.findMany({ where: { profileId } })
  const subjectImages: Record<string, string> = { Maths: '/storefront/subject-maths.webp', Physics: '/storefront/subject-physics.webp', 'SAT maths': '/storefront/subject-sat.webp' }
  const subjectText: Record<string, string> = { Maths: 'Pre-algebra to AP Calculus.', Physics: 'Physical science, Physics 1 and AP Physics 1.', 'SAT maths': 'Strategy, pacing and the topics the test actually asks.' }
  for (const s of subjects) await prisma.subject.update({ where: { id: s.id }, data: { imageUrl: subjectImages[s.name] ?? '', description: subjectText[s.name] ?? '' } })
  const types = await prisma.sessionType.findMany({ where: { profileId } })
  const typeByName = (n: string) => types.find((t) => t.name === n)!
  const pkg10 = await prisma.package.findFirstOrThrow({ where: { profileId, name: '10 hours' } })

  const now = new Date()
  const today = businessDateKey(now, TZ)
  const studentIdsByFamily: string[][] = []
  const familyIds: string[] = []

  for (const [fi, f] of FAMILIES.entries()) {
    const family = await prisma.family.create({ data: { profileId, guardianName: f.guardian, email: f.email, phone: f.phone, status: 'active', billingMode: f.billing, monthlyFeeCents: f.monthlyFeeCents ?? 0, timezone: TZ, howTheyFoundMe: f.found, privateNotes: fi === 3 ? 'Mum prefers texts after 6 pm.' : '' } })
    familyIds.push(family.id)
    const ids: string[] = []
    for (const s of f.students) {
      const st = await prisma.student.create({ data: { profileId, familyId: family.id, firstName: s.first, lastName: s.last, level: s.level, school: s.school, goals: s.goals, needs: s.needs, subjects: { connect: subjects.filter((x) => s.subjects.includes(x.name)).map((x) => ({ id: x.id })) } } })
      ids.push(st.id)
    }
    studentIdsByFamily.push(ids)
    const type = typeByName(f.type)

    // A 10-hour package, sold by hand 7 weeks ago and paid (real commands: sell + record payment).
    let purchaseId: string | null = null
    if (f.funding === 'package') {
      const sold = await sellPackage(prisma, profileId, { familyId: family.id, packageId: pkg10.id, method: fi === 1 ? 'bank_transfer' : 'cash', reference: fi === 1 ? 'Zelle 7731' : '' })
      purchaseId = sold.purchaseId
      const bought = addDays(today, -49)
      const at = businessWallTime(bought, 720, TZ)
      const expires = new Date(at); expires.setUTCMonth(expires.getUTCMonth() + 12)
      await prisma.packagePurchase.update({ where: { id: purchaseId }, data: { purchasedAt: at, expiresAt: expires } })
      await prisma.payment.updateMany({ where: { purchaseId }, data: { paidAt: at } })
    }

    // The weekly series, started 6 weeks ago.
    let first = addDays(today, -42)
    while (dayIndexFor(first) !== f.day) first = addDays(first, 1)
    const series = await prisma.recurringSeries.create({ data: { profileId, familyId: family.id, sessionTypeId: type.id, students: { connect: ids.map((id) => ({ id })) }, dayOfWeek: f.day, startMinute: f.minute, mode: fi === 3 ? 'in_person' : 'online', startsOn: first, status: 'active' } })

    // Six weeks of lessons already taught.
    let week = 0
    for (let d = first; d < today; d = addDays(d, 7), week++) {
      const startsAt = businessWallTime(d, f.minute, TZ)
      if (startsAt >= now) break
      const endsAt = new Date(startsAt.getTime() + type.durationMinutes * 60_000)
      const missed = fi === 5 && week === 2 // one no-show, charged by policy
      const s = await prisma.session.create({
        data: {
          profileId, familyId: family.id, sessionTypeId: type.id, seriesId: series.id, students: { connect: ids.map((id) => ({ id })) },
          startsAt, endsAt, mode: fi === 3 ? 'in_person' : 'online', locationText: fi === 3 ? 'Milwood Library, study room 2' : '',
          status: 'scheduled', funding: f.funding, source: 'series', typeNameSnapshot: type.name, priceCents: type.priceCents,
          paymentStatus: f.funding === 'card' ? 'unpaid' : 'not_due',
        },
      })
      await transaction(prisma, async (tx) => {
        await lockTutorBooking(tx, profileId)
        if (purchaseId) {
          const p = await tx.packagePurchase.findUniqueOrThrow({ where: { id: purchaseId } })
          await holdMinutes(tx, p, s.id, type.durationMinutes)
          await settleHold(tx, profileId, s.id, type.durationMinutes, missed ? 'No-show' : 'Session taught')
        }
        await tx.session.update({ where: { id: s.id }, data: { status: missed ? 'no_show' : 'completed', completedAt: missed ? null : endsAt, chargedCents: f.funding === 'invoice' || f.funding === 'card' ? type.priceCents : 0, chargedMinutes: purchaseId ? type.durationMinutes : 0, billable: f.funding === 'invoice' ? 'yes' : 'no' } })
        if (!missed) {
          const n = NOTES[(fi + week) % NOTES.length]
          await tx.sessionNote.create({ data: { profileId, sessionId: s.id, ...n, effort: 3 + ((fi + week) % 3), privateNote: week === 1 && f.students[0].needs ? `Watch: ${f.students[0].needs}` : '', sharedAt: endsAt } })
          const due = new Date(startsAt.getTime() + 6 * 86_400_000)
          await tx.homework.create({ data: { profileId, sessionId: s.id, studentId: ids[0], title: HOMEWORK[(fi + week) % HOMEWORK.length], instructions: `Based on today: ${n.workOnNext}`, dueAt: due, status: due < now ? 'reviewed' : 'assigned', ...(due < now ? { handedInAt: new Date(due.getTime() - 86_400_000), feedback: 'Good work. Check your units on the last two.', reviewedAt: due } : {}) } })
        }
      })
      // Card families paid each lesson to the tutor directly (recorded by hand).
      if (f.funding === 'card' && !missed) await recordPayment(prisma, profileId, { target: { kind: 'session', id: s.id }, method: fi === 8 ? 'cash' : 'other', reference: fi === 8 ? '' : 'Venmo' })
      if (f.funding === 'card') await prisma.payment.updateMany({ where: { sessionId: s.id }, data: { paidAt: endsAt } })
    }

    // Upcoming weeks through the real generator (the booking lock and slot check).
    await prisma.recurringSeries.update({ where: { id: series.id }, data: { generatedThrough: addDays(today, -1) } })
    await topUpSeries(prisma, profileId, series.id)

    // Marks that improve.
    const base = 58 + fi * 2
    for (let m = 0; m < 4; m++) await prisma.progressMark.create({ data: { profileId, studentId: ids[0], label: f.type === '90-minute lesson' || f.students[0].subjects.includes('SAT maths') ? `SAT practice test ${m + 1}` : `Unit ${m + 2} test`, takenOn: businessWallTime(addDays(first, m * 10), 720, TZ), score: f.students[0].subjects.includes('SAT maths') ? 520 + m * 35 : Math.min(98, base + m * 8), outOf: f.students[0].subjects.includes('SAT maths') ? 800 : 100 } })
  }

  // Homework currently out: one handed in, waiting for feedback.
  const open = await prisma.homework.findFirst({ where: { profileId, status: 'assigned' }, orderBy: { dueAt: 'asc' } })
  if (open) await prisma.homework.update({ where: { id: open.id }, data: { status: 'handed_in', handedInAt: now, guardianComment: 'Done. Question 7 was hard.', handInUrl: 'https://docs.google.com/document/d/practice-hand-in' } })

  // Invoices: Priya Raman's paid, Grace Whitfield's overdue with a reported payment waiting.
  const paidInv = await createInvoice(prisma, profileId, { familyId: familyIds[2] })
  const sentPaid = await sendInvoice(prisma, profileId, paidInv.id)
  await recordPayment(prisma, profileId, { target: { kind: 'invoice', id: paidInv.id }, method: 'bank_transfer', reference: 'Zelle 4410' })
  await prisma.invoice.update({ where: { id: paidInv.id }, data: { issuedAt: new Date(now.getTime() - 20 * 86_400_000), dueAt: new Date(now.getTime() - 13 * 86_400_000) } })
  void sentPaid
  const overdue = await createInvoice(prisma, profileId, { familyId: familyIds[3], extraLines: [{ description: 'Workbook: Pre-Algebra Practice', quantity: 1, unitCents: 1800 }] })
  await sendInvoice(prisma, profileId, overdue.id)
  await prisma.invoice.update({ where: { id: overdue.id }, data: { issuedAt: new Date(now.getTime() - 16 * 86_400_000), dueAt: new Date(now.getTime() - 9 * 86_400_000) } })
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: overdue.id } })
  await reportPayment(prisma, profileId, familyIds[3], { target: { kind: 'invoice', id: overdue.id }, amountCents: Math.floor(inv.totalCents / 2), method: 'bank_transfer', reference: 'Chase transfer 0093' })

  // Reviews (published) and inquiries (new).
  const reviews = [
    { f: 0, r: 5, name: 'Parent of a Grade 10 student', body: 'Chidi went from a C to a B+ in one semester. The notes after every session mean I always know what they worked on.' },
    { f: 1, r: 5, name: 'Parent of a Grade 11 student', body: 'Freya’s SAT maths went up 110 points. Daniel is calm, organised and honest about what needs work.' },
    { f: 6, r: 5, name: 'Parent of a Grade 12 student', body: 'Patient and very clear. Hana actually enjoys calculus now.' },
  ]
  for (const r of reviews) await prisma.review.create({ data: { profileId, familyId: familyIds[r.f], rating: r.r, displayName: r.name, body: r.body, status: 'published' } })
  await sendInquiry(prisma, { slug: SLUG, name: 'Jennifer Park', email: 'jen.park@example.com', studentLevel: 'Grade 9', subject: 'Maths', message: 'My son is struggling with Algebra I and has a test in three weeks. Do you have any Tuesday evenings?' })
  await sendInquiry(prisma, { slug: SLUG, name: 'Ahmed Siddiqui', phone: '(512) 555-0199', studentLevel: 'Grade 11', subject: 'Physics', message: 'Looking for AP Physics help, in person if possible, near Cedar Park.' })

  // One guardian account so the family side can be shown (optional).
  const famPassword = process.env.SEED_FAMILY_PASSWORD
  if (famPassword && famPassword.length >= 8) {
    const role = await prisma.role.findFirst({ where: { name: 'Family' } }) ?? await prisma.role.create({ data: { name: 'Family' } })
    const u = await sudo.db.User.createOne({ data: { name: FAMILIES[0].guardian, email: FAMILIES[0].email, password: famPassword, role: { connect: { id: role.id } }, onboardingStatus: 'done' } })
    await prisma.family.update({ where: { id: familyIds[0] }, data: { userId: String(u.id) } })
  }

  // §9 invariant on every package.
  const purchases = await prisma.packagePurchase.findMany({ where: { profileId }, select: { id: true } })
  for (const p of purchases) {
    const c = await checkPurchase(prisma as never, p.id)
    if (!c.ok) throw new Error(`Ledger invariant failed on ${p.id}: stored ${c.stored}, ledger ${c.ledger}`)
  }
  const counts = await Promise.all([prisma.family.count({ where: { profileId } }), prisma.student.count({ where: { profileId } }), prisma.session.count({ where: { profileId } }), prisma.invoice.count({ where: { profileId } })])
  console.log(`Tutor login: ${email} (the SEED_TUTOR_PASSWORD you set)`)
  console.log(famPassword && famPassword.length >= 8 ? `Guardian login: ${FAMILIES[0].email} (the SEED_FAMILY_PASSWORD you set)` : 'No guardian login made: set SEED_FAMILY_PASSWORD (8+ characters) to add one.')
  console.log(`Seeded /t/${SLUG}: ${counts[0]} families, ${counts[1]} students, ${counts[2]} sessions, ${counts[3]} invoices; ledger invariant holds on ${purchases.length} packages.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
