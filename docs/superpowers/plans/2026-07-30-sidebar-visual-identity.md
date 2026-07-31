# Sidebar + Visual Identity (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal top navbar with a hover-collapsible left sidebar (icon-only bottom bar on mobile) and replace the light shadcn theme with a single dark gray + neon green visual identity applied globally.

**Architecture:** All existing shadcn components (Button, Card, Progress, Dialog, etc.) already read colors from CSS custom properties in `globals.css`, so the theme change is a CSS-variable-only edit — no component files need touching for color, except the one component (`objective-progress-chart.tsx`) that hardcodes a color instead of using the theme. The nav change replaces `nav-bar.tsx` with a new client component `sidebar.tsx` that reads `usePathname()` to highlight the active route; it renders as a fixed hover-expanding icon rail on desktop and a fixed icon-only bottom bar on mobile, purely through responsive Tailwind classes (no JS media-query logic). The root layout adds a fixed content offset (`padding-left` desktop / `padding-bottom` mobile) so no individual page needs to change.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind CSS v4 (CSS-first config, no `tailwind.config.*` file — theme lives entirely in `globals.css`), shadcn components built on `@base-ui/react`, `lucide-react` icons, Vitest + React Testing Library.

## Global Constraints

- This Next.js version has breaking changes vs. training data (per `AGENTS.md`) — `usePathname` from `next/navigation` was verified unchanged against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md` (still a Client Component hook, no new required args).
- Single dark theme only — no light/dark toggle. Implemented by setting `:root` and `.dark` to identical values and always applying `class="dark"` to `<html>`, which keeps the three shadcn primitives that use `dark:`-prefixed Tailwind variants (`button.tsx`, `input.tsx`, `checkbox.tsx`) working exactly as already calibrated, instead of silently disabling those variants.
- Desktop/mobile breakpoint: Tailwind's default `md` (768px).
- Sidebar collapsed width: 56px (`w-14`/`pl-14`/`pb-14`). Expanded width: ~208px (`w-52`).
- Sidebar expands as an overlay (`position: fixed`) on hover — it must never push/reflow page content.
- Nav icons: `Sun` (Hoje), `CalendarDays` (Semana), `Target` (Objetivos), from `lucide-react`.
- No page-level files (`page.tsx` under `src/app/**`) should need edits — the content offset is handled once in `src/app/layout.tsx`.

---

### Task 1: Dark gray + neon green theme

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--input`, `--ring`, `--chart-1`..`--chart-5`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`) consumed by every shadcn component and by Task 4's `sidebar.tsx`.

This task has no automated test — it's a CSS value change with no logic to assert. Verification is manual (Task 5).

- [ ] **Step 1: Replace the `:root` and `.dark` blocks**

In `src/app/globals.css`, replace both the `:root { ... }` block (lines 51-84) and the `.dark { ... }` block (lines 86-118) with this single set of values, duplicated identically in both selectors (so the theme is correct whether or not the `dark` class is present — Task 4 always applies it, but this keeps the file defensively correct):

```css
:root {
  --background: #121214;
  --foreground: #e4e4e7;
  --card: #1a1a1d;
  --card-foreground: #e4e4e7;
  --popover: #1a1a1d;
  --popover-foreground: #e4e4e7;
  --primary: #39ff14;
  --primary-foreground: #0a0a0a;
  --secondary: #232326;
  --secondary-foreground: #e4e4e7;
  --muted: #1c1c1f;
  --muted-foreground: #a1a1aa;
  --accent: #1c2b18;
  --accent-foreground: #39ff14;
  --destructive: oklch(0.704 0.191 22.216);
  --border: #26262a;
  --input: #26262a;
  --ring: #39ff14;
  --chart-1: #3f3f46;
  --chart-2: #52713f;
  --chart-3: #4f8f2a;
  --chart-4: #2fbf1a;
  --chart-5: #39ff14;
  --radius: 0.625rem;
  --sidebar: #0f0f11;
  --sidebar-foreground: #e4e4e7;
  --sidebar-primary: #39ff14;
  --sidebar-primary-foreground: #0a0a0a;
  --sidebar-accent: #1c2b18;
  --sidebar-accent-foreground: #39ff14;
  --sidebar-border: #232326;
  --sidebar-ring: #39ff14;
}

.dark {
  --background: #121214;
  --foreground: #e4e4e7;
  --card: #1a1a1d;
  --card-foreground: #e4e4e7;
  --popover: #1a1a1d;
  --popover-foreground: #e4e4e7;
  --primary: #39ff14;
  --primary-foreground: #0a0a0a;
  --secondary: #232326;
  --secondary-foreground: #e4e4e7;
  --muted: #1c1c1f;
  --muted-foreground: #a1a1aa;
  --accent: #1c2b18;
  --accent-foreground: #39ff14;
  --destructive: oklch(0.704 0.191 22.216);
  --border: #26262a;
  --input: #26262a;
  --ring: #39ff14;
  --chart-1: #3f3f46;
  --chart-2: #52713f;
  --chart-3: #4f8f2a;
  --chart-4: #2fbf1a;
  --chart-5: #39ff14;
  --sidebar: #0f0f11;
  --sidebar-foreground: #e4e4e7;
  --sidebar-primary: #39ff14;
  --sidebar-primary-foreground: #0a0a0a;
  --sidebar-accent: #1c2b18;
  --sidebar-accent-foreground: #39ff14;
  --sidebar-border: #232326;
  --sidebar-ring: #39ff14;
}
```

Leave everything else in the file (`@import` lines, `@custom-variant dark`, the `@theme inline { ... }` block, `@layer base { ... }`) unchanged.

- [ ] **Step 2: Add a neon glow to primary buttons**

In the same file, inside `@layer base { ... }`, add a rule so any element using the `bg-primary` utility (i.e. default-variant buttons) gets a subtle glow consistent with the approved mockup:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
  .bg-primary {
    box-shadow: 0 0 12px color-mix(in oklch, var(--primary) 40%, transparent);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: replace shadcn light theme with dark gray + neon green identity"
```

---

### Task 2: Theme-aware progress chart colors

**Files:**
- Modify: `src/components/objective-progress-chart.tsx`

**Interfaces:**
- Consumes: CSS custom properties from Task 1 (`--primary`, `--border`, `--muted-foreground`, `--popover`, `--popover-foreground`).

No automated test — this is a color-only change to a Recharts SVG chart; correctness is a visual check, done in Task 5.

- [ ] **Step 1: Replace the hardcoded bar color and add theme-aware axis/grid/tooltip colors**

Replace the full contents of `src/components/objective-progress-chart.tsx`:

```tsx
'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function ObjectiveProgressChart({ data }: { data: Array<{ weekLabel: string; percent: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem metas semanais ainda para gerar o gráfico.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="weekLabel" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)' }} />
        <YAxis
          domain={[0, 100]}
          unit="%"
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)' }}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, 'Concluído']}
          contentStyle={{
            background: 'var(--popover)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--popover-foreground)',
          }}
        />
        <Bar dataKey="percent" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/objective-progress-chart.tsx
git commit -m "fix: make progress chart colors theme-aware instead of hardcoded blue"
```

---

### Task 3: Sidebar component

**Files:**
- Create: `src/components/sidebar.tsx`
- Test: `src/components/sidebar.test.tsx`
- Delete: `src/components/nav-bar.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (existing, signature `cn(...inputs: ClassValue[]): string`); `usePathname` from `next/navigation`; icons `Sun`, `CalendarDays`, `Target` from `lucide-react`; `Link` from `next/link`.
- Produces: `export function Sidebar(): JSX.Element` — a client component with no props, rendered once in `src/app/layout.tsx` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `src/components/sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('Sidebar', () => {
  it('renders links to Hoje, Semana and Objetivos', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /hoje/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /semana/i })).toHaveAttribute('href', '/week')
    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('href', '/objectives')
  })

  it('marks the link matching the current route as active', () => {
    vi.mocked(usePathname).mockReturnValue('/week')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /semana/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /hoje/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })

  it('marks Objetivos as active for nested objective routes', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives/123/weeks/456')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Objetivos active on the home route', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sidebar.test.tsx`
Expected: FAIL — `Cannot find module '@/components/sidebar'` (the file doesn't exist yet).

- [ ] **Step 3: Write the Sidebar component**

Create `src/components/sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Sun, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Hoje', icon: Sun },
  { href: '/week', label: 'Semana', icon: CalendarDays },
  { href: '/objectives', label: 'Objetivos', icon: Target },
]

function isLinkActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      className="group fixed inset-x-0 bottom-0 z-50 flex h-14 items-center justify-around border-t border-sidebar-border bg-sidebar md:inset-x-auto md:inset-y-0 md:left-0 md:h-screen md:w-14 md:flex-col md:items-stretch md:justify-start md:gap-1 md:border-t-0 md:border-r md:p-3 md:transition-[width] md:duration-200 md:ease-in-out md:hover:w-52"
    >
      <span className="hidden overflow-hidden text-sm font-bold whitespace-nowrap text-sidebar-primary opacity-0 transition-opacity md:mb-2 md:block md:px-2 md:group-hover:opacity-100">
        Metas
      </span>
      {links.map(({ href, label, icon: Icon }) => {
        const active = isLinkActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground md:w-full',
              active && 'bg-sidebar-accent text-sidebar-accent-foreground hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="hidden overflow-hidden whitespace-nowrap opacity-0 transition-opacity md:inline md:group-hover:opacity-100">
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sidebar.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Delete the old nav bar**

```bash
git rm src/components/nav-bar.tsx
```

(It has no test file, so nothing else references it after Task 4 rewires `layout.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/components/sidebar.test.tsx
git commit -m "feat: add hover-collapsible sidebar with active-route highlighting"
```

---

### Task 4: Wire the sidebar into the root layout

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `Sidebar` from `@/components/sidebar` (Task 3).

No new automated test — `layout.tsx` is exercised indirectly by every existing page test that renders through the App Router in dev/build, and there's no existing precedent in this codebase for testing root layout in isolation. Verified manually in Task 5.

- [ ] **Step 1: Replace `NavBar` with `Sidebar` and add the content offset**

Replace the full contents of `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
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
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Sidebar />
        <div className="pb-14 md:pb-0 md:pl-14">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: render sidebar in root layout with responsive content offset"
```

---

### Task 5: Full test suite + manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All tests pass, including the 4 new `sidebar.test.tsx` tests and every pre-existing test (no regressions from the theme/layout changes, since none of them assert on color or the old `nav-bar.tsx`).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Manually verify in a browser**

Open `http://localhost:3000` and check, per this project's convention of verifying UI changes in a real browser before calling them done:

- Background is dark gray (`#121214`), text is legible, cards/buttons use the new palette, primary buttons are neon green with a visible glow.
- At a desktop width (≥768px): a 56px icon rail sits fixed on the left; hovering it smoothly expands to show labels + the "Metas" wordmark, overlaying content without shifting the page.
- The nav item matching the current route (Hoje `/`, Semana `/week`, Objetivos `/objectives` and nested `/objectives/*` routes) is highlighted with the dark-green active background and neon-green text/icon.
- Resize below 768px (or use device toolbar): the sidebar becomes a fixed icon-only bottom bar; page content has bottom padding so nothing is hidden behind it.
- Visit `/objectives` and open an objective with weekly goals to confirm `ObjectiveProgressChart` renders its grid, axes, tooltip, and bars legibly against the dark background (no invisible black-on-dark text, no jarring white tooltip box).

- [ ] **Step 4: Stop the dev server**

Fix anything found during manual verification before considering this plan complete; do not commit further unless a fix was needed.
