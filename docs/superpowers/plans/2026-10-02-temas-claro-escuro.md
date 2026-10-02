# Light and Dark Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light theme (gray + neon blue + coral) next to a deeper dark theme (layered grays + neon green + violet), switchable from a toggle and remembered in a cookie.

**Architecture:** Both palettes live as CSS custom properties in `globals.css` (`:root` = light, `.dark` = dark). The root layout reads a `theme` cookie on the server and sets the `dark` class on `<html>`, so the first paint is already right. A client `ThemeToggle` flips the class immediately and persists the choice through a Server Action passed down as a prop, which is the same pattern the app already uses for `onToggleTask` and friends.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before touching Next APIs, as AGENTS.md requires), React 19, Tailwind CSS 4, Base UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-temas-claro-escuro-design.md`

## Global Constraints

- Work on branch `feature/temas` (cut from `develop`). Merge back into `develop` with `--no-ff`. Never commit to `develop` or `master` directly.
- Every commit message is detailed: what changed, which files/areas are impacted, the behavior change, and the test status. On Windows git, write long messages to a file and use `git commit -F <file>`, because `-F -` fails.
- No new dependencies.
- Cookie name `theme`, values `dark` | `light`. Missing or invalid means `dark`. Options: `path: '/'`, `sameSite: 'lax'`, `maxAge: 60 * 60 * 24 * 365`, not `httpOnly`.
- The OS color-scheme preference is never consulted.
- Glow appears in exactly three places: the page-top gradient, fulfilled goal cards / fully done groups on Hoje, and completed progress (the `ProgressIndicator` at 100% and the fulfilled ring).
- All text pairings listed in the spec's Testing section must be ≥ 4.5:1.
- UI copy is Brazilian Portuguese.
- Run the whole suite with `npm test`. It needs the Docker Postgres from `docker compose up -d`; test files run sequentially by config.

## Review Focus

1. **Garbage cookie** (`theme=blue`, empty, or uppercase `LIGHT`): the app must render dark, never crash and never emit `class="undefined"`. This is pinned in Task 1 (`parseTheme`) and Task 4 (the layout uses `parseTheme`).
2. **Server Action rejects** (offline, server restarted): the page must snap back to the previous theme rather than show a theme that won't survive a reload. This is pinned in Task 3.
3. **Double click on the toggle while the first save is in flight**: each click must flip from the theme currently shown, not from the stale prop, so two clicks land back where they started. This is pinned in Task 3.
4. **Legibility in the light theme of things that hardcode dark assumptions** (`dark:` utilities, chart axis colors, the `#39ff14` literal anywhere): nothing may stay neon green in light mode. This is pinned in Task 2 with a test that greps `src/` for hex literals outside `globals.css`.
5. **The mobile bottom bar with a third item** at 375px: the three items must fit without wrapping or horizontal scroll. This is covered by a manual check in Task 6, because jsdom has no layout.

---

### Task 1: Theme value parsing and persistence action

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`
- Create: `src/lib/actions/theme.ts`
- Create: `src/lib/actions/theme.test.ts`

**Interfaces:**
- Produces:
  - `type Theme = 'dark' | 'light'`
  - `const DEFAULT_THEME: Theme` (= `'dark'`)
  - `const THEME_COOKIE = 'theme'`
  - `function parseTheme(value: string | undefined): Theme`
  - `function getTheme(): Promise<Theme>` (server only, reads `cookies()`)
  - `async function setTheme(theme: Theme): Promise<void>` (Server Action in `src/lib/actions/theme.ts`)

- [ ] **Step 1: Read the cookies docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`. Key facts: `cookies()` is async; `.set` only works in a Server Function or Route Handler; reading it in a layout makes the route dynamic.

- [ ] **Step 2: Write the failing tests for `parseTheme`**

`src/lib/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, parseTheme } from '@/lib/theme'

describe('parseTheme', () => {
  it('defaults to dark when the cookie is missing', () => {
    expect(parseTheme(undefined)).toBe('dark')
    expect(DEFAULT_THEME).toBe('dark')
  })

  it('accepts the two known values', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
  })

  it('falls back to dark for anything else, including near misses', () => {
    expect(parseTheme('')).toBe('dark')
    expect(parseTheme('blue')).toBe('dark')
    expect(parseTheme('LIGHT')).toBe('dark')
    expect(parseTheme(' light')).toBe('dark')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL, cannot resolve `@/lib/theme`.

- [ ] **Step 4: Implement `src/lib/theme.ts`**

```ts
import { cookies } from 'next/headers'

export type Theme = 'dark' | 'light'

export const DEFAULT_THEME: Theme = 'dark'
export const THEME_COOKIE = 'theme'

// Exact match on purpose: the cookie is only ever written by `setTheme`, so
// anything else is tampering or a stale format and gets the default.
export function parseTheme(value: string | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : DEFAULT_THEME
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies()
  return parseTheme(store.get(THEME_COOKIE)?.value)
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Write the failing test for `setTheme`**

`src/lib/actions/theme.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set })),
}))

import { setTheme } from '@/lib/actions/theme'

describe('setTheme', () => {
  beforeEach(() => set.mockClear())

  it('stores the chosen theme in a year-long, script-readable cookie', async () => {
    await setTheme('light')

    expect(set).toHaveBeenCalledWith('theme', 'light', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  })

  it('normalises an invalid value to the default instead of storing it', async () => {
    // Server Actions are public endpoints: the type is not a guarantee.
    await setTheme('neon' as never)

    expect(set).toHaveBeenCalledWith('theme', 'dark', expect.any(Object))
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/lib/actions/theme.test.ts`
Expected: FAIL, cannot resolve `@/lib/actions/theme`.

- [ ] **Step 8: Implement `src/lib/actions/theme.ts`**

```ts
'use server'

import { cookies } from 'next/headers'
import { parseTheme, THEME_COOKIE, type Theme } from '@/lib/theme'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// No revalidatePath: the toggle has already repainted the page, and the next
// request reads the cookie anyway.
export async function setTheme(theme: Theme): Promise<void> {
  const store = await cookies()
  store.set(THEME_COOKIE, parseTheme(theme), {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
```

- [ ] **Step 9: Run both test files**

Run: `npx vitest run src/lib/theme.test.ts src/lib/actions/theme.test.ts`
Expected: 5 passed.

- [ ] **Step 10: Commit**

Message file content:

```
feat: add theme cookie parsing and setTheme action

Adds the storage layer for the light/dark themes (spec:
docs/superpowers/specs/2026-10-02-temas-claro-escuro-design.md).
Nothing reads it yet; no visible change.

- src/lib/theme.ts: Theme type, DEFAULT_THEME ('dark'), THEME_COOKIE,
  parseTheme (exact match, anything else -> dark) and getTheme (reads
  the cookie on the server).
- src/lib/actions/theme.ts: setTheme Server Action, writes a one-year,
  path=/, sameSite=lax, non-httpOnly cookie; re-validates the value.

Tests: theme.test.ts and actions/theme.test.ts (5 new, passing).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

```bash
git add src/lib/theme.ts src/lib/theme.test.ts src/lib/actions/theme.ts src/lib/actions/theme.test.ts
git commit -F <message-file>
```

---

### Task 2: Palettes and tokens

**Files:**
- Modify: `src/app/globals.css` (the `@theme inline` block, `:root`, `.dark`, `@layer base`)
- Create: `src/lib/theme-contrast.test.ts`

**Interfaces:**
- Produces Tailwind utilities used by Task 5: `bg-support`, `text-support`, `text-support-foreground`, `bg-support-muted`, and the CSS variables `--support`, `--support-foreground`, `--support-muted`, `--glow`.

- [ ] **Step 1: Write the failing contrast and hardcoded-color tests**

`src/lib/theme-contrast.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

function palette(selector: ':root' | '.dark'): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  const vars: Record<string, string> = {}
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    vars[name] = value
  }
  return vars
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS: Array<[string, string]> = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['support-foreground', 'background'],
  ['support-foreground', 'card'],
  ['primary-foreground', 'primary'],
]

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
] as const)('%s palette', (_name, selector) => {
  const vars = palette(selector)

  it.each(PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(vars[fg], `--${fg} missing`).toBeDefined()
    expect(vars[bg], `--${bg} missing`).toBeDefined()
    expect(contrast(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('theme colors stay in tokens', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? files(path) : [path]
    })
  }

  it('no component hardcodes a hex color (it would ignore the active theme)', () => {
    const offenders = files(join(process.cwd(), 'src'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /#[0-9a-fA-F]{6}\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(process.cwd(), ''))

    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/theme-contrast.test.ts`
Expected: FAIL. `--support-foreground` is missing in both palettes, and `src/app/layout.tsx` is an offender (`themeColor: "#121214"`). The layout offender is fixed in Task 4; leave it failing until then, but every palette assertion must pass at the end of this task.

- [ ] **Step 3: Register the new tokens in `@theme inline`**

In `src/app/globals.css`, inside `@theme inline { ... }`, add next to `--color-accent`:

```css
  --color-support: var(--support);
  --color-support-foreground: var(--support-foreground);
  --color-support-muted: var(--support-muted);
```

- [ ] **Step 4: Replace the `:root` block with the light palette**

```css
:root {
  color-scheme: light;
  --background: #eceef2;
  --foreground: #14171f;
  --card: #ffffff;
  --card-foreground: #14171f;
  --popover: #ffffff;
  --popover-foreground: #14171f;
  --primary: #1f6bff;
  --primary-foreground: #ffffff;
  --secondary: #e2e5eb;
  --secondary-foreground: #14171f;
  --muted: #e2e5eb;
  --muted-foreground: #5b6170;
  --accent: #dce7ff;
  --accent-foreground: #1450cc;
  --support: #f05a3c;
  --support-foreground: #b4380a;
  --support-muted: #f05a3c1f;
  --glow: #1f6bff33;
  --destructive: #dc2626;
  --border: #d7dbe3;
  --input: #d7dbe3;
  --ring: #1f6bff;
  --chart-1: #cfd4dd;
  --chart-2: #9db8f5;
  --chart-3: #6b97f7;
  --chart-4: #3f7bfa;
  --chart-5: #1f6bff;
  --radius: 0.625rem;
  --sidebar: #ffffff;
  --sidebar-foreground: #14171f;
  --sidebar-primary: #1f6bff;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #dce7ff;
  --sidebar-accent-foreground: #1450cc;
  --sidebar-border: #d7dbe3;
  --sidebar-ring: #1f6bff;
}
```

- [ ] **Step 5: Replace the `.dark` block with the deeper dark palette**

```css
.dark {
  color-scheme: dark;
  --background: #0d0f13;
  --foreground: #e6e8ee;
  --card: #161a21;
  --card-foreground: #e6e8ee;
  --popover: #161a21;
  --popover-foreground: #e6e8ee;
  --primary: #39ff14;
  --primary-foreground: #0a0a0a;
  --secondary: #1f242e;
  --secondary-foreground: #e6e8ee;
  --muted: #1f242e;
  --muted-foreground: #9aa1ae;
  --accent: #14261a;
  --accent-foreground: #39ff14;
  --support: #a78bfa;
  --support-foreground: #c4b5fd;
  --support-muted: #a78bfa26;
  --glow: #39ff1440;
  --destructive: oklch(0.704 0.191 22.216);
  --border: #262b36;
  --input: #262b36;
  --ring: #39ff14;
  --chart-1: #2a303c;
  --chart-2: #52713f;
  --chart-3: #4f8f2a;
  --chart-4: #2fbf1a;
  --chart-5: #39ff14;
  --sidebar: #0a0c10;
  --sidebar-foreground: #e6e8ee;
  --sidebar-primary: #39ff14;
  --sidebar-primary-foreground: #0a0a0a;
  --sidebar-accent: #14261a;
  --sidebar-accent-foreground: #39ff14;
  --sidebar-border: #262b36;
  --sidebar-ring: #39ff14;
}
```

- [ ] **Step 6: Add the page-top glow to `body`**

In `@layer base`, replace the `body` rule with:

```css
  body {
    @apply bg-background text-foreground;
    /* The one ambient use of the neon: a soft wash at the top of every page. */
    background-image: radial-gradient(
      130% 45% at 60% 0%,
      color-mix(in oklab, var(--primary) 18%, var(--background)) 0%,
      var(--background) 65%
    );
    background-repeat: no-repeat;
  }
```

- [ ] **Step 7: Run the contrast test**

Run: `npx vitest run src/lib/theme-contrast.test.ts`
Expected: all 16 palette assertions PASS; only "no component hardcodes a hex color" still fails, listing `/src/app/layout.tsx`.

- [ ] **Step 8: Check the app still renders dark**

The layout still hardcodes `dark`, so the running dev server (`npm run dev`, http://localhost:3000) must look like today but with cooler, more separated surfaces and the green wash at the top. No layout should break.

- [ ] **Step 9: Commit**

```
feat: add light palette, deepen dark palette, add support and glow tokens

Theme tokens for the light/dark design (spec 2026-10-02). The app is
still forced dark (layout change comes later), so the visible change
is the reworked dark theme.

- src/app/globals.css: :root is now the light palette (#eceef2 base,
  #1f6bff neon blue, coral support); .dark is a cooler, layered dark
  palette (#0a0c10 sidebar / #0d0f13 page / #161a21 cards / #1f242e
  raised). New tokens --support, --support-foreground, --support-muted,
  --glow registered as Tailwind colors. Body gets a radial neon wash.
- src/lib/theme-contrast.test.ts: asserts WCAG AA for 8 text pairings
  in both palettes, and that no component hardcodes a hex color.

Tests: palette assertions pass; the hardcoded-color check still flags
layout.tsx themeColor until the layout task.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

```bash
git add src/app/globals.css src/lib/theme-contrast.test.ts
git commit -F <message-file>
```

---

### Task 3: ThemeToggle component

**Files:**
- Create: `src/components/theme-toggle.tsx`
- Create: `src/components/theme-toggle.test.tsx`

**Interfaces:**
- Consumes: `type Theme` from `@/lib/theme` (Task 1). Import the type only; do not import `getTheme`, which pulls `next/headers` into a client bundle.
- Produces: `function ThemeToggle(props: { theme: Theme; onChange: (theme: Theme) => Promise<void>; className?: string; labelClassName?: string }): JSX.Element`, plus the exported helper `applyTheme(theme: Theme): void`.

- [ ] **Step 1: Write the failing tests**

`src/components/theme-toggle.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle, applyTheme } from '@/components/theme-toggle'

const root = document.documentElement

afterEach(() => applyTheme('dark'))

describe('ThemeToggle', () => {
  it('offers the light theme while dark is active', () => {
    applyTheme('dark')
    render(<ThemeToggle theme="dark" onChange={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Ativar tema claro' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers the dark theme while light is active', () => {
    applyTheme('light')
    render(<ThemeToggle theme="light" onChange={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Ativar tema escuro' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('repaints immediately and then persists the new theme', async () => {
    applyTheme('dark')
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    expect(root).not.toHaveClass('dark')
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
    expect(onChange).toHaveBeenCalledWith('light')
    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()
  })

  it('reverts the repaint if saving fails', async () => {
    applyTheme('dark')
    const onChange = vi.fn().mockRejectedValue(new Error('offline'))
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    await waitFor(() => expect(root).toHaveClass('dark'))
    expect(root.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })

  it('flips from what is shown, so two quick clicks return to the start', async () => {
    applyTheme('dark')
    // Never resolves: both clicks happen while the first save is in flight.
    const onChange = vi.fn(() => new Promise<void>(() => {}))
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    await userEvent.click(button)
    await userEvent.click(button)

    expect(root).toHaveClass('dark')
    expect(onChange).toHaveBeenNthCalledWith(1, 'light')
    expect(onChange).toHaveBeenNthCalledWith(2, 'dark')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/theme-toggle.test.tsx`
Expected: FAIL, cannot resolve `@/components/theme-toggle`.

- [ ] **Step 3: Implement `src/components/theme-toggle.tsx`**

The button stays enabled during a save on purpose: the change is already on screen, so there is nothing to wait for. That is also why the double-click case must flip from local state rather than from the `theme` prop.

```tsx
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/theme-toggle.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```
feat: add ThemeToggle component

Client button that switches between the light and dark themes (spec
2026-10-02). Not mounted anywhere yet; no visible change.

- src/components/theme-toggle.tsx: applyTheme() sets the `dark`
  class, data-theme and color-scheme on <html>; ThemeToggle repaints
  immediately, then persists through the onChange prop (a Server
  Action in production) and reverts if that rejects. Flips from local
  state so rapid clicks stay consistent. Labels "Ativar tema claro" /
  "Ativar tema escuro", aria-pressed reflects light mode.

Tests: theme-toggle.test.tsx (5 new, passing).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

```bash
git add src/components/theme-toggle.tsx src/components/theme-toggle.test.tsx
git commit -F <message-file>
```

---

### Task 4: Wire the theme into the layout and sidebar

**Files:**
- Modify: `src/app/layout.tsx` (whole file shown below)
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/sidebar.test.tsx`

**Interfaces:**
- Consumes: `getTheme`, `Theme` (Task 1), `setTheme` (Task 1), `ThemeToggle` (Task 3).
- Produces: `Sidebar(props: { theme: Theme; onThemeChange: (theme: Theme) => Promise<void> })`.

- [ ] **Step 1: Read the viewport docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`. `generateViewport` may be async and may call request-time APIs such as `cookies()`.

- [ ] **Step 2: Update the sidebar tests first**

In `src/components/sidebar.test.tsx`:
- add `const onThemeChange = vi.fn().mockResolvedValue(undefined)` at the top of the `describe`;
- replace every `render(<Sidebar />)` with `render(<Sidebar theme="dark" onThemeChange={onThemeChange} />)`;
- keep the `getAllByRole('link')).toHaveLength(2)` assertion. The toggle is a button, so the link count must not change;
- add this test:

```tsx
  it('includes the theme toggle alongside the navigation links', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar theme="light" onThemeChange={onThemeChange} />)

    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run the sidebar tests to verify they fail**

Run: `npx vitest run src/components/sidebar.test.tsx`
Expected: the new test FAILS (no toggle button). TypeScript props are not checked by Vitest, so the others still pass.

- [ ] **Step 4: Mount the toggle in `src/components/sidebar.tsx`**

Change the signature and add the toggle after the `links.map(...)` block, still inside `<nav>`:

```tsx
import { ThemeToggle } from '@/components/theme-toggle'
import type { Theme } from '@/lib/theme'

export function Sidebar({
  theme,
  onThemeChange,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
}) {
```

```tsx
      {/* Temporary home until the header exists. On desktop it sinks to the
          bottom of the rail; on mobile it is the bottom bar's third item. */}
      <ThemeToggle
        theme={theme}
        onChange={onThemeChange}
        className="md:mt-auto md:w-full md:justify-center md:group-hover:justify-start md:group-focus-within:justify-start"
        labelClassName="hidden overflow-hidden whitespace-nowrap opacity-0 transition-opacity md:inline md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      />
```

- [ ] **Step 5: Run the sidebar tests to verify they pass**

Run: `npx vitest run src/components/sidebar.test.tsx`
Expected: 7 passed.

- [ ] **Step 6: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { setTheme } from "@/lib/actions/theme";
import { getTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Metas",
    default: "Metas",
  },
  description: "Objetivos, metas semanais e tarefas do dia.",
};

// Mirrors `--background` for each theme in globals.css. A CSS variable can't
// be used here, because the value ends up in a <meta> tag.
const BROWSER_CHROME = { dark: "rgb(13 15 19)", light: "rgb(236 238 242)" } as const;

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  return { themeColor: BROWSER_CHROME[theme], colorScheme: theme };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();

  return (
    <html
      lang="pt-BR"
      data-theme={theme}
      className={`${theme === "dark" ? "dark " : ""}${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>
        <Sidebar theme={theme} onThemeChange={setTheme} />
        <div
          id="conteudo"
          tabIndex={-1}
          className="pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] outline-none md:pb-0 md:pl-14"
        >
          {children}
        </div>
      </body>
    </html>
  );
}
```

`rgb(...)` instead of hex keeps the hardcoded-color test strict without an exception list.

- [ ] **Step 7: Run the contrast and color test**

Run: `npx vitest run src/lib/theme-contrast.test.ts`
Expected: all pass, including "no component hardcodes a hex color".

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"` and `npm run lint`
Expected: no errors outside test files. Four test files already have pre-existing fixture type errors (`completedAt` missing); do not fix them here.

- [ ] **Step 9: Try it in the browser**

With `npm run dev`, open http://localhost:3000:
- the page opens dark;
- the toggle at the bottom of the rail switches to light instantly;
- a reload stays light, with no dark flash;
- in devtools, setting the `theme` cookie to `blue` and reloading renders dark.

- [ ] **Step 10: Commit**

```
feat: switch themes from the sidebar, server-rendered from a cookie

Makes the light/dark themes usable (spec 2026-10-02).

- src/app/layout.tsx: reads the theme cookie (getTheme) and renders
  <html> with or without the `dark` class plus data-theme, so the
  first paint matches the saved choice; generateViewport returns the
  matching theme-color/color-scheme; passes theme + setTheme to the
  sidebar. Layout was already dynamic, so no rendering-mode change.
- src/components/sidebar.tsx: takes theme/onThemeChange and mounts
  ThemeToggle at the bottom of the desktop rail and as the third item
  of the mobile bar.
- src/components/sidebar.test.tsx: new props; asserts the toggle is
  present and the nav still has exactly two links.

Tests: full suite passing; tsc clean outside pre-existing test fixture
errors; lint clean.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

```bash
git add src/app/layout.tsx src/components/sidebar.tsx src/components/sidebar.test.tsx
git commit -F <message-file>
```

---

### Task 5: Apply glow and support color to components

**Files:**
- Modify: `src/components/ui/progress.tsx` (`ProgressIndicator`)
- Modify: `src/components/week-goal-progress-card.tsx`
- Modify: `src/components/today-task-group.tsx`
- Modify: `src/components/weekly-goal-card.tsx`
- Modify: `src/components/missing-goals-card.tsx`
- Modify: `src/components/weekly-goal-day-chart.tsx`
- Test: existing tests for these components plus additions below

**Interfaces:**
- Consumes: the Tailwind colors `support`, `support-foreground`, `support-muted` and the variable `--glow` (Task 2).

- [ ] **Step 1: Write the failing assertions**

Add to `src/components/week-goal-progress-card.test.tsx` (the file already defines `weeklyGoal` and the `task()` helper at the top):

```tsx
  it('flags a fulfilled week so it can glow', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: true }),
    ]
    const { container } = render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(container.firstElementChild).toHaveAttribute('data-fulfilled', 'true')
  })
```

Add to `src/components/today-task-group.test.tsx`:

```tsx
  it('flags a fully done group so it can glow', () => {
    const { container } = render(<TodayTaskGroup group={group([true, true])} onToggleTask={vi.fn()} />)
    expect(container.firstElementChild).toHaveAttribute('data-complete', 'true')
  })
```

In `src/components/weekly-goal-card.test.tsx`, extend the existing test `'marks a goal that repeats every week'` (it renders `goal={{ ...baseGoal, recurring: true }}`) with one more assertion:

```tsx
    expect(screen.getByText('repete toda semana')).toHaveClass('text-support-foreground')
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/week-goal-progress-card.test.tsx src/components/today-task-group.test.tsx src/components/weekly-goal-card.test.tsx`
Expected: the two new tests and the extended assertion FAIL.

- [ ] **Step 3: `ProgressIndicator`, with a gradient fill and glow when complete**

In `src/components/ui/progress.tsx`, replace the indicator class string:

```tsx
      className={cn(
        "h-full bg-linear-to-r from-support to-primary transition-[width] motion-reduce:transition-none data-complete:shadow-[0_0_8px_var(--glow)]",
        className
      )}
```

Base UI sets `data-complete` on the indicator when the value reaches the max.

- [ ] **Step 4: `WeekGoalProgressCard`, with a fulfilled halo and ring glow**

In `src/components/week-goal-progress-card.tsx`:

```tsx
    <div
      data-fulfilled={fulfilled}
      className={cn(
        'flex overflow-hidden rounded-lg border transition-[border-color,box-shadow] motion-reduce:transition-none',
        fulfilled ? 'border-primary/60 bg-card shadow-[0_0_18px_var(--glow)]' : 'border-border bg-card',
      )}
    >
```

On the progress `<circle>` with `data-testid="progress-ring"`, add to its `className`: `${fulfilled ? 'drop-shadow-[0_0_4px_var(--primary)]' : ''}`. The `className` is already a string literal, so convert it to a template literal.

- [ ] **Step 5: `TodayTaskGroup`, with a halo when the day is done**

In `src/components/today-task-group.tsx`, change the outer `<div className="flex overflow-hidden rounded-lg border border-border">` to:

```tsx
    <div
      data-complete={dayComplete}
      className={cn(
        'flex overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] motion-reduce:transition-none',
        dayComplete ? 'border-primary/60 shadow-[0_0_18px_var(--glow)]' : 'border-border',
      )}
    >
```

On the "✓ feito" pill, add `shadow-[0_0_10px_var(--glow)]` to the `dayComplete` branch: `'bg-primary text-primary-foreground shadow-[0_0_10px_var(--glow)]'`.

- [ ] **Step 6: `WeeklyGoalCard`, with the support-colored recurring badge**

In `src/components/weekly-goal-card.tsx`, replace the badge classes `bg-secondary ... text-muted-foreground` with:

```tsx
          <span className="w-fit rounded-full bg-support-muted px-2 py-0.5 text-[11px] font-medium text-support-foreground">
            repete toda semana
          </span>
```

- [ ] **Step 7: `MissingGoalsCard`, with a support accent**

In `src/components/missing-goals-card.tsx`:
- outer wrapper: `className="flex flex-col gap-3 rounded-lg border border-border border-l-[3px] border-l-support bg-card p-4"`;
- eyebrow span: replace `text-muted-foreground` with `text-support-foreground`.

- [ ] **Step 8: `WeeklyGoalDayChart`, with support as the second series**

In `src/components/weekly-goal-day-chart.tsx`, on the `remaining` `<Bar>`, set `fill="var(--support)"` and `fillOpacity={0.35}`. Keep `activeBar={{ fill: 'var(--primary)' }}`.

- [ ] **Step 9: Run the component tests**

Run: `npx vitest run src/components`
Expected: all pass, including the three new ones.

- [ ] **Step 10: Run the full suite, typecheck and lint**

Run: `npm test`, then `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"`, then `npm run lint`
Expected: all tests pass; no new type or lint errors.

- [ ] **Step 11: Commit**

```
feat: apply neon glow and support color across goal and task cards

Gives both themes their identity details (spec 2026-10-02). Colors
come from the tokens, so every change is correct in light and dark.

- ui/progress.tsx: indicator fills support->primary gradient and
  glows when complete (Base UI data-complete).
- week-goal-progress-card.tsx: fulfilled card gets a primary border
  and --glow halo; the ring gets a drop-shadow; data-fulfilled hook.
- today-task-group.tsx: fully done group gets the halo; "✓ feito"
  pill glows; data-complete hook.
- weekly-goal-card.tsx: "repete toda semana" badge uses the support
  color.
- missing-goals-card.tsx: support-colored left accent and eyebrow.
- weekly-goal-day-chart.tsx: "remaining" series uses --support at 35%.

Tests: 3 new component assertions; full suite passing; lint clean.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

```bash
git add src/components
git commit -F <message-file>
```

---

### Task 6: Verify both themes and merge into develop

**Files:** none changed, unless a check fails. A fix goes in its own commit on `feature/temas`.

- [ ] **Step 1: Walk every screen in both themes**

With `npm run dev`, check these in dark and in light: Hoje, Objetivos, an objective detail page (stats bar, chart, weekly goal cards with progress bars), a weekly goal page, the new objective form, the delete dialog and the error page (temporarily throw if needed, then revert).

For each one, check that nothing stays neon green in light mode, all text is readable, and inputs, checkboxes and dialogs follow the theme.

- [ ] **Step 2: Mobile width**

Resize the browser to 375×812. The bottom bar shows Hoje, Objetivos and the theme toggle on one row, with no horizontal scroll.

- [ ] **Step 3: Production build**

Run: `npx next build --experimental-build-mode=compile`
Expected: compiles; every route listed as `ƒ (Dynamic)`.

- [ ] **Step 4: Merge into develop**

Message file content:

```
Merge branch 'feature/temas': light and dark themes

Adds a light theme and a deeper dark theme with a toggle, per
docs/superpowers/specs/2026-10-02-temas-claro-escuro-design.md.

Impacted areas:
- Theme storage: `theme` cookie (dark default), src/lib/theme.ts and
  the setTheme Server Action.
- Styling: globals.css palettes for both themes, new support/glow
  tokens, page-top neon wash.
- Shell: layout renders the saved theme server-side (no flash) and
  sets theme-color per theme; sidebar hosts the toggle (desktop rail
  bottom, mobile bar third item).
- Components: glow on completed goals/groups/progress, support color
  on recurring badges, the "Ficou para trás" card and chart series.

No data model or server-logic changes. Tests passing, lint clean,
build compiles; checked manually in both themes and at 375px.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

```bash
git checkout develop
git merge --no-ff feature/temas -F <message-file>
git branch -d feature/temas
```

Do not push or merge into `master` without the user's go-ahead.
