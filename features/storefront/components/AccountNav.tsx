'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CalendarDays, FileText, FolderOpen, Home, LineChart, NotebookPen, Package, Settings, Users } from 'lucide-react'
import { cx } from './ui'

const ITEMS = [
  { href: '/account', label: 'Home', icon: Home, exact: true },
  { href: '/account/sessions', label: 'Sessions', icon: CalendarDays },
  { href: '/account/book', label: 'Book', icon: BookOpen },
  { href: '/account/students', label: 'Students', icon: Users },
  { href: '/account/homework', label: 'Homework', icon: NotebookPen },
  { href: '/account/progress', label: 'Progress', icon: LineChart },
  { href: '/account/packages', label: 'Packages', icon: Package },
  { href: '/account/invoices', label: 'Invoices', icon: FileText },
  { href: '/account/resources', label: 'Resources', icon: FolderOpen },
  { href: '/account/settings', label: 'Settings', icon: Settings },
]

export function AccountNav() {
  const path = usePathname() ?? ""
  return (
    <nav aria-label="Family account" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map((it) => {
          const active = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`)
          return (
            <li key={it.href} className="shrink-0">
              <Link href={it.href} aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-[15px] font-medium', active ? 'bg-wine text-white' : 'text-ink hover:bg-white')}>
                <it.icon className="size-4" aria-hidden />{it.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
