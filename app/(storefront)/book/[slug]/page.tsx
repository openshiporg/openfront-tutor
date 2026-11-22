import BookPage from '@/features/storefront/screens/BookPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> }) {
  const [{ slug }, { type }] = await Promise.all([params, searchParams])
  return <BookPage slug={slug} typeId={type} />
}
