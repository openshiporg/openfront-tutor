import { BookOpen, CalendarDays, CalendarRange, ClipboardCheck, Inbox, MessageSquareQuote, Receipt, Settings, Sun, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PlatformNavItem { title: string; href: string; icon: LucideIcon }

/** Hrefs are relative to the dashboard base path (dissertation §6.2). */
export const platformNavItems: PlatformNavItem[] = [
  { title: 'Today', href: '/platform/today', icon: Sun },
  { title: 'Calendar', href: '/platform/calendar', icon: CalendarDays },
  { title: 'Families', href: '/platform/families', icon: Users },
  { title: 'Homework', href: '/platform/homework', icon: ClipboardCheck },
  { title: 'Resources', href: '/platform/resources', icon: BookOpen },
  { title: 'Billing', href: '/platform/billing', icon: Receipt },
  { title: 'Earnings', href: '/platform/earnings', icon: Wallet },
  { title: 'Inquiries', href: '/platform/inquiries', icon: Inbox },
  { title: 'Reviews', href: '/platform/reviews', icon: MessageSquareQuote },
  { title: 'Weekly series', href: '/platform/calendar/series', icon: CalendarRange },
  { title: 'Settings', href: '/platform/settings', icon: Settings },
]
