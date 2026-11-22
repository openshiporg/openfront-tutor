import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Wordmark } from './Wordmark'

export function Footer({ name, sub, place, email, phone, slug }: { name: string; sub: string; place: string | null; email: string | null; phone: string | null; slug?: string | null }) {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:gap-10 lg:px-[5%]">
        <Wordmark name={name} sub={sub} light className="md:border-r md:border-white/25 md:pr-10" />
        <ul className="flex flex-col gap-3 text-[15px] text-white/90 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10">
          {place ? <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden />{place}</li> : null}
          {email ? <li><a href={`mailto:${email}`} className="flex min-h-11 items-center gap-2 hover:underline"><Mail className="size-4 shrink-0" aria-hidden /><span className="break-all">{email}</span></a></li> : null}
          {phone ? <li><a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex min-h-11 items-center gap-2 hover:underline"><Phone className="size-4 shrink-0" aria-hidden />{phone}</a></li> : null}
        </ul>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[14px] text-white/80 md:ml-auto">
          {slug ? <Link href={`/contact/${slug}`} className="flex min-h-11 items-center hover:text-white hover:underline">Ask a question</Link> : null}
          <Link href="/account" className="flex min-h-11 items-center hover:text-white hover:underline">Family account</Link>
          <Link href="/dashboard" className="flex min-h-11 items-center hover:text-white hover:underline">Tutor sign in</Link>
        </nav>
      </div>
    </footer>
  )
}
