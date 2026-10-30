import Link from 'next/link'
import { getTodaySummary } from '@/lib/actions/summary'
import { search } from '@/lib/actions/search'
import { signOut } from '@/lib/actions/auth'
import { GuestBanner } from '@/components/guest-banner'
import { DaySummary } from '@/components/day-summary'
import { FloatingBar } from '@/components/floating-bar'
import { HeaderNav } from '@/components/header-nav'
import { HelpButton } from '@/components/help-button'
import { RefreshOnFocus } from '@/components/refresh-on-focus'
import { SearchDialog } from '@/components/search-dialog'
import { UserMenu } from '@/components/user-menu'
import type { CurrentUser } from '@/lib/session'
import type { Theme } from '@/lib/theme'

/**
 * The bar slides away while the page scrolls down, on desktop only. In the
 * installed app's title bar (window-controls-overlay) it stays: it is the
 * window's title bar and drag area.
 */
export const HIDE_WHEN = '(min-width: 768px)'
export const HIDE_UNLESS = '(display-mode: window-controls-overlay)'

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
    <>
      <header className="sticky top-0 z-40 md:static">
        {user && <RefreshOnFocus />}
        <FloatingBar
          edge="top"
          when={HIDE_WHEN}
          unless={HIDE_UNLESS}
          data-app-bar=""
          className="border-b border-border bg-background/80 backdrop-blur md:island md:fixed md:inset-x-4 md:top-3 md:mx-auto md:max-w-6xl md:rounded-full"
        >
          <div data-app-bar-inner="" className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
            <Link href="/" className="text-base font-bold text-accent-foreground">
              Metas
            </Link>
            {user && <HeaderNav />}
            <div className="flex-1" />
            {/* Desktop: search, summary, user menu. Mobile: summary, search, then the user menu. */}
            {user && (
              <div className="flex items-center max-md:order-2">
                <SearchDialog onSearch={search} />
              </div>
            )}
            {/* From md up only: the header is full on phones, where "Ver tour" stays in the account menu. */}
            {user && (
              <div className="hidden items-center md:flex">
                <HelpButton />
              </div>
            )}
            {summary && (
              <div className="flex items-center max-md:order-1">
                <DaySummary {...summary} />
              </div>
            )}
            <div className="flex items-center max-md:order-3">
              <UserMenu
                user={user}
                theme={theme}
                onThemeChange={onThemeChange}
                onSignOut={signOut}
              />
            </div>
          </div>
        </FloatingBar>
      </header>
      {/* The fixed island takes no room: this keeps the page below it. */}
      <div aria-hidden="true" data-app-bar-spacer="" className="hidden h-[4.5rem] md:block" />
      {user?.isAnonymous && <GuestBanner />}
    </>
  )
}
