import type { Metadata } from 'next'
import { Caveat, Dancing_Script, Lora, Source_Sans_3 } from 'next/font/google'
import { StorefrontShell } from '@/features/storefront/screens/StorefrontShell'
import { getHomeTutor } from '@/features/storefront/lib/data/public'
import { displayName } from '@/features/storefront/lib/format'

const serif = Lora({ variable: '--font-sf-serif', subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'] })
const script = Dancing_Script({ variable: '--font-sf-script', subsets: ['latin'], weight: ['600', '700'] })
const hand = Caveat({ variable: '--font-sf-hand', subsets: ['latin'], weight: ['500', '600'] })
const sans = Source_Sans_3({ variable: '--font-sf-sans', subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export async function generateMetadata(): Promise<Metadata> {
  const r = await getHomeTutor()
  const t = r.ok ? r.data : null
  if (!t) return { title: 'Private tutoring', robots: { index: false, follow: false } }
  const name = displayName(t)
  return {
    title: { default: t.headline ? `${name}: ${t.headline}` : name, template: `%s · ${name}` },
    description: t.bio?.slice(0, 160) || t.headline || `Book lessons with ${name}.`,
    openGraph: t.heroImageUrl || t.photoUrl ? { images: [{ url: (t.heroImageUrl || t.photoUrl)! }] } : undefined,
  }
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${script.variable} ${hand.variable} ${sans.variable} min-h-dvh bg-paper font-body text-ink antialiased`}>
      <StorefrontShell>{children}</StorefrontShell>
    </div>
  )
}
