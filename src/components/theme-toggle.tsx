'use client'

import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import type { Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function ThemeToggle({
  theme: initialTheme,
  onChange,
  className,
  labelClassName,
}: {
  theme: Theme
  onChange: (theme: Theme) => Promise<void>
  className?: string
  /** Lets the sidebar hide the text until it expands, like its nav links. */
  labelClassName?: string
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Ativar tema claro' : 'Ativar tema escuro'
  const Icon = theme === 'dark' ? Sun : Moon

  async function toggle() {
    const previous = theme
    setTheme(next)
    applyTheme(next)
    try {
      await onChange(next)
    } catch {
      setTheme(previous)
      applyTheme(previous)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={theme === 'light'}
      title={label}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className={labelClassName}>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  )
}
