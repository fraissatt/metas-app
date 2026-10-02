import Link from 'next/link'
import { getTodaySummary } from '@/lib/actions/summary'
import { search } from '@/lib/actions/search'
import { BottomNav } from '@/components/bottom-nav'
import { DaySummary } from '@/components/day-summary'
import { HeaderNav } from '@/components/header-nav'
import { SearchDialog } from '@/components/search-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Theme } from '@/lib/theme'

export async function AppHeader({
  theme,
  onThemeChange,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
}) {
  const summary = await getTodaySummary()

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-8">
          <Link href="/" className="text-base font-bold text-accent-foreground">
            Metas
          </Link>
          <HeaderNav />
          <div className="flex-1" />
          <SearchDialog onSearch={search} />
          <DaySummary {...summary} />
          <ThemeToggle
            theme={theme}
            onChange={onThemeChange}
            className="px-2 text-muted-foreground hover:text-foreground"
            labelClassName="sr-only"
          />
        </div>
      </header>
      <BottomNav />
    </>
  )
}
