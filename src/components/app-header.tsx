import Link from 'next/link'
import { getTodaySummary } from '@/lib/actions/summary'
import { search } from '@/lib/actions/search'
import { leaveGuestToSignUp, signOut } from '@/lib/actions/auth'
import { BackgroundPicker } from '@/components/background-picker'
import { GuestBanner } from '@/components/guest-banner'
import { DaySummary } from '@/components/day-summary'
import { HeaderNav } from '@/components/header-nav'
import { RefreshOnFocus } from '@/components/refresh-on-focus'
import { SearchDialog } from '@/components/search-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import type { CurrentUser } from '@/lib/session'
import type { Theme } from '@/lib/theme'

export async function AppHeader({
  theme,
  onThemeChange,
  user,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
  user: CurrentUser | null
}) {
  // The header is on every page: a failing summary must not take them all down.
  const summary = user ? await getTodaySummary().catch(() => null) : null

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      {user && <RefreshOnFocus />}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-8">
        <Link href="/" className="text-base font-bold text-accent-foreground">
          Metas
        </Link>
        {user && <HeaderNav />}
        <div className="flex-1" />
        {/* Desktop: search, summary, background picker, theme toggle. Mobile: summary, search, then background picker and theme toggle (spec). */}
        {user && (
          <div className="flex items-center max-md:order-2">
            <SearchDialog onSearch={search} />
          </div>
        )}
        {summary && (
          <div className="flex items-center max-md:order-1">
            <DaySummary {...summary} />
          </div>
        )}
        <div className="flex items-center max-md:order-3">
          <BackgroundPicker />
        </div>
        <ThemeToggle
          theme={theme}
          onChange={onThemeChange}
          className="px-2 text-muted-foreground hover:text-foreground max-md:order-3"
          labelClassName="sr-only"
        />
        {user && (
          <div className="flex items-center max-md:order-3">
            <UserMenu name={user.name} isAnonymous={user.isAnonymous} onSignOut={signOut} />
          </div>
        )}
      </div>
      {user?.isAnonymous && <GuestBanner onCreateAccount={leaveGuestToSignUp} />}
    </header>
  )
}
