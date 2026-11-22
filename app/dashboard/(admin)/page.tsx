import { redirect } from 'next/navigation'

/** The tutor lands on Today; it links to first-run setup when the business is not set up yet. */
export default function DashboardHome() { redirect('/dashboard/platform/today') }
