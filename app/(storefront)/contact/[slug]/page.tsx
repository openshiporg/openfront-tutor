import ContactPage from '@/features/storefront/screens/ContactPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ContactPage slug={slug} />
}
