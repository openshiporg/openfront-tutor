import HomePage from '@/features/storefront/screens/HomePage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <HomePage slug={slug} />
}
