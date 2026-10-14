# Float island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop header and the phone bottom bar into floating "island" bars that hide while scrolling down and return while scrolling up.

**Architecture:** A pure rule (`nextScrollState`) decides hidden/shown from the scroll position; a client hook (`useScrollHide`) feeds it the scroll events, the "pinned" state (focus or open menu) and an optional media query; one `FloatingBar` component applies the result (transform, opacity, `inert`) and is used by both `AppHeader` and `BottomNav`. A CSS `island` utility gives the glass look.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (`@utility`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-14-float-island-design.md`

## Global Constraints

- Visual change only: no route, data, auth or server logic changes; `NAV_LINKS`, the tour, search, user menu and day summary are untouched.
- Hide only after scrolling down past 80 px; ignore moves of 6 px or less (hysteresis).
- Never hidden while the island holds focus, has an open menu (`aria-expanded="true"` inside it) or a dialog is open (`[role="dialog"]` in the document).
- Hidden means `inert`, `opacity-0`, translated out; with reduced motion there is no slide or fade (`motion-safe` transitions).
- Top island from `md` (768 px) up; below `md` the top bar stays the simple sticky bar; the bottom island is for below `md` only.
- Theme colours come from tokens (a test forbids hex colours in components); the dark theme keeps the neon only on the active link.
- All user-facing text stays in pt-BR; code and comments in English; read the Next docs in `node_modules/next/dist/docs` before touching Next-specific code (none expected here).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and mention `Refs #69`.

## Review Focus

- A page too short to scroll: the island is never hidden.
- A fast flick down then a tiny move up (under 6 px): no flicker, the state does not flip.
- The user menu or search is open (the island is "in use"): it must not disappear under the user's hand, even when scrolling down.
- Tab pressed while the island is hidden: focus must not land on an invisible bar (`inert`).
- Resizing across `md`: the top island must not stay hidden (or inert) when it is the phone's plain bar, and the bottom island must not hide on desktop.

---

## File structure

- Create `src/lib/scroll-hide.ts` + `src/lib/scroll-hide.test.ts`: the pure rule.
- Create `src/components/use-scroll-hide.ts` + `src/components/use-scroll-hide.test.tsx`: the hook.
- Create `src/components/floating-bar.tsx` + `src/components/floating-bar.test.tsx`: the island container.
- Modify `src/app/globals.css`: `@utility island`; add `src/app/globals.island.test.ts`.
- Modify `src/components/app-header.tsx`, `src/components/guest-banner.tsx` (+ their tests).
- Modify `src/components/bottom-nav.tsx` (+ test) and `src/app/layout.tsx` (bottom padding).
- Update `README.md` and the spec if the final classes differ.

---

### Task 1: The scroll rule

**Files:**
- Create: `src/lib/scroll-hide.ts`
- Test: `src/lib/scroll-hide.test.ts`

**Interfaces:**
- Produces: `HIDE_AFTER = 80`, `MIN_MOVE = 6`, `type ScrollState = { hidden: boolean; lastY: number }`, `nextScrollState(state: ScrollState, y: number, pinned: boolean): ScrollState`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { HIDE_AFTER, MIN_MOVE, nextScrollState } from '@/lib/scroll-hide'

const shown = (lastY: number) => ({ hidden: false, lastY })
const hidden = (lastY: number) => ({ hidden: true, lastY })

describe('nextScrollState', () => {
  it('stays shown at the top and until the page has scrolled past the threshold', () => {
    expect(nextScrollState(shown(0), 0, false)).toEqual(shown(0))
    expect(nextScrollState(shown(0), HIDE_AFTER, false).hidden).toBe(false)
  })

  it('hides when moving down past the threshold', () => {
    expect(nextScrollState(shown(70), HIDE_AFTER + 20, false)).toEqual(hidden(HIDE_AFTER + 20))
  })

  it('shows again when moving up', () => {
    expect(nextScrollState(hidden(400), 380, false)).toEqual(shown(380))
  })

  it('shows again back at the top, however it got there', () => {
    expect(nextScrollState(hidden(40), 0, false)).toEqual(shown(0))
  })

  it('ignores moves of MIN_MOVE or less and keeps the reference point, so small moves add up', () => {
    const start = hidden(300)
    expect(nextScrollState(start, 300 - MIN_MOVE, false)).toEqual(start)
    expect(nextScrollState(start, 300 + MIN_MOVE, false)).toEqual(start)
    // Three small steps up from 300 do not flip it one by one, but the third crosses the limit in total.
    let state = start
    for (const y of [297, 294]) state = nextScrollState(state, y, false)
    expect(state.hidden).toBe(true)
    expect(nextScrollState(state, 292, false).hidden).toBe(false)
  })

  it('never hides while pinned, and shows if it was hidden', () => {
    expect(nextScrollState(shown(100), 500, true)).toEqual(shown(500))
    expect(nextScrollState(hidden(500), 600, true)).toEqual(shown(600))
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/scroll-hide.test.ts`
Expected: FAIL, module `@/lib/scroll-hide` not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// The rule behind the floating bars: hide on the way down, show on the way up.
export const HIDE_AFTER = 80
export const MIN_MOVE = 6

export type ScrollState = { hidden: boolean; lastY: number }

/**
 * `lastY` is the scroll position of the last decision: it only moves when the
 * page has moved more than MIN_MOVE from it, so tiny moves add up instead of flickering.
 */
export function nextScrollState(state: ScrollState, y: number, pinned: boolean): ScrollState {
  if (pinned || y <= HIDE_AFTER) return { hidden: false, lastY: y }
  const moved = y - state.lastY
  if (moved > MIN_MOVE) return { hidden: true, lastY: y }
  if (moved < -MIN_MOVE) return { hidden: false, lastY: y }
  return state
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/scroll-hide.test.ts`
Expected: PASS (6 tests). Check the "small moves add up" test: from 300, `297` and `294` return the same state (moved -3, -6), and `292` is a move of -8 from 300, so it shows.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scroll-hide.ts src/lib/scroll-hide.test.ts
git commit -m "feat: add the scroll rule that hides and shows the floating bars

Refs #69

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The hook and the floating bar

**Files:**
- Create: `src/components/use-scroll-hide.ts`, `src/components/floating-bar.tsx`
- Test: `src/components/floating-bar.test.tsx`

**Interfaces:**
- Consumes: `nextScrollState`, `ScrollState` from `@/lib/scroll-hide`.
- Produces: `useScrollHide(ref: RefObject<HTMLElement | null>, when?: string): boolean` (the hidden state; `when` is a media query, and when it does not match the result is always `false`); `FloatingBar({ edge: 'top' | 'bottom', when?: string } & ComponentProps<'div'>)`.

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { FloatingBar } from '@/components/floating-bar'

let matches = true
let scrollY = 0

function scrollTo(y: number) {
  scrollY = y
  act(() => {
    fireEvent.scroll(window)
  })
}

beforeEach(() => {
  matches = true
  scrollY = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const bar = () => screen.getByTestId('bar')

function setup(props: Partial<React.ComponentProps<typeof FloatingBar>> = {}) {
  return render(
    <FloatingBar edge="top" data-testid="bar" {...props}>
      <button type="button">Dentro</button>
      <button type="button" aria-expanded="false">
        Menu
      </button>
    </FloatingBar>,
  )
}

describe('FloatingBar', () => {
  it('is shown at first, with its edge on the element', () => {
    setup()
    expect(bar()).toHaveAttribute('data-edge', 'top')
    expect(bar()).toHaveAttribute('data-hidden', 'false')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('hides (and becomes inert) when scrolling down past the threshold, and returns when scrolling up', () => {
    setup()
    scrollTo(200)
    expect(bar()).toHaveAttribute('data-hidden', 'true')
    expect(bar()).toHaveAttribute('inert')
    scrollTo(150)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('slides out upwards at the top edge and downwards at the bottom edge', () => {
    const { unmount } = setup()
    scrollTo(200)
    expect(bar().className).toMatch(/-translate-y-/)
    unmount()
    scrollTo(0)
    setup({ edge: 'bottom' })
    scrollTo(200)
    expect(bar().className).toMatch(/(^|\s)translate-y-/)
    expect(bar().className).not.toMatch(/-translate-y-/)
  })

  it('never hides a page that is too short to scroll', () => {
    setup()
    scrollTo(60)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('stays while focus is inside it', () => {
    setup()
    screen.getByRole('button', { name: 'Dentro' }).focus()
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('stays while one of its menus is open', () => {
    setup()
    screen.getByRole('button', { name: 'Menu' }).setAttribute('aria-expanded', 'true')
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('stays while a dialog is open somewhere on the page', () => {
    setup()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('does not hide where its media query does not match (the plain phone bar, or desktop for the bottom bar)', () => {
    matches = false
    setup({ when: '(min-width: 768px)' })
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('hides without a transition class when motion is reduced, by using motion-safe transitions only', () => {
    setup()
    expect(bar().className).toMatch(/motion-safe:transition/)
    expect(bar().className).not.toMatch(/(^|\s)transition/)
  })

  it('stops listening to the scroll when it goes away', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = setup()
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/floating-bar.test.tsx`
Expected: FAIL, module `@/components/floating-bar` not found.

- [ ] **Step 3: Write the hook and the component**

`src/components/use-scroll-hide.ts`:

```ts
'use client'

import { useEffect, useState, type RefObject } from 'react'
import { nextScrollState, type ScrollState } from '@/lib/scroll-hide'

// "In use": focus inside the bar, one of its menus open, or any dialog open (search).
function isPinned(element: HTMLElement | null): boolean {
  if (!element) return false
  return (
    element.contains(document.activeElement) ||
    element.querySelector('[aria-expanded="true"]') !== null ||
    document.querySelector('[role="dialog"]') !== null
  )
}

/**
 * Whether the bar should be hidden for the current scroll. `when` is a media query:
 * outside it the bar is never hidden (it is the plain bar of another screen size).
 */
export function useScrollHide(ref: RefObject<HTMLElement | null>, when?: string): boolean {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let state: ScrollState = { hidden: false, lastY: window.scrollY }
    let frame = 0
    let scheduled = false

    const applies = () => !when || (typeof matchMedia === 'function' && matchMedia(when).matches)

    function update() {
      scheduled = false
      if (!applies()) {
        state = { hidden: false, lastY: window.scrollY }
      } else {
        state = nextScrollState(state, window.scrollY, isPinned(ref.current))
      }
      setHidden((current) => (current === state.hidden ? current : state.hidden))
    }

    const schedule = () => {
      if (scheduled) return
      scheduled = true
      frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (scheduled) cancelAnimationFrame(frame)
    }
  }, [ref, when])

  return hidden
}
```

`src/components/floating-bar.tsx`:

```tsx
'use client'

import { useRef, type ComponentProps } from 'react'
import { useScrollHide } from '@/components/use-scroll-hide'
import { cn } from '@/lib/utils'

type Edge = 'top' | 'bottom'

const OUT: Record<Edge, string> = { top: '-translate-y-[150%]', bottom: 'translate-y-[150%]' }

/**
 * A bar that floats at the top or the bottom and slides out while the page scrolls down.
 * Hidden means inert (Tab skips it), invisible and translated away; the transition only
 * runs when motion is allowed.
 */
export function FloatingBar({
  edge,
  when,
  className,
  children,
  ...props
}: { edge: Edge; when?: string } & ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null)
  const hidden = useScrollHide(ref, when)

  return (
    <div
      ref={ref}
      data-edge={edge}
      data-hidden={hidden}
      inert={hidden}
      className={cn(
        'motion-safe:transition-[transform,opacity] motion-safe:duration-300',
        hidden && cn(OUT[edge], 'pointer-events-none opacity-0'),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/floating-bar.test.tsx`
Expected: PASS (10 tests). If the "stays while focus is inside it" test fails because the scroll event reaches the hook before focus is registered, call `act(() => screen.getByRole('button', { name: 'Dentro' }).focus())`.

- [ ] **Step 5: Commit**

```bash
git add src/components/use-scroll-hide.ts src/components/floating-bar.tsx src/components/floating-bar.test.tsx
git commit -m "feat: add the floating bar that hides on scroll down and returns on scroll up

Refs #69

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The glass look

**Files:**
- Modify: `src/app/globals.css` (add the `island` utility next to the card styles)
- Test: `src/app/globals.island.test.ts` (create)

**Interfaces:**
- Produces: a Tailwind utility `island` (usable as `md:island`).

- [ ] **Step 1: Write the failing test** (use the Write tool: the regexes have backslashes)

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

describe('island style', () => {
  const rule = css.match(/@utility island\s*{([\s\S]*?)\n}/)

  it('is a glass bar: translucent card colour, blur, a fine border and layered shadows', () => {
    expect(rule, '@utility island').not.toBeNull()
    expect(rule?.[1]).toMatch(/background-color: color-mix\(in oklab, var\(--card\)/)
    expect(rule?.[1]).toMatch(/backdrop-filter: blur\(/)
    expect(rule?.[1]).toMatch(/border: 1px solid/)
    expect(rule?.[1].match(/rgb\(/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('has its own dark shadow, so the neon stays on the active link only', () => {
    expect(css).toMatch(/\.dark \.island\s*{[^}]*box-shadow/)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/app/globals.island.test.ts`
Expected: FAIL, `@utility island` not found.

- [ ] **Step 3: Add the CSS** (before `@layer base {`, after the card styles; use the Edit tool)

```css
/* Floating bars (the desktop header and the phone navigation): glass over the page. Used as
   `md:island` on the top bar, so the plain phone bar keeps its flat look. */
@utility island {
  background-color: color-mix(in oklab, var(--card) 82%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  box-shadow:
    0 1px 2px rgb(10 42 102 / 0.08),
    0 6px 14px rgb(10 42 102 / 0.07),
    0 14px 28px rgb(0 87 255 / 0.08);
}

.dark .island {
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.5),
    0 10px 28px rgb(0 0 0 / 0.45);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/app/globals.island.test.ts src/lib/theme-contrast.test.ts`
Expected: PASS. If Tailwind rejects `.dark .island` (a utility name used outside `@utility`), move the dark shadow into a second `@utility island` is not possible: instead write it as `.dark .island` inside `@layer components`, which is plain CSS and works.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/globals.island.test.ts
git commit -m "feat: add the island glass style

Refs #69

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The desktop island in `AppHeader`, and the guest strip

**Files:**
- Modify: `src/components/app-header.tsx`, `src/components/guest-banner.tsx`
- Test: `src/components/app-header.test.tsx`, `src/components/guest-banner.test.tsx`

**Interfaces:**
- Consumes: `FloatingBar` (Task 2) and the `island` utility (Task 3).

- [ ] **Step 1: Write the failing tests** (add to the existing files)

In `src/components/app-header.test.tsx`:

```tsx
  it('puts the bar in a top island from md up, hidden only where that applies', async () => {
    render(await AppHeader({ ...base, user: { id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false } }))
    const island = screen.getByRole('banner').firstElementChild as HTMLElement
    expect(island).toHaveAttribute('data-edge', 'top')
    expect(island.className).toMatch(/md:island/)
    expect(island.className).toMatch(/md:fixed/)
    expect(island.className).toMatch(/sticky/) // the plain bar below md
  })

  it('keeps a spacer where the fixed island used to take room, from md up', async () => {
    render(await AppHeader({ ...base, user: null }))
    const spacer = screen.getByRole('banner').nextElementSibling as HTMLElement
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer.className).toMatch(/hidden/)
    expect(spacer.className).toMatch(/md:block/)
  })

  it('guest: the notice is outside the bar, in flow below it', async () => {
    render(await AppHeader({ ...base, user: { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true } }))
    const header = screen.getByRole('banner')
    expect(within(header).queryByRole('status')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
```

(`within` must be added to the `@testing-library/react` import.) In `src/components/guest-banner.test.tsx` add:

```tsx
  it('is a rounded strip from md up, aligned with the island', () => {
    render(<GuestBanner />)
    expect(screen.getByRole('status').className).toMatch(/md:rounded-xl/)
    expect(screen.getByRole('status').className).toMatch(/md:max-w-6xl/)
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/app-header.test.tsx src/components/guest-banner.test.tsx`
Expected: FAIL (no `data-edge`, banner still inside the header).

- [ ] **Step 3: Implement**

`guest-banner.tsx`:

```tsx
export function GuestBanner() {
  return (
    <div
      role="status"
      className="border-b border-border bg-secondary text-secondary-foreground md:mx-auto md:mt-2 md:w-[calc(100%-2rem)] md:max-w-6xl md:rounded-xl md:border"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-6">
        {/* ...the text and the "Criar conta" link stay exactly as they are... */}
      </div>
    </div>
  )
}
```

`app-header.tsx`: replace the `<header>` block with

```tsx
  return (
    <>
      <header className="relative z-40">
        {user && <RefreshOnFocus />}
        <FloatingBar
          edge="top"
          when="(min-width: 768px)"
          className="sticky top-0 border-b border-border bg-background/80 backdrop-blur md:island md:fixed md:inset-x-4 md:top-3 md:mx-auto md:max-w-6xl md:rounded-full md:border-b"
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
            {/* ...the logo, HeaderNav, search, help, summary and user menu, exactly as today... */}
          </div>
        </FloatingBar>
      </header>
      {/* The fixed island takes no room: this keeps the page below it. */}
      <div aria-hidden="true" className="hidden h-[4.5rem] md:block" />
      {user?.isAnonymous && <GuestBanner />}
    </>
  )
```

Import `FloatingBar` from `@/components/floating-bar`. Check the `<header>` keeps the `banner` role (it is a top-level `header`, so it does).

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/app-header.test.tsx src/components/guest-banner.test.tsx src/components/header-nav.test.tsx`
Expected: PASS. Fix any older assertion that relied on the banner being inside the header (the notes list a stale app-header mock as a known minor).

- [ ] **Step 5: Commit**

```bash
git add src/components/app-header.tsx src/components/guest-banner.tsx src/components/app-header.test.tsx src/components/guest-banner.test.tsx
git commit -m "feat: make the desktop header a floating island and the guest notice a strip

Refs #69

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The phone island, the page padding, and the check in the app

**Files:**
- Modify: `src/components/bottom-nav.tsx`, `src/app/layout.tsx`, `README.md`
- Test: `src/components/bottom-nav.test.tsx`

**Interfaces:**
- Consumes: `FloatingBar` (Task 2) and the `island` utility (Task 3).

- [ ] **Step 1: Write the failing test** (add to `bottom-nav.test.tsx`, mocking `matchMedia` like the other tests if the hook needs it)

```tsx
  it('is a bottom island that only hides below md and is gone from md up', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<BottomNav />)
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const island = nav.parentElement as HTMLElement // the FloatingBar carries the position and the glass
    expect(island).toHaveAttribute('data-edge', 'bottom')
    expect(island.className).toMatch(/(^|\s)island(\s|$)/)
    expect(island.className).toMatch(/md:hidden/)
    expect(island.className).toMatch(/rounded-full/)
    expect(island.className).toMatch(/bottom-\[calc\(0\.75rem/) // floating, with a margin from the edge
  })
```

The test file needs `vi.stubGlobal('matchMedia', ...)`, `requestAnimationFrame` and `cancelAnimationFrame` stubs in a `beforeEach`, as in `floating-bar.test.tsx`, because `FloatingBar` runs the hook.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/bottom-nav.test.tsx`
Expected: FAIL (`data-edge` missing, no floating margin).

- [ ] **Step 3: Implement**

`bottom-nav.tsx`: wrap the `<nav>` content in `FloatingBar` by turning the element into the bar itself: keep the `<nav aria-label="Navegação principal">` as the semantic element, with `FloatingBar` as its parent that carries position and glass:

```tsx
  return (
    <FloatingBar
      edge="bottom"
      when="(max-width: 767px)"
      className="island fixed inset-x-0 bottom-[calc(0.75rem_+_env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full md:hidden"
    >
      <nav aria-label="Navegação principal" className="flex items-stretch justify-around gap-1 px-2 py-1">
        {/* the links, unchanged */}
      </nav>
    </FloatingBar>
  )
```

The bar is centred with `inset-x-0 mx-auto w-fit` and not with a `-translate-x-1/2`, because `FloatingBar` already uses `transform` to slide out and a second translate would fight with it.

`layout.tsx`: change the content padding from `pb-[calc(3.5rem_+_env(safe-area-inset-bottom))]` to `pb-[calc(5rem_+_env(safe-area-inset-bottom))]` (the island is 3rem plus its 0.75rem margin plus air).

- [ ] **Step 4: Run the whole suite and check it in the app**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: all green. Then open the app in the browser (the dev server on port 3000) as a guest:
- at desktop width: the island floats at the top, hides when scrolling down a long page (use the Objetivos or Hoje page with enough content, or add data), returns on scroll up; open the user menu and scroll: it stays;
- at 375 px: the top bar is the plain sticky bar, the bottom island floats and hides/returns the same way; Tab skips it while hidden;
- both themes; reduced motion (DevTools rendering emulation) hides without sliding.

- [ ] **Step 5: README, commit and PR**

Add one bullet to the README's feature list ("Navegação flutuante, que some ao rolar") and set the spec's "Changed" section right if the final classes differ.

```bash
git add src/components/bottom-nav.tsx src/components/bottom-nav.test.tsx src/app/layout.tsx README.md docs/superpowers/specs/2026-10-14-float-island-design.md
git commit -m "feat: make the phone navigation a floating island and add room under the page

Refs #69

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Then push, open the PR into `develop` (attribution block, `Closes #69`, Antes/Depois/Como foi feito/Como foi testado, with a before/after screenshot if possible), assign and request review from `fraissatt`, wait for CI, and report with the Vercel preview link.

---

## Self-review

- **Spec coverage:** floating desktop island, phone bottom island, guest strip, hide on scroll with 80 px / 6 px rules, pinned by focus/menu/dialog, `inert` while hidden, reduced motion, spacer, bottom padding, README and tests: Tasks 1 to 5. Landing header gets the island through `AppHeader` (no separate task).
- **Placeholders:** the two `{/* ... unchanged ... */}` markers in Tasks 4 and 5 stand for existing JSX that must be kept as it is; they are not unwritten work.
- **Types:** `nextScrollState(state, y, pinned)` and `ScrollState` are the same in Tasks 1 and 2; `useScrollHide(ref, when)` and `FloatingBar({ edge, when })` match their use in Tasks 4 and 5.
- **Review Focus:** short page (Task 2 test), hysteresis (Task 1 test), menu or search open (Task 2 tests), hidden means inert (Task 2 test), media query (Task 2 test).
