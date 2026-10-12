# Welcome Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a five-step welcome dialog to people with a session on their first visit (not on the quiz), remembered by a cookie and reopenable from the user menu.

**Architecture:** A cookie (`tour=visto`) is read in the layout and passed to a client `TourProvider` that mounts a `TourDialog` and exposes `useTour().openTour()`. The dialog is open when it is automatic (session, not seen, path not `/quiz`) or manual; closing marks it seen and calls a Server Action once. The user menu gets a "Ver tour" item. No database.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs` before Next code, per AGENTS.md), React 19, Tailwind 4, Base UI dialog via `src/components/ui/dialog.tsx`, lucide-react, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-tour-boas-vindas-design.md`

## Global Constraints

- Copy is pt-BR, sentence case, no terminal punctuation on button labels; steps use these exact titles: Objetivos, Metas semanais, Tarefas diárias, Busca, Aparência; buttons "Voltar", "Próximo" (last step "Começar") and "Pular"; indicator "N de 5".
- Cookie `tour`, value `visto`, path `/`, `sameSite: 'lax'`, one year, not httpOnly; any other value counts as not seen.
- Never opens by itself without a session or on `/quiz`; opens after navigating from `/quiz` to another page; closing in any way marks it seen once; "Ver tour" reopens on step 1 without calling the action again.
- No database change. The step colours reuse the `--lp-*` variables and `LandingColor` from the presentation page.
- Every change goes through issue #41 on branch `feature/41-tour-boas-vindas`; commits are detailed, mention `Refs #41` and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A signed-out visitor never sees the tour or the "Ver tour" item: pinned by the provider and menu tests.
- A new user finishing the quiz lands on Hoje and the tour opens there, not before: pinned by the `/quiz` to `/` provider test.
- Closing by Esc or by clicking outside also marks it seen exactly once; reopening and closing again does not call the action again: pinned by provider tests.
- A tampered or empty cookie value counts as not seen: pinned by the `parseTourSeen` test.
- Reduced-motion users get no step fade: pinned by a CSS test, and checked in the browser.
- Focus returns and the dialog is announced with a name and description: checked through roles in the dialog tests and in the browser.

---

### Task 1: Cookie helpers and the Server Action

**Files:**
- Create: `src/lib/tour.ts`
- Create: `src/lib/tour.test.ts`
- Create: `src/lib/actions/tour.ts`
- Create: `src/lib/actions/tour.test.ts`

**Interfaces:**
- Consumes: `next/headers` `cookies()`.
- Produces: `TOUR_COOKIE = 'tour'`, `TOUR_SEEN_VALUE = 'visto'`, `parseTourSeen(value: string | undefined): boolean`, `getTourSeen(): Promise<boolean>`, and the Server Action `setTourSeen(): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`src/lib/tour.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get })) }))

import { getTourSeen, parseTourSeen } from '@/lib/tour'

describe('parseTourSeen', () => {
  it('is true only for the exact value "visto"', () => {
    expect(parseTourSeen('visto')).toBe(true)
    for (const value of [undefined, '', 'Visto', 'true', '1', 'visto ']) {
      expect(parseTourSeen(value)).toBe(false)
    }
  })
})

describe('getTourSeen', () => {
  it('reads the tour cookie', async () => {
    get.mockReturnValueOnce({ value: 'visto' })
    expect(await getTourSeen()).toBe(true)
    expect(get).toHaveBeenLastCalledWith('tour')
  })

  it('is false when the cookie is missing', async () => {
    get.mockReturnValueOnce(undefined)
    expect(await getTourSeen()).toBe(false)
  })
})
```

`src/lib/actions/tour.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ set })) }))

import { setTourSeen } from '@/lib/actions/tour'

describe('setTourSeen', () => {
  beforeEach(() => set.mockClear())

  it('stores the seen marker in a year-long, script-readable cookie', async () => {
    await setTourSeen()

    expect(set).toHaveBeenCalledWith('tour', 'visto', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/tour.test.ts src/lib/actions/tour.test.ts`
Expected: FAIL (modules do not exist).

- [ ] **Step 3: Implement**

`src/lib/tour.ts`:

```ts
import { cookies } from 'next/headers'

export const TOUR_COOKIE = 'tour'
export const TOUR_SEEN_VALUE = 'visto'

// Exact match: the cookie is only written by setTourSeen, so anything else is
// tampering or a stale format and counts as not seen.
export function parseTourSeen(value: string | undefined): boolean {
  return value === TOUR_SEEN_VALUE
}

export async function getTourSeen(): Promise<boolean> {
  const store = await cookies()
  return parseTourSeen(store.get(TOUR_COOKIE)?.value)
}
```

`src/lib/actions/tour.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { TOUR_COOKIE, TOUR_SEEN_VALUE } from '@/lib/tour'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function setTourSeen(): Promise<void> {
  const store = await cookies()
  store.set(TOUR_COOKIE, TOUR_SEEN_VALUE, {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/lib/tour.test.ts src/lib/actions/tour.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tour.ts src/lib/tour.test.ts src/lib/actions/tour.ts src/lib/actions/tour.test.ts
git commit -m "feat: remember the welcome tour in a cookie" -m "Refs #41. tour.ts reads and parses the tour cookie (exact value only) and the setTourSeen Server Action writes it, in the shape of the theme and background cookies. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The steps and the stepped dialog

**Files:**
- Create: `src/components/tour-steps.ts`
- Create: `src/components/tour-dialog.tsx`
- Create: `src/components/tour-dialog.test.tsx`
- Create: `src/app/globals.tour.test.ts`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: `LandingColor` from `src/components/landing-card.tsx`; `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `src/components/ui/dialog.tsx`; `Button` from `src/components/ui/button.tsx`.
- Produces: `TourStep = { id: string; title: string; text: string; icon: LucideIcon; color: LandingColor }`, `TOUR_STEPS: readonly TourStep[]` (five items), and `TourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })`. The dialog starts on step 1 each time it mounts; its parent re-mounts it with a new `key` to restart.

- [ ] **Step 1: Write the failing tests**

`src/components/tour-dialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourDialog } from '@/components/tour-dialog'
import { TOUR_STEPS } from '@/components/tour-steps'

const setup = () => {
  const onOpenChange = vi.fn()
  render(<TourDialog open onOpenChange={onOpenChange} />)
  return onOpenChange
}

describe('TOUR_STEPS', () => {
  it('has the five steps in order', () => {
    expect(TOUR_STEPS.map((step) => step.title)).toEqual([
      'Objetivos',
      'Metas semanais',
      'Tarefas diárias',
      'Busca',
      'Aparência',
    ])
  })
})

describe('TourDialog', () => {
  it('opens on the first step, named and described, without a Voltar button', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Objetivos' })
    expect(dialog).toHaveAccessibleDescription(TOUR_STEPS[0].text)
    expect(screen.getByText('1 de 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
  })

  it('moves forward and back, updating the indicator', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('dialog', { name: 'Metas semanais' })).toBeInTheDocument()
    expect(screen.getByText('2 de 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
    expect(screen.getByText('1 de 5')).toBeInTheDocument()
  })

  it('offers Começar on the last step, which closes the dialog', async () => {
    const onOpenChange = setup()
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    }
    expect(screen.getByRole('dialog', { name: 'Aparência' })).toBeInTheDocument()
    expect(screen.getByText('5 de 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Começar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes with Pular from any step', async () => {
    const onOpenChange = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes on Escape', async () => {
    const onOpenChange = setup()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders nothing while closed', () => {
    render(<TourDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

`src/app/globals.tour.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('tour step styles', () => {
  it('fades the step in, but not for reduced motion', () => {
    expect(css).toMatch(/\.tour-step\s*{[^}]*animation: tour-step-in/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.tour-step\s*{\s*animation: none/)
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/tour-dialog.test.tsx src/app/globals.tour.test.ts`
Expected: FAIL (modules and CSS missing).

- [ ] **Step 3: Implement the steps and the dialog**

`src/components/tour-steps.ts`:

```ts
import { CalendarDays, ListChecks, Palette, Search, Target, type LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'

export type TourStep = { id: string; title: string; text: string; icon: LucideIcon; color: LandingColor }

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'objetivos',
    title: 'Objetivos',
    text: 'Tudo começa com um objetivo: o destino, com prazo e progresso.',
    icon: Target,
    color: 'green',
  },
  {
    id: 'metas',
    title: 'Metas semanais',
    text: 'Cada objetivo se divide em metas por semana. As metas podem se repetir toda semana.',
    icon: CalendarDays,
    color: 'blue',
  },
  {
    id: 'tarefas',
    title: 'Tarefas diárias',
    text: 'As tarefas de cada meta aparecem no Hoje, no dia em que você vai fazê-las.',
    icon: ListChecks,
    color: 'amber',
  },
  {
    id: 'busca',
    title: 'Busca',
    text: 'Aperte Ctrl K para achar objetivos e metas de qualquer semana.',
    icon: Search,
    color: 'violet',
  },
  {
    id: 'aparencia',
    title: 'Aparência',
    text: 'No menu da sua conta você troca o tema e o fundo, e pode rever este tour.',
    icon: Palette,
    color: 'cyan',
  },
]
```

`src/components/tour-dialog.tsx`:

```tsx
'use client'

import { useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TOUR_STEPS } from '@/components/tour-steps'

export function TourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [index, setIndex] = useState(0)
  const step = TOUR_STEPS[index]
  const Icon = step.icon
  const isLast = index === TOUR_STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <div key={step.id} className="tour-step flex flex-col gap-3" style={{ '--card-color': `var(--lp-${step.color})` } as CSSProperties}>
          <span
            className="flex size-10 items-center justify-center rounded-lg"
            style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 16%, transparent)' }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <DialogHeader>
            <DialogTitle>{step.title}</DialogTitle>
            <DialogDescription>{step.text}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex gap-1">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`size-1.5 rounded-full ${i === index ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
              />
            ))}
          </span>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {index + 1} de {TOUR_STEPS.length}
          </p>
        </div>
        <DialogFooter className="items-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Pular
          </Button>
          {index > 0 && (
            <Button variant="outline" onClick={() => setIndex(index - 1)}>
              Voltar
            </Button>
          )}
          <Button onClick={() => (isLast ? onOpenChange(false) : setIndex(index + 1))}>
            {isLast ? 'Começar' : 'Próximo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Append to `src/app/globals.css`:

```css

/* Welcome tour: each step fades in; reduced motion skips it. */
@keyframes tour-step-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.tour-step {
  animation: tour-step-in 200ms ease backwards;
}

@media (prefers-reduced-motion: reduce) {
  .tour-step {
    animation: none;
  }
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/components/tour-dialog.test.tsx src/app/globals.tour.test.ts`
Expected: PASS. If `toHaveAccessibleDescription` fails because the description is not wired, check that `DialogDescription` is rendered inside `DialogContent` and fix the markup, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour-steps.ts src/components/tour-dialog.tsx src/components/tour-dialog.test.tsx src/app/globals.tour.test.ts src/app/globals.css
git commit -m "feat: add the stepped welcome dialog" -m "Refs #41. Five steps as data (Objetivos, Metas semanais, Tarefas diarias, Busca, Aparencia) with the presentation colours, and a dialog with Voltar, Proximo or Comecar, Pular, an N de 5 indicator announced politely, and a step fade that reduced motion turns off. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The provider and `useTour`

**Files:**
- Create: `src/components/tour-provider.tsx`
- Create: `src/components/tour-provider.test.tsx`

**Interfaces:**
- Consumes: `TourDialog` (Task 2); `usePathname` from `next/navigation`.
- Produces: `TourProvider({ initialSeen, canOpen, onSeen, children }: { initialSeen: boolean; canOpen: boolean; onSeen: () => Promise<void>; children: React.ReactNode })` and `useTour(): { openTour: () => void }` (throws outside the provider).

- [ ] **Step 1: Write the failing tests**

`src/components/tour-provider.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourProvider, useTour } from '@/components/tour-provider'

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

function OpenButton() {
  const { openTour } = useTour()
  return <button onClick={openTour}>Abrir tour</button>
}

function setup(props: { initialSeen?: boolean; canOpen?: boolean; onSeen?: () => Promise<void> } = {}) {
  const onSeen = props.onSeen ?? vi.fn(async () => {})
  const ui = (
    <TourProvider initialSeen={props.initialSeen ?? false} canOpen={props.canOpen ?? true} onSeen={onSeen}>
      <OpenButton />
    </TourProvider>
  )
  const view = render(ui)
  return { onSeen, rerender: () => view.rerender(ui) }
}

beforeEach(() => {
  pathname.current = '/'
})

describe('TourProvider', () => {
  it('opens by itself on the first visit of someone with a session', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
  })

  it('stays closed without a session', () => {
    setup({ canOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays closed when it was already seen', () => {
    setup({ initialSeen: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays closed on the quiz', () => {
    pathname.current = '/quiz'
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens after navigating from the quiz to another page', () => {
    pathname.current = '/quiz'
    const { rerender } = setup()
    expect(screen.queryByRole('dialog')).toBeNull()

    pathname.current = '/'
    rerender()
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
  })

  it('marks the tour as seen once when it closes, whichever way', async () => {
    const { onSeen } = setup()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSeen).toHaveBeenCalledOnce()
  })

  it('does not open by itself again after it was closed', async () => {
    const { rerender } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    pathname.current = '/objectives'
    rerender()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reopens on the first step with openTour, without saving again', async () => {
    const { onSeen } = setup({ initialSeen: true })
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tour' }))
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('dialog', { name: 'Metas semanais' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Abrir tour' }))
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
    expect(onSeen).not.toHaveBeenCalled()
  })

  it('survives a failing save', async () => {
    const onSeen = vi.fn().mockRejectedValue(new Error('offline'))
    setup({ onSeen })
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSeen).toHaveBeenCalledOnce()
  })
})

describe('useTour', () => {
  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<OpenButton />)).toThrow('useTour must be used inside TourProvider')
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/tour-provider.test.tsx`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

`src/components/tour-provider.tsx`:

```tsx
'use client'

import { createContext, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TourDialog } from '@/components/tour-dialog'

// Pages where the tour does not open by itself (the quiz is its own onboarding).
const NO_AUTO_OPEN = ['/quiz']

type TourContextValue = { openTour: () => void }

const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const value = useContext(TourContext)
  if (!value) throw new Error('useTour must be used inside TourProvider')
  return value
}

export function TourProvider({
  initialSeen,
  canOpen,
  onSeen,
  children,
}: {
  initialSeen: boolean
  canOpen: boolean
  onSeen: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const [seen, setSeen] = useState(initialSeen)
  const [manualOpen, setManualOpen] = useState(false)
  // A new run of the dialog starts on its first step.
  const [run, setRun] = useState(0)

  const autoOpen = canOpen && !seen && !NO_AUTO_OPEN.includes(pathname)

  function handleOpenChange(open: boolean) {
    if (open) return
    setManualOpen(false)
    if (!seen) {
      setSeen(true)
      // A failed save only means the tour may open once more next visit.
      onSeen().catch(() => {})
    }
  }

  function openTour() {
    setRun((current) => current + 1)
    setManualOpen(true)
  }

  return (
    <TourContext value={{ openTour }}>
      {children}
      <TourDialog key={run} open={autoOpen || manualOpen} onOpenChange={handleOpenChange} />
    </TourContext>
  )
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/components/tour-provider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tour-provider.tsx src/components/tour-provider.test.tsx
git commit -m "feat: add the tour provider that opens it on the first visit" -m "Refs #41. The dialog is open when it is automatic (session, not seen, not on the quiz) or manual; closing marks it seen once and calls the save, and openTour restarts it on the first step without saving again. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: "Ver tour" in the user menu and the layout wiring

**Files:**
- Modify: `src/components/user-menu.tsx`
- Modify: `src/components/user-menu.test.tsx`
- Modify: `src/components/app-header.test.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `useTour` and `TourProvider` (Task 3); `getTourSeen` (Task 1); `setTourSeen` (Task 1).
- Produces: a "Ver tour" menu item for signed-in users; the layout wraps header, page and bottom nav in `TourProvider`.

- [ ] **Step 1: Update the tests first**

In `src/components/user-menu.test.tsx`: add the mock and wrapper, and the new cases.

1. Add `vi.mock('next/navigation', () => ({ usePathname: () => '/' }))` next to the existing `vi.mock` for the background, and `import { TourProvider } from '@/components/tour-provider'`.
2. In `setup`, wrap the existing tree: `<BackgroundProvider ...><TourProvider initialSeen canOpen={false} onSeen={vi.fn(async () => {})}><UserMenu .../></TourProvider></BackgroundProvider>`.
3. Add to the `describe('UserMenu account', ...)` block:

```tsx
  it('offers "Ver tour" to a signed-in user, which opens the tour on the first step', async () => {
    setup()
    await open('Conta: Ana Maria')
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Ver tour' }))
    expect(await screen.findByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
  })

  it('offers "Ver tour" to a guest too', async () => {
    setup({ user: guest })
    await open('Conta: Visitante')
    expect(await screen.findByRole('menuitem', { name: 'Ver tour' })).toBeInTheDocument()
  })
```

4. In the signed-out test ("without a session, offers only the appearance menu") add `expect(screen.queryByRole('menuitem', { name: 'Ver tour' })).toBeNull()`.

In `src/components/app-header.test.tsx`: add `import { TourProvider } from '@/components/tour-provider'` and change the local `render` helper to wrap in both providers:

```tsx
const render = (ui: ReactElement) =>
  rtlRender(
    <BackgroundProvider initial="nenhum" onChange={vi.fn()}>
      <TourProvider initialSeen canOpen={false} onSeen={vi.fn(async () => {})}>
        {ui}
      </TourProvider>
    </BackgroundProvider>,
  )
```

(its `next/navigation` mock already provides `usePathname`).

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/user-menu.test.tsx src/components/app-header.test.tsx`
Expected: FAIL on the new "Ver tour" cases (the item does not exist yet).

- [ ] **Step 3: Implement**

In `src/components/user-menu.tsx`:

1. `import { useTour } from '@/components/tour-provider'`.
2. Inside the component: `const { openTour } = useTour()`.
3. In the signed-in block that holds the separator and "Sair", add the item before "Sair":

```tsx
                  <Menu.Item className={itemClass} onClick={openTour}>
                    Ver tour
                  </Menu.Item>
```

In `src/app/layout.tsx`:

1. Add imports: `import { TourProvider } from "@/components/tour-provider";`, `import { setTourSeen } from "@/lib/actions/tour";`, `import { getTourSeen } from "@/lib/tour";`.
2. Read it with the other cookies: `const tourSeen = await getTourSeen();`.
3. Wrap the header, the content `div` and the bottom nav in the provider, inside `BackgroundProvider`:

```tsx
        <BackgroundProvider initial={background} onChange={setBackground}>
          <TourProvider initialSeen={tourSeen} canOpen={!!user} onSeen={setTourSeen}>
            <AppHeader theme={theme} onThemeChange={setTheme} user={user} />
            <div id="conteudo" ...>{children}</div>
            {user && <BottomNav />}
          </TourProvider>
        </BackgroundProvider>
```

(keep the existing attributes on the `div`).

- [ ] **Step 4: Run to see them pass, then typecheck and lint**

Run: `npx vitest run src/components/user-menu.test.tsx src/components/app-header.test.tsx && npx tsc --noEmit && npx eslint src`
Expected: PASS, no errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/user-menu.tsx src/components/user-menu.test.tsx src/components/app-header.test.tsx src/app/layout.tsx
git commit -m "feat: open the welcome tour on the first visit and from the user menu" -m "Refs #41. The layout reads the tour cookie and wraps the page in TourProvider; the user menu gets Ver tour for people with a session (guests included). Menu and header tests wrap their renders in the provider. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verify in the browser, document, and open the PR

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/tour.jpg`

**Interfaces:**
- Consumes: the running app from Task 4.
- Produces: README entries and the screenshot.

- [ ] **Step 1: Run the full suite and the zone runner**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: everything passes. Then `node scripts/test-both-tz.mjs src/lib src/components` for the three zones; expected all passing.

- [ ] **Step 2: Check it in the browser**

Start the `dev` preview (`preview_start` with name `dev`; never run `next build` while it runs). With no `tour` cookie, enter as a guest from `/` and confirm the dialog opens on Hoje, on step 1, in the dark theme; take a screenshot. Walk through the five steps, check "Voltar", the indicator and the last button "Começar". Close it, reload and confirm it does not open again; open the user menu, click "Ver tour" and confirm it reopens on step 1. Switch to the light theme and check the dialog; check the phone width (375 px). Confirm the quiz page (`/quiz`) does not open it for a new account without the cookie. Reset the viewport and stop the preview when done.

- [ ] **Step 3: Add the screenshot**

Copy the desktop dark-theme screenshot of the dialog (the browser tool prints the saved path with the screenshot) to `docs/screenshots/tour.jpg`.

- [ ] **Step 4: Update the README**

In the "Funcionalidades" list add after the presentation page bullet:

```md
- **Tour de boas-vindas:** na primeira visita, um diálogo em cinco etapas (objetivos, metas semanais, tarefas
  diárias, busca e aparência) apresenta o app. Ele lembra por cookie que já foi visto e pode ser reaberto em
  "Ver tour", no menu da conta.
```

In "Capturas de tela", add after the presentation page screenshot:

```md
### Tour de boas-vindas

![Diálogo de boas-vindas na primeira etapa, sobre a tela Hoje](docs/screenshots/tour.jpg)
```

- [ ] **Step 5: Commit, push and open the PR**

```bash
git add README.md docs/screenshots/tour.jpg
git commit -m "docs: document the welcome tour in the README" -m "Refs #41. Adds the feature bullet and a screenshot. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/41-tour-boas-vindas
```

Open the PR into `develop` with the attribution block first, `Closes #41`, the Antes/Depois/Como foi feito/Como foi testado sections and the Claude Code footer; assign and request review from `fraissatt`; move the cards to "Em revisão"; wait for CI with `gh pr checks <n> --watch`; ask the user to merge. After the merge, close #41 by hand, sync `develop`, then follow the release routine (version bump PR to 1.3.0, release PR `develop` to `master`, tag and GitHub Release `v1.3.0`).
