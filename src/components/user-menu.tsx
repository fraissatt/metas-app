'use client'

import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { Check, Moon, Palette, Sun } from 'lucide-react'
import { useBackground } from '@/components/background-provider'
import { LeaveGuestDialog } from '@/components/leave-guest-dialog'
import { useTheme } from '@/components/use-theme'
import { BACKGROUND_LABELS, BACKGROUND_STYLES, type BackgroundStyle } from '@/lib/background-options'
import { initialsOf } from '@/lib/initials'
import { runRedirectingAction } from '@/lib/run-redirecting-action'
import type { Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const triggerClass =
  'flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const itemClass =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm cursor-default outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground'
const labelClass = 'px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground'
const separator = <div role="separator" className="my-1 h-px bg-border" />

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
]

export type MenuUser = { name: string; email: string; isAnonymous: boolean }

/**
 * Account, appearance and sign-out in one glass popover. Without a session
 * (sign-in and sign-up pages) it is just the appearance menu.
 */
export function UserMenu({
  user,
  theme: initialTheme,
  onThemeChange,
  onSignOut,
  onCreateAccount,
}: {
  user: MenuUser | null
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
  onSignOut: () => Promise<void>
  onCreateAccount: () => Promise<void>
}) {
  const { theme, setTheme } = useTheme(initialTheme, onThemeChange)
  const { style, setStyle } = useBackground()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [signUpOpen, setSignUpOpen] = useState(false)
  const label = user ? (user.isAnonymous ? 'Visitante' : user.name) : null

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label={label ? `Conta: ${label}` : 'Aparência'}
          className={cn(
            triggerClass,
            label && 'bg-foreground text-xs font-semibold text-background hover:text-background',
          )}
        >
          {label ? initialsOf(label) : <Palette className="size-5" />}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={6} className="z-50">
            <Menu.Popup className="glass-popup w-64 origin-top rounded-xl border border-border p-1.5 text-popover-foreground outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
              {user && (
                <div className="px-2.5 pt-1.5 pb-2">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.isAnonymous ? 'Os dados somem após 24 h sem uso.' : user.email}
                  </p>
                </div>
              )}
              {user?.isAnonymous && (
                <Menu.Item className={itemClass} onClick={() => setSignUpOpen(true)}>
                  Criar conta
                </Menu.Item>
              )}
              {user && separator}
              <Menu.Group>
                <Menu.GroupLabel className={labelClass}>Tema</Menu.GroupLabel>
                <Menu.RadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                  {THEMES.map(({ value, label: text, Icon }) => (
                    <Menu.RadioItem key={value} value={value} className={itemClass}>
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="flex-1">{text}</span>
                      <Menu.RadioItemIndicator>
                        <Check className="size-4" />
                      </Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
              {separator}
              <Menu.Group>
                <Menu.GroupLabel className={labelClass}>Fundo</Menu.GroupLabel>
                <Menu.RadioGroup value={style} onValueChange={(value) => setStyle(value as BackgroundStyle)}>
                  {BACKGROUND_STYLES.map((option) => (
                    <Menu.RadioItem key={option} value={option} className={itemClass}>
                      <span className="flex-1">{BACKGROUND_LABELS[option]}</span>
                      <Menu.RadioItemIndicator>
                        <Check className="size-4" />
                      </Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
              {user && (
                <>
                  {separator}
                  <Menu.Item
                    className={cn(itemClass, 'text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive')}
                    onClick={() => (user.isAnonymous ? setLeaveOpen(true) : void runRedirectingAction(onSignOut))}
                  >
                    Sair
                  </Menu.Item>
                </>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {user?.isAnonymous && (
        <>
          <LeaveGuestDialog open={leaveOpen} onOpenChange={setLeaveOpen} action={onSignOut} confirmLabel="Sair" />
          <LeaveGuestDialog
            open={signUpOpen}
            onOpenChange={setSignUpOpen}
            action={onCreateAccount}
            confirmLabel="Continuar"
            toSignUp
          />
        </>
      )}
    </>
  )
}
