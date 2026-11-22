import { runJobs } from '@/features/keystone/api/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return runJobs(request)
}
