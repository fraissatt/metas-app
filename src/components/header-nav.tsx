'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function HeaderNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
      {NAV_LINKS.map(({ href, label }) => {
        const active = isLinkActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
