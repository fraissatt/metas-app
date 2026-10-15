'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, Target } from 'lucide-react'
import { FloatingBar } from '@/components/floating-bar'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const ICONS = { '/': CalendarCheck, '/objectives': Target } as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <FloatingBar
      edge="bottom"
      when="(max-width: 767px)"
      className="island fixed inset-x-0 bottom-[calc(0.75rem_+_env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full md:hidden"
    >
      <nav aria-label="Navegação principal" className="flex items-stretch justify-around gap-1 px-2 py-1">
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
    </FloatingBar>
  )
}
