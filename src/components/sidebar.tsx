'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, Target } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Hoje', icon: CalendarCheck },
  { href: '/objectives', label: 'Objetivos', icon: Target },
]

function isLinkActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({
  theme,
  onThemeChange,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className="group fixed inset-x-0 bottom-0 z-50 flex h-14 items-center justify-around border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:inset-y-0 md:left-0 md:h-screen md:w-14 md:flex-col md:items-stretch md:justify-start md:gap-1 md:border-t-0 md:border-r md:p-3 md:transition-[width] md:duration-200 md:ease-in-out md:hover:w-52 md:focus-within:w-52 motion-reduce:transition-none"
    >
      <span className="hidden overflow-hidden text-sm font-bold whitespace-nowrap text-sidebar-primary opacity-0 transition-opacity md:mb-2 md:block md:px-2 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        Metas
      </span>
      {links.map(({ href, label, icon: Icon }) => {
        const active = isLinkActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground md:w-full md:justify-center md:group-hover:justify-start md:group-focus-within:justify-start',
              active && 'bg-sidebar-accent text-sidebar-accent-foreground hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="hidden overflow-hidden whitespace-nowrap opacity-0 transition-opacity md:inline md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {label}
            </span>
          </Link>
        )
      })}
      {/* Temporary home until the header exists. On desktop it sinks to the
          bottom of the rail; on mobile it is the bottom bar's third item. */}
      <ThemeToggle
        theme={theme}
        onChange={onThemeChange}
        className="md:mt-auto md:w-full md:justify-center md:group-hover:justify-start md:group-focus-within:justify-start"
        labelClassName="hidden overflow-hidden whitespace-nowrap opacity-0 transition-opacity md:inline md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      />
    </nav>
  )
}
