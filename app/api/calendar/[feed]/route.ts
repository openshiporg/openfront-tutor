import { feedIcs } from '@/features/keystone/api/calendar'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ feed: string }> }) {
  return feedIcs((await params).feed)
}
