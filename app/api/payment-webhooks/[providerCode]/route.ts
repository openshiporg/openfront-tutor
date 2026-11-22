import { handlePaymentWebhook } from '@/features/keystone/api/payment-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ providerCode: string }> }) {
  return handlePaymentWebhook(request, (await params).providerCode)
}
