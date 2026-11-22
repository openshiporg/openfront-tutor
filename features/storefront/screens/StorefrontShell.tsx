import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { getHomeTutor } from '../lib/data/public'
import { getViewer } from '../lib/data/account'
import { displayName, placeName, tagline } from '../lib/format'

/** Header and footer around every storefront page, filled from the tutor's own record. */
export async function StorefrontShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [r, viewer] = await Promise.all([getHomeTutor(), getViewer()])
  const t = r.ok ? r.data : null
  const name = t ? displayName(t) : 'Private tutoring'
  const sub = t ? tagline(t) : ''
  const place = t ? placeName(t.city, t.country) || (t.teachesOnline ? 'Online lessons' : null) : null
  return (
    <div className={`flex min-h-dvh flex-col overflow-x-clip ${className}`}>
      <Header name={name} sub={sub} slug={t?.slug ?? null} viewer={viewer} />
      <div className="flex-1">{children}</div>
      <Footer name={name} sub={sub} place={place} email={t?.email ?? null} phone={t?.phone ?? null} slug={t?.slug ?? null} />
    </div>
  )
}
