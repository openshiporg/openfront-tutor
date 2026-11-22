import { Card, Stroke } from '@/features/storefront/components/ui'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid max-w-[520px] px-5 py-12 sm:py-16">
      <Card className="bg-white/90 p-6 sm:p-8">{children}</Card>
      <Stroke className="mx-auto mt-6 opacity-40" width={60} />
    </main>
  )
}
