import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock, GraduationCap, Home, Laptop, MapPin, Package, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { getHomeTutor, getPublicTutor } from '../lib/data/public'
import { getViewer } from '../lib/data/account'
import type { PublicTutor } from '../lib/types'
import { dayName, displayName, duration, firstName, hoursOf, minuteOfDay, modeLabel, money, priceLabel, sortDays, zoneName } from '../lib/format'
import { Photo } from '../components/Photo'
import { ReviewCarousel } from '../components/ReviewCarousel'
import { InquiryForm } from '../components/InquiryForm'
import { Badge, ButtonLink, Card, Notice, SectionTitle, Stroke, btn, cx } from '../components/ui'

/** A neutral line drawing for the top right of the hero (books, a pencil and stars): fits any subject or city. */
function HeroSketch({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 260 150" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 128h190" opacity=".5" />
      <rect x="62" y="96" width="92" height="16" rx="2" /><path d="M70 96v16M146 96v16" opacity=".6" />
      <rect x="70" y="80" width="80" height="16" rx="2" /><path d="M78 80v16" opacity=".6" />
      <rect x="58" y="112" width="104" height="16" rx="2" /><path d="M66 112v16M150 112v16" opacity=".6" />
      <path d="M176 128l36-74 9 4-36 74-10 6z" /><path d="M212 54l3-8 9 4-3 8M185 132l-1-10" opacity=".7" />
      <path d="M96 80c4-22 18-34 34-38 12-3 24 0 30 6" opacity=".55" strokeDasharray="3 5" />
      <path d="M170 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM226 18l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM118 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      <path d="M30 70c8-3 16-3 24 0M24 84c10-3 20-3 30 0" opacity=".45" />
    </svg>
  )
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function firstParagraph(text: string | null | undefined, max = 230) {
  const p = (text || '').split(/\n\s*\n/)[0]?.trim() || ''
  if (p.length <= max) return p
  const cut = p.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '))
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

function strip(t: PublicTutor) {
  const levels = [...new Set(t.subjects.map((s) => s.levels).filter(Boolean))] as string[]
  const items: Array<{ icon: typeof Users; title: string; text: string }> = []
  items.push({ icon: Users, title: levels.length ? levels[0]! : 'One to one', text: levels.length > 1 ? levels.slice(1, 3).join(' · ') : 'Lessons for your goals, your level and your pace' })
  if (t.teachesInPerson) items.push({ icon: Home, title: t.city ? `In ${t.city}` : 'In person', text: t.inPersonArea || 'Lessons in person, face to face' })
  if (t.teachesOnline) items.push({ icon: Laptop, title: 'Online, anywhere', text: 'The same personal lessons, wherever you are' })
  if (t.subjects.length) items.push({ icon: Sparkles, title: t.subjects.length > 1 ? `${t.subjects.length} subjects` : t.subjects[0].name, text: t.subjects.map((s) => s.name).slice(0, 4).join(', ') })
  if (items.length < 4) items.push({ icon: ShieldCheck, title: `${t.cancellationWindowHours}-hour notice`, text: 'Simple, fair booking rules' })
  if (items.length < 4) items.push({ icon: CalendarDays, title: 'Book online', text: 'Choose a time that suits you, in your own timezone' })
  return items.slice(0, 4)
}

export default async function HomePage({ slug }: { slug?: string } = {}) {
  const [r, viewer] = await Promise.all([slug ? getPublicTutor(slug) : getHomeTutor(), getViewer()])
  if (!r.ok) {
    return <main className="mx-auto max-w-2xl px-6 py-20"><Notice tone="error">{r.error}</Notice></main>
  }
  const t = r.data
  if (!t) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <SectionTitle as="h1" center sub="The tutor has not finished setting up this page yet.">Opening soon</SectionTitle>
        <ButtonLink href="/dashboard" variant="outline">Tutor sign in</ButtonLink>
      </main>
    )
  }
  const name = displayName(t)
  const first = firstName(t)
  const known = Boolean(viewer && !viewer.isTutor)
  const openTypes = t.sessionTypes.filter((s) => s.openToNewFamilies)
  const freeIntro = openTypes.find((s) => s.priceCents === 0)
  const heroCta = known
    ? { href: '/account/book', label: 'Book your next lesson' }
    : freeIntro
      ? { href: `/book/${t.slug}?type=${freeIntro.id}`, label: `Book a ${lowerFirst(freeIntro.name)}` }
      : openTypes[0]
        ? { href: `/book/${t.slug}?type=${openTypes[0].id}`, label: `Book a ${lowerFirst(openTypes[0].name)}` }
        : { href: '#contact', label: 'Ask about lessons' }
  const headline = t.headline?.trim() || `Lessons with ${first}`
  const intro = firstParagraph(t.bio) || t.qualifications || ''
  const bioParas = (t.bio || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const place = [t.city, t.country].filter(Boolean).join(', ')
  const hours = sortDays(t.hours).filter((h) => h.isWorking)
  const zone = zoneName(t.timezone)
  const subjectsForCards = t.subjects.length ? t.subjects : []
  const closingTitle = t.subjects.length === 1 ? `Ready to make progress in ${t.subjects[0].name}?` : 'Ready for your first lesson?'

  return (
    <main id="top">
      {/* Hero: photo on the left, headline on paper to the right (the header floats over the top). */}
      <section className="relative -mt-[76px] overflow-hidden bg-paper sm:-mt-[86px]">
        <div className="grid lg:min-h-[620px] lg:grid-cols-[57%_43%]">
          <div className="relative h-[340px] sm:h-[440px] lg:h-auto">
            <Photo src={t.heroImageUrl || t.photoUrl} alt={`${name} teaching`} label={t.heroImageUrl || t.photoUrl ? undefined : first} />
            <div aria-hidden className="absolute inset-y-0 right-0 hidden w-40 bg-gradient-to-r from-transparent to-paper lg:block" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-paper lg:hidden" />
          </div>
          <div className="relative flex flex-col justify-center px-6 pb-10 pt-2 sm:px-10 lg:py-28 lg:pl-6 lg:pr-[6%]">
            <HeroSketch className="pointer-events-none absolute right-4 top-20 hidden h-36 w-60 text-ink/45 lg:block xl:right-8" />
            <h1 className="relative max-w-[15ch] font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.015em] text-ink sm:text-[52px] lg:text-[54px] xl:text-[60px]">{headline}</h1>
            <Stroke className="mt-3" width={150} />
            {intro ? <p className="mt-6 max-w-[34ch] text-[17px] leading-relaxed text-ink sm:text-[18px] lg:pl-5">{intro}</p> : null}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:pl-5">
              {t.bookingOpen ? <Link href={heroCta.href} className={cx(btn.primary, 'min-h-12 px-6 text-[16px]')}><CalendarDays className="size-[18px]" aria-hidden />{heroCta.label}</Link> : null}
              <Link href="#rates" className={cx(btn.outline, 'min-h-12 px-6 text-[16px]')}>See my lessons</Link>
            </div>
            {!t.bookingOpen ? <p className="mt-4 text-[15px] text-ink-soft lg:pl-5">Online booking is paused right now. Send a message below and {first} will reply.</p> : null}
          </div>
        </div>
      </section>

      {/* Four-item icon strip. */}
      <section aria-label="At a glance" className="border-y border-line/60 bg-paper-deep/70">
        <ul className="mx-auto grid max-w-[1320px] grid-cols-1 gap-y-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-[5%]">
          {strip(t).map((it, i) => (
            <li key={it.title} className={cx('flex items-start gap-3.5 lg:px-6', i > 0 && 'lg:border-l lg:border-ink/15')}>
              <it.icon className="mt-0.5 size-7 shrink-0 text-wine" strokeWidth={1.6} aria-hidden />
              <div className="min-w-0">
                <p className="font-display text-[18px] font-semibold italic text-ink">{it.title}</p>
                <p className="mt-0.5 text-[14.5px] italic leading-snug text-ink-soft">{it.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Subjects as rounded photo cards. */}
      {subjectsForCards.length ? (
        <section id="lessons" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 pb-4 pt-12 sm:px-8">
          <SectionTitle className="lg:ml-[13%]">{t.subjects.length === 1 ? `${t.subjects[0].name} lessons for your goals` : 'Lessons for your goals'}</SectionTitle>
          <div className="grid gap-5 md:grid-cols-2">
            {subjectsForCards.map((s) => {
              const types = t.sessionTypes.filter((x) => x.subjectIds.includes(s.id))
              return (
                <article key={s.id} className="grid overflow-hidden rounded-2xl bg-card-blush/80 shadow-[0_1px_2px_rgba(28,42,74,0.06)] sm:grid-cols-[38%_62%]">
                  <div className="h-44 sm:h-auto sm:min-h-[168px]"><Photo src={s.imageUrl} alt={s.name} label={s.imageUrl ? undefined : s.name.slice(0, 1)} /></div>
                  <div className="p-5 sm:p-6">
                    <h3 className="flex items-center gap-2 font-display text-[21px] font-semibold text-ink"><GraduationCap className="size-5 text-wine" aria-hidden />{s.name}</h3>
                    {s.levels ? <p className="mt-1 text-[14px] font-semibold text-wine">{s.levels}</p> : null}
                    <p className="mt-2 text-[15px] leading-relaxed text-ink">{s.description || (types.length ? types.map((x) => x.name).join(', ') : `One-to-one ${s.name.toLowerCase()} lessons, planned around the student.`)}</p>
                    <Link href={`/book/${t.slug}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-wine underline underline-offset-4">Book a lesson<ArrowRight className="size-4" aria-hidden /></Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* About + review card. */}
      <section id="about" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-10 sm:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-0">
          <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr] lg:pr-10">
            <div className="mx-auto size-[200px] overflow-hidden rounded-full bg-card-blush shadow-[0_8px_24px_rgba(28,42,74,0.12)] sm:size-[220px]">
              <Photo src={t.photoUrl} alt={name} label={t.photoUrl ? undefined : first.slice(0, 1)} />
            </div>
            <div>
              <h2 className="relative inline-block font-display text-[30px] font-semibold italic text-ink">
                Hi, I’m {first}!
                <svg aria-hidden viewBox="0 0 24 24" className="absolute -right-7 -top-2 size-6 text-wine"><path d="M4 9l3-6M10 10l5-4M12 15l7-1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </h2>
              <div className="mt-2 space-y-2.5 text-[15.5px] leading-relaxed text-ink">
                {(bioParas.length > 1 ? bioParas.slice(1) : bioParas).slice(0, 3).map((p, i) => <p key={i}>{p}</p>)}
                {t.qualifications ? <p className="text-ink-soft">{t.qualifications}</p> : null}
              </div>
              {place || t.inPersonArea ? <p className="mt-3 flex items-center gap-1.5 text-[14px] text-ink-soft"><MapPin className="size-4" aria-hidden />{[t.inPersonArea, place].filter(Boolean).join(' · ')}</p> : null}
              <Link href="#rates" className={cx(btn.outline, 'mt-4 min-h-11 rounded-xl px-4 text-[15px]')}>See lessons and rates</Link>
            </div>
          </div>
          {t.reviews.length ? (
            <div className="lg:border-l lg:border-ink/15 lg:pl-10">
              <ReviewCarousel reviews={t.reviews} />
              {t.rating ? <p className="mt-2 text-center text-[13.5px] text-ink-soft">{t.rating.average} out of 5 from {t.rating.count} {t.rating.count === 1 ? 'family' : 'families'}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Rates: session types and packages. */}
      <section id="rates" className="scroll-mt-24 bg-paper-deep/60 py-12">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <SectionTitle sub={`Prices in ${t.currencyCode}. ${t.teachesOnline && t.teachesInPerson ? 'Online or in person.' : t.teachesOnline ? 'All lessons are online.' : 'Lessons are in person.'}`}>Lessons and rates</SectionTitle>
          {t.sessionTypes.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.sessionTypes.map((s) => {
                const canBook = t.bookingOpen && (known || s.openToNewFamilies)
                const href = known ? `/account/book?type=${s.id}` : `/book/${t.slug}?type=${s.id}`
                return (
                  <li key={s.id}>
                    <Card className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-[19px] font-semibold text-ink">{s.name}</h3>
                        <span className="shrink-0 font-display text-[20px] font-semibold text-wine">{priceLabel(s.priceCents, t.currencyCode)}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-soft">
                        <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{duration(s.durationMinutes)}</span>
                        <span>{modeLabel(s.mode)}</span>
                        {s.maxStudents > 1 ? <span>Up to {s.maxStudents} siblings</span> : null}
                      </p>
                      {s.description ? <p className="mt-2 text-[15px] leading-relaxed text-ink">{s.description}</p> : null}
                      <div className="mt-auto pt-4">
                        {canBook ? (
                          <Link href={href} className={cx(btn.primary, 'w-full')}>Book</Link>
                        ) : (
                          <p className="text-[14px] text-ink-soft">{s.openToNewFamilies ? 'Booking is paused.' : 'For current families. Start with a first session, then book this from your account.'}</p>
                        )}
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          ) : <p className="text-ink-soft">Lesson types are coming. Send a message below to ask about lessons.</p>}

          {t.packages.length ? (
            <div className="mt-10">
              <h3 className="flex items-center gap-2 font-display text-[22px] font-semibold italic text-ink"><Package className="size-5 text-wine" aria-hidden />Packages</h3>
              <p className="mt-1 text-[15px] text-ink-soft">Prepaid time at a lower rate. Each lesson uses its length from your balance, and your balance is always in your account.</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {t.packages.map((p) => (
                  <li key={p.id}>
                    <Card className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-display text-[18px] font-semibold text-ink">{p.name}</h4>
                        <span className="shrink-0 font-display text-[20px] font-semibold text-wine">{money(p.priceCents, t.currencyCode)}</span>
                      </div>
                      <p className="mt-1 text-[14px] text-ink-soft">{hoursOf(p.minutes)} · valid {p.validMonths} months{p.minutes >= 60 ? ` · ${money(Math.round(p.priceCents / (p.minutes / 60)), t.currencyCode)} an hour` : ''}</p>
                      {p.description ? <p className="mt-2 text-[15px] text-ink">{p.description}</p> : null}
                      {p.appliesTo.length ? <p className="mt-2 text-[13.5px] text-ink-soft">For: {p.appliesTo.map((a) => a.name).join(', ')}</p> : null}
                      <div className="mt-auto pt-4">
                        <Link href={known ? `/account/packages?buy=${p.id}` : `/account/signin?next=${encodeURIComponent(`/account/packages?buy=${p.id}`)}`} className={cx(btn.outline, 'w-full')}>{known ? 'Buy this package' : 'Sign in to buy'}</Link>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              {!known ? <p className="mt-3 text-[14px] text-ink-soft">New here? Book a first session; you can create your family account from your booking page and buy a package there.</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Hours and policies. */}
      <section id="policies" className="mx-auto grid max-w-[1180px] scroll-mt-24 gap-6 px-5 py-12 sm:px-8 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-[22px] font-semibold italic text-ink">Teaching hours</h2>
          <Stroke width={70} />
          {hours.length ? (
            <dl className="mt-3">
              {hours.map((h) => (
                <div key={h.dayOfWeek} className="flex justify-between gap-4 border-b border-line/60 py-2 text-[15px] last:border-0">
                  <dt className="font-medium text-ink">{dayName(h.dayOfWeek)}</dt>
                  <dd className="text-right text-ink-soft">
                    {h.breakStartMinute != null && h.breakEndMinute != null
                      ? `${minuteOfDay(h.startMinute)}–${minuteOfDay(h.breakStartMinute)}, ${minuteOfDay(h.breakEndMinute)}–${minuteOfDay(h.endMinute)}`
                      : `${minuteOfDay(h.startMinute)}–${minuteOfDay(h.endMinute)}`}
                  </dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-3 text-[15px] text-ink-soft">Hours are agreed with each family.</p>}
          <p className="mt-3 text-[13.5px] text-ink-soft">Times in {zone}. When you book, every time is shown in your own timezone.</p>
        </Card>
        <Card>
          <h2 className="font-display text-[22px] font-semibold italic text-ink">Booking and cancelling</h2>
          <Stroke width={70} />
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink">
            <li>Cancel or move a lesson for free up to <strong>{t.cancellationWindowHours} hours</strong> before it starts.</li>
            <li>{t.lateCancelPercent === 0 ? 'Later cancellations are not charged.' : `Later cancellations are charged ${t.lateCancelPercent === 100 ? 'in full' : `at ${t.lateCancelPercent}%`}.`} {t.noShowPercent === 0 ? 'A missed lesson is not charged.' : `A missed lesson is charged ${t.noShowPercent === 100 ? 'in full' : `at ${t.noShowPercent}%`}.`}</li>
            <li>Book at least {t.minNoticeHours} hours ahead, up to {t.maxAdvanceDays} days out.</li>
            {t.cardPayments ? <li>Paid lessons booked online are paid by card; the time is held for {t.unpaidHoldMinutes} minutes while you pay.</li> : <li>You pay {first} directly; the details are on your booking page.</li>}
          </ul>
          {t.policiesText ? <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">{t.policiesText}</p> : null}
        </Card>
      </section>

      {/* Contact form (S6). */}
      <section id="contact" className="scroll-mt-24 pb-12">
        <div className="mx-auto max-w-[860px] px-5 sm:px-8">
          <Card className="bg-white/90">
            <SectionTitle sub={`Not sure where to start? Tell ${first} a little about the student and you will get a reply by email or phone.`}>Ask about tutoring</SectionTitle>
            <InquiryForm slug={t.slug} subjects={t.subjects.map((s) => s.name)} tutorFirstName={first} />
          </Card>
        </div>
      </section>

      {/* Closing band. */}
      <section className="relative isolate overflow-hidden">
        {t.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tutor-supplied address
          <img src={t.heroImageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : null}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(64,60,104,0.86)_0%,rgba(125,29,52,0.72)_70%,rgba(28,42,74,0.92)_100%)]" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-14 text-center text-white sm:py-16">
          <h2 className="font-display text-[30px] font-semibold leading-tight sm:text-[38px]">{closingTitle}</h2>
          <p className="mt-3 text-[17px] text-white/90">Let’s talk about your goals and find the right lesson plan for you.</p>
          {t.bookingOpen ? (
            <Link href={heroCta.href} className="mt-6 inline-flex min-h-[52px] items-center gap-2.5 rounded-full border-2 border-white/80 bg-wine px-7 text-[17px] font-semibold text-white shadow-lg hover:bg-wine-dark">
              <CalendarDays className="size-5" aria-hidden />{heroCta.label}
            </Link>
          ) : (
            <Link href="#contact" className="mt-6 inline-flex min-h-[52px] items-center rounded-full bg-wine px-7 text-[17px] font-semibold text-white">Send a message</Link>
          )}
          {t.reviews.length && t.rating ? <p className="mt-4"><Badge tone="neutral"><span className="text-white">★ {t.rating.average} · {t.rating.count} reviews</span></Badge></p> : null}
        </div>
      </section>
    </main>
  )
}
