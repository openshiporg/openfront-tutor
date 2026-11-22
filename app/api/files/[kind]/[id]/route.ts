import { serveFile } from '@/features/keystone/api/files'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params
  return serveFile(request, kind, id)
}
