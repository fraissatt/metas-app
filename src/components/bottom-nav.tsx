'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, Target } from 'lucide-react'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const ICONS = { '/': CalendarCheck, '/objectives': Target } as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch justify-around border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_LINKS.map(({ href, label }) => {
        const active = isLinkActive(pathname, href)
        const Icon = ICONS[href]
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-16 flex-col items-center justify-center gap-0.5 px-4 text-xs font-medium transition-colors',
              active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
            )}
          >
            <span className={cn('rounded-full px-4 py-0.5 transition-colors', active && 'bg-sidebar-accent')}>
              <Icon className="size-5" />
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
