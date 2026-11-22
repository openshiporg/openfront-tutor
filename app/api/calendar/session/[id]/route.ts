import { sessionIcs } from '@/features/keystone/api/calendar'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return sessionIcs(request, (await params).id)
}
