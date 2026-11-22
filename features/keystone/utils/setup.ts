import type { PrismaClient } from '@prisma/client'

import { CommandError, cleanText, transaction, validTimeZone } from './business'
import { MANUAL_PROVIDER, STRIPE_PROVIDER, stripeOn } from './payments'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/** §8 typical hours: Monday to Thursday 15:00 to 20:00, Saturday 09:00 to 13:00. */
const TYPICAL_HOURS: Record<string, [number, number] | null> = { sunday: null, monday: [900, 1200], tuesday: [900, 1200], wednesday: [900, 1200], thursday: [900, 1200], friday: null, saturday: [540, 780] }

export function policyText(p: { cancellationWindowHours: number; lateCancelPercent: number; noShowPercent: number }) {
  const charge = (n: number) => (n === 100 ? 'charged in full' : n === 0 ? 'not charged' : `charged ${n}% of the price`)
  return [
    `You can cancel or move a session for free up to ${p.cancellationWindowHours} hours before it starts.`,
    `A cancellation inside ${p.cancellationWindowHours} hours is ${charge(p.lateCancelPercent)}; a missed session is ${charge(p.noShowPercent)}.`,
    'If something serious comes up, tell me: I can excuse a late cancellation.',
    'Package minutes are valid for 12 months from purchase.',
  ].join(' ')
}

export type SetupInput = {
  businessName: string; tutorName?: string | null; slug: string; timezone: string; currencyCode?: string | null; country?: string | null
  subjects?: string[] | null; levels?: string | null; teachesOnline?: boolean | null; teachesInPerson?: boolean | null
  hourlyRateCents?: number | null; typicalSetup?: boolean | null; email?: string | null
}

/**
 * First-run setup (W1, §8). The typical setup creates only things a real tutor
 * would keep and edit: no families, nothing "sample".
 */
export async function setUpMyBusiness(prisma: PrismaClient, userId: string, input: SetupInput) {
  const businessName = cleanText(input.businessName, 120)
  const slug = cleanText(input.slug, 41).toLowerCase()
  if (!businessName) throw new CommandError('Enter your business name.')
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) throw new CommandError('Page address: 2 to 41 lowercase letters, numbers or hyphens.')
  const timezone = validTimeZone(input.timezone)
  if (!timezone) throw new CommandError('Choose your timezone.')
  const currencyCode = (cleanText(input.currencyCode, 3) || 'USD').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new CommandError('Choose a currency.')
  const rate = input.hourlyRateCents == null ? 6000 : Math.floor(Number(input.hourlyRateCents))
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > 10_000_000) throw new CommandError('Enter your hourly rate.')
  const online = input.teachesOnline !== false
  const inPerson = Boolean(input.teachesInPerson)
  if (!online && !inPerson) throw new CommandError('Choose online, in person or both.')
  const typical = input.typicalSetup !== false
  const subjects = (input.subjects ?? []).map((s) => cleanText(s, 80)).filter(Boolean).slice(0, 20)
  const levels = cleanText(input.levels, 120)
  const mode = online && inPerson ? 'either' : online ? 'online' : 'in_person'
  const policy = { cancellationWindowHours: 24, lateCancelPercent: 100, noShowPercent: 100 }

  return transaction(prisma, async (tx) => {
    if (await tx.tutorProfile.findFirst({ where: { ownerId: userId } })) throw new CommandError('Your business is already set up.')
    if (await tx.tutorProfile.findUnique({ where: { slug } })) throw new CommandError('That page address is taken. Try another.')
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } })
    const profile = await tx.tutorProfile.create({
      data: {
        ownerId: userId, businessName, tutorName: cleanText(input.tutorName, 120) || user.name, slug, timezone, currencyCode,
        country: cleanText(input.country, 2).toUpperCase(), email: cleanText(input.email, 200) || user.email, teachesOnline: online, teachesInPerson: inPerson,
        ...policy, policiesText: typical ? policyText(policy) : '',
        paymentInstructions: typical ? 'Pay by bank transfer or your usual payment app and put your child’s name as the reference. Tell me when it is sent.' : '',
      },
    })
    for (const [i, name] of subjects.entries()) await tx.subject.create({ data: { profileId: profile.id, name, levels, sortOrder: i } })
    await tx.weeklyHours.createMany({
      data: DAYS.map((d) => {
        const h = typical ? TYPICAL_HOURS[d] : (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d) ? [900, 1200] as [number, number] : null)
        return { profileId: profile.id, dayOfWeek: d, isWorking: Boolean(h), startMinute: h?.[0] ?? 900, endMinute: h?.[1] ?? 1200 }
      }),
    })
    await tx.paymentProvider.create({ data: { profileId: profile.id, ...MANUAL_PROVIDER } })
    if (stripeOn()) await tx.paymentProvider.create({ data: { profileId: profile.id, ...STRIPE_PROVIDER } })
    if (typical) {
      const per = (minutes: number) => Math.round((rate * minutes) / 60)
      const types = [
        { name: 'Free 20-minute consultation', description: 'A short call to talk about goals and how I can help. No charge.', durationMinutes: 20, priceCents: 0, openToNewFamilies: true },
        { name: 'First lesson', description: 'A full first lesson: I find out where the student is and we start work.', durationMinutes: 60, priceCents: per(60), openToNewFamilies: true },
        { name: '60-minute lesson', description: 'A regular lesson.', durationMinutes: 60, priceCents: per(60), openToNewFamilies: false },
        { name: '90-minute lesson', description: 'A longer lesson for exam years or bigger topics.', durationMinutes: 90, priceCents: per(90), openToNewFamilies: false },
        { name: 'Exam review session', description: 'Two hours of focused review before a test or exam.', durationMinutes: 120, priceCents: per(120), openToNewFamilies: false },
      ]
      const subjectIds = (await tx.subject.findMany({ where: { profileId: profile.id }, select: { id: true } })).map((s) => s.id)
      for (const [i, t] of types.entries()) await tx.sessionType.create({ data: { ...t, profileId: profile.id, mode, sortOrder: i, subjects: { connect: subjectIds.map((id) => ({ id })) } } })
      const packs = [{ hours: 5, off: 5 }, { hours: 10, off: 10 }, { hours: 20, off: 15 }]
      for (const [i, p] of packs.entries()) {
        await tx.package.create({ data: { profileId: profile.id, name: `${p.hours} hours`, description: `${p.hours} hours of lessons, ${p.off}% off. Valid for 12 months.`, minutes: p.hours * 60, priceCents: Math.round(rate * p.hours * (100 - p.off) / 100), validMonths: 12, sortOrder: i } })
      }
    }
    await tx.user.update({ where: { id: userId }, data: { onboardingStatus: 'done' } })
    return { profileId: profile.id, slug: profile.slug }
  })
}
