# Interactive Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mouse-reactive page background. Aurora is the default, Grade de pontos and Nenhum are the alternatives, the choice is remembered in a cookie, and it is picked from a header menu.

**Architecture:** Pure options module plus a cookie read and a Server Action, mirroring the theme. A client `BackgroundProvider` in the layout owns the current choice (optimistic, with serialized saves) and renders a fixed, `aria-hidden` Canvas 2D layer behind the content. A Base UI Menu in the header changes it.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before touching Next APIs, per AGENTS.md), React 19, Tailwind 4, Base UI Menu, Canvas 2D, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-fundo-interativo-design.md`

## Global Constraints

- Branch `feature/fundo-interativo` (cut from `develop`). Merge into `develop` with `--no-ff`. Never commit to `develop` or `master` directly.
- Commit messages are detailed. The last line is exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`, and it never names another model; verify with `git log -1 --format=%B`. On Windows, write the message to a file and use `git commit -F <file>`.
- No new dependencies.
- Cookie `fundo`, with values `aurora` | `pontos` | `nenhum`. Missing or invalid means `aurora`. Options: `path: '/'`, `sameSite: 'lax'`, one-year `maxAge`, not `httpOnly`.
- UI copy, exactly: "Aurora", "Grade de pontos", "Nenhum", and the trigger `aria-label` "Fundo: {label}".
- No 6- or 8-digit hex literals in `src/**/*.tsx?`; `theme-contrast.test.ts` enforces this. Effect colors come from CSS variables at runtime.
- Client components never import `next/headers` modules. Use `@/lib/background-options` for values, and receive actions as props.
- The canvas is `aria-hidden`, `pointer-events-none` and `fixed inset-0 -z-10`.
- Pause the animation when the tab is hidden. Under reduced motion or `(hover: none)`, draw a single static frame.
- Never run `next build` in this folder while a dev server may be running (see project memory). Do not start or stop servers. Use tests, lint and tsc.
- Four test files already have TypeScript fixture errors; they are not ours to fix.

## Review Focus

1. **A garbage cookie** must render Aurora and never crash. Pinned in Task 1.
2. **A failed save** must snap the background back to the last saved choice, with rapid changes landing in click order. Pinned in Task 3.
3. **Theme toggle while the background is animating:** colors must follow the new theme without a reload. Pinned in Task 2 (MutationObserver re-reads the variables) and checked manually in Task 4.
4. **Reduced motion and touch devices:** no continuous animation loop. Pinned in Task 2.
5. **Legibility and clicks:** content stays on top and clickable. Pinned in Task 2 (`pointer-events-none`, `-z-10`) and checked manually in Task 4.

---

### Task 1: Options, cookie read, and the `setBackground` action

**Files:**
- Create: `src/lib/background-options.ts` and `src/lib/background-options.test.ts`
- Create: `src/lib/background.ts`
- Create: `src/lib/actions/background.ts` and `src/lib/actions/background.test.ts`

**Interfaces (produces):**
- `type BackgroundStyle = 'aurora' | 'pontos' | 'nenhum'`
- `DEFAULT_BACKGROUND`
- `BACKGROUND_COOKIE = 'fundo'`
- `BACKGROUND_STYLES: readonly BackgroundStyle[]`, ordered aurora, pontos, nenhum
- `BACKGROUND_LABELS`
- `parseBackground(value: string | undefined): BackgroundStyle`
- `getBackground(): Promise<BackgroundStyle>`, in `background.ts`
- `setBackground(style: BackgroundStyle): Promise<void>`

- [ ] **Step 1: Write the failing tests.**

`src/lib/background-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BACKGROUND_LABELS, BACKGROUND_STYLES, parseBackground } from '@/lib/background-options'

describe('parseBackground', () => {
  it('defaults to aurora for missing or unknown values', () => {
    expect(parseBackground(undefined)).toBe('aurora')
    expect(parseBackground('')).toBe('aurora')
    expect(parseBackground('Aurora')).toBe('aurora')
    expect(parseBackground(' pontos')).toBe('aurora')
    expect(parseBackground('neve')).toBe('aurora')
  })

  it('accepts the three exact values', () => {
    expect(parseBackground('aurora')).toBe('aurora')
    expect(parseBackground('pontos')).toBe('pontos')
    expect(parseBackground('nenhum')).toBe('nenhum')
  })

  it('labels every option in Portuguese, in menu order', () => {
    expect(BACKGROUND_STYLES.map((s) => BACKGROUND_LABELS[s])).toEqual(['Aurora', 'Grade de pontos', 'Nenhum'])
  })
})
```

`src/lib/actions/background.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ set })) }))

import { setBackground } from '@/lib/actions/background'

describe('setBackground', () => {
  beforeEach(() => set.mockClear())

  it('stores the choice in a year-long, script-readable cookie', async () => {
    await setBackground('pontos')
    expect(set).toHaveBeenCalledWith('fundo', 'pontos', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  })

  it('normalises invalid input to the default', async () => {
    await setBackground('neve' as never)
    expect(set).toHaveBeenCalledWith('fundo', 'aurora', expect.any(Object))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run src/lib/background-options.test.ts src/lib/actions/background.test.ts`.

- [ ] **Step 3: Implement.**

`src/lib/background-options.ts`:

```ts
export type BackgroundStyle = 'aurora' | 'pontos' | 'nenhum'

export const DEFAULT_BACKGROUND: BackgroundStyle = 'aurora'
export const BACKGROUND_COOKIE = 'fundo'
export const BACKGROUND_STYLES: readonly BackgroundStyle[] = ['aurora', 'pontos', 'nenhum']
export const BACKGROUND_LABELS: Record<BackgroundStyle, string> = {
  aurora: 'Aurora',
  pontos: 'Grade de pontos',
  nenhum: 'Nenhum',
}

// Exact match: the cookie is only written by setBackground, so anything else
// is tampering or a stale format and gets the default.
export function parseBackground(value: string | undefined): BackgroundStyle {
  return BACKGROUND_STYLES.includes(value as BackgroundStyle) ? (value as BackgroundStyle) : DEFAULT_BACKGROUND
}
```

`src/lib/background.ts`:

```ts
import { cookies } from 'next/headers'
import { BACKGROUND_COOKIE, parseBackground, type BackgroundStyle } from '@/lib/background-options'

export * from '@/lib/background-options'

export async function getBackground(): Promise<BackgroundStyle> {
  const store = await cookies()
  return parseBackground(store.get(BACKGROUND_COOKIE)?.value)
}
```

`src/lib/actions/background.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { BACKGROUND_COOKIE, parseBackground, type BackgroundStyle } from '@/lib/background-options'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function setBackground(style: BackgroundStyle): Promise<void> {
  const store = await cookies()
  store.set(BACKGROUND_COOKIE, parseBackground(style), {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass,** then run lint.
- [ ] **Step 5: Commit.**

---

### Task 2: `InteractiveBackground` canvas

**Files:**
- Create: `src/components/interactive-background.tsx`
- Create: `src/components/interactive-background.test.tsx`

**Interfaces:**
- Consumes the `BackgroundStyle` type from `@/lib/background-options`.
- Produces `InteractiveBackground(props: { style: BackgroundStyle })` (client), plus the exported pure helper `hexToRgb(value: string): [number, number, number] | null`.

- [ ] **Step 1: Write the failing tests.** In jsdom there is no canvas context, so stub it in a `beforeEach`. Stub `getContext` to return an object with no-op `setTransform`, `clearRect`, `fillRect`, `beginPath`, `arc`, `fill` and `createRadialGradient` (which returns `{ addColorStop() {} }`), plus writable `fillStyle`. Stub `window.matchMedia` per test.
  - `hexToRgb('#39ff14')` → `[57, 255, 20]`; `hexToRgb(' #1F6BFF ')` → `[31, 107, 255]`; `hexToRgb('oklch(0.7 0.1 20)')` → `null`.
  - `render(<InteractiveBackground style="nenhum" />)` renders no canvas (`container.querySelector('canvas')` is null).
  - For `aurora` and `pontos`: one canvas with `aria-hidden="true"` and the classes `pointer-events-none`, `fixed`, `inset-0` and `-z-10`.
  - Reduced motion: mock `matchMedia` so that `(prefers-reduced-motion: reduce)` matches, and spy on `requestAnimationFrame`. After render with `aurora`, `requestAnimationFrame` must not have been called more than once. Advance a few real frames with `await new Promise(r => setTimeout(r, 50))` and check the count did not grow.
  - Unmount: spy on `cancelAnimationFrame` and `window.removeEventListener`. After `unmount()`, `removeEventListener` was called for `'pointermove'`.

- [ ] **Step 2: Run the tests to verify they fail.**

- [ ] **Step 3: Implement** per the spec's "InteractiveBackground" section. Key points:
  - **Render:** `if (style === 'nenhum') return null`. Otherwise render `<canvas ref aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />`.
  - **One effect keyed on `style`:**
    - **Context and size:** get the 2D context (bail if null). Size the canvas to `innerWidth`/`innerHeight` × `min(devicePixelRatio, 2)` and call `setTransform(dpr, 0, 0, dpr, 0, 0)`.
    - **Colors:** `readColors()` reads `getComputedStyle(document.documentElement).getPropertyValue('--primary' | '--support' | '--chart-1')` through `hexToRgb`, with fallbacks `[57, 255, 20]`, `[167, 139, 250]` and `[42, 48, 60]`. `isDark = document.documentElement.classList.contains('dark')`.
    - **Theme changes:** a MutationObserver on `document.documentElement` (`attributes: true, attributeFilter: ['class', 'data-theme']`) re-reads the colors and draws a frame.
    - **Static mode:** `const reduce = matchMedia('(prefers-reduced-motion: reduce)')` and `const touch = matchMedia('(hover: none)')`. `isStatic = reduce.matches || touch.matches`, re-evaluated on their `change` events.
    - **Pointer:** a passive `window` `pointermove` listener sets the target and calls `kick()` to ensure the loop runs. `document.documentElement` `pointerleave` clears the target.
    - **Frame:** `draw(time)` eases the position (0.12), `clearRect`s the whole canvas, then draws aurora or pontos with the constants from the spec. Aurora alpha is 0.18 when `isDark`, else 0.14.
    - **Loop:** `requestAnimationFrame(tick)`. Continue while `!document.hidden && !isStatic && (style === 'aurora' || easing not settled)`, where settled means the eased point is within 0.5px of the target. In static mode, draw once with no pointer influence and do not schedule frames.
    - **Visibility:** `visibilitychange` resumes via `kick()` when visible.
    - **Resize:** a `resize` listener re-sizes and draws.
    - **Cleanup:** `cancelAnimationFrame`, remove every listener, disconnect the observer, and remove the media-query listeners.

- [ ] **Step 4: Run the tests to verify they pass** with pristine output, then run lint.
- [ ] **Step 5: Commit.**

---

### Task 3: `BackgroundProvider` and `BackgroundPicker`

**Files:**
- Create: `src/components/background-provider.tsx` and `src/components/background-provider.test.tsx`
- Create: `src/components/background-picker.tsx` and `src/components/background-picker.test.tsx`

**Interfaces:**
- Consumes:
  - `InteractiveBackground` (Task 2)
  - from `@/lib/background-options` (Task 1): `BACKGROUND_STYLES`, `BACKGROUND_LABELS` and the type `BackgroundStyle`
- Produces:
  - `BackgroundProvider(props: { initial: BackgroundStyle; onChange: (s: BackgroundStyle) => Promise<void>; children: React.ReactNode })`
  - `useBackground(): { style: BackgroundStyle; setStyle: (s: BackgroundStyle) => void }`, which throws outside the provider
  - `BackgroundPicker()`, with no props, reading the context

- [ ] **Step 1: Write the failing tests.** Mock `InteractiveBackground` so the tests don't need canvas: `vi.mock('@/components/interactive-background', () => ({ InteractiveBackground: ({ style }: { style: string }) => <div data-testid="bg" data-style={style} /> }))`.
  - **Provider:**
    - Renders children and `bg` with `data-style` equal to `initial`.
    - A test child calling `setStyle('pontos')` updates `data-style` immediately and calls `onChange('pontos')`.
    - When `onChange` rejects, `data-style` reverts to the previous confirmed value (use `waitFor`).
    - Two rapid calls (`pontos` then `nenhum`) with deferred promises call `onChange` in that order, one after the other: the second only after the first settles.
  - **Picker** (rendered inside the provider):
    - The trigger has the name "Fundo: Aurora".
    - Opening it shows menu items (role `menuitemradio`) "Aurora", "Grade de pontos" and "Nenhum", with "Aurora" checked (`aria-checked="true"`).
    - Clicking "Grade de pontos" sets `data-style="pontos"`, the trigger name becomes "Fundo: Grade de pontos", and `onChange` is called with `'pontos'`.
    - Escape closes the menu.

- [ ] **Step 2: Run the tests to verify they fail.**

- [ ] **Step 3: Implement.**
  - **Provider (client):**
    - **State:** `useState(initial)`, `confirmed = useRef(initial)`, a request counter, and `queue = useRef(Promise.resolve())`.
    - **`setStyle(next)`:** bumps the counter, sets the state to `next`, and chains `queue.current = queue.current.then(async () => { try { await onChange(next); confirmed.current = next } catch { if (id === counter.current) setState(confirmed.current) } })`.
    - **Render:** `<BackgroundContext value={{ style, setStyle }}><InteractiveBackground style={style} />{children}</BackgroundContext>`. Use the React 19 context-as-provider syntax, or `.Provider`.
  - **Picker (client):**
    - **Parts:** read the Base UI Menu `.d.ts` (`node_modules/@base-ui/react/menu`) for `RadioGroup`/`RadioItem`/`RadioItemIndicator`.
    - **Trigger:** Lucide `Sparkles` (`size-5`), with `aria-label={`Fundo: ${BACKGROUND_LABELS[style]}`}` and classes `rounded-md px-2 py-2 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none`.
    - **Radio group:** `value={style}` and `onValueChange={(v) => setStyle(v as BackgroundStyle)}`, rendering `BACKGROUND_STYLES.map` as radio items with a `Check` indicator.
    - **Popup:** the same styling as `ObjectiveActionsMenu` (popover tokens, `min-w-44`), aligned to the end.
    - **Closing:** choosing an item closes the menu, via the `closeOnClick` prop if needed.

- [ ] **Step 4: Run the tests to verify they pass,** then run lint.
- [ ] **Step 5: Commit.**

---

### Task 4: Wire into the layout and header, verify, merge

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/app-header.tsx`

- [ ] **Step 1: Update `layout.tsx`.** Add `import { BackgroundProvider } from "@/components/background-provider"`, `import { setBackground } from "@/lib/actions/background"` and `import { getBackground } from "@/lib/background"`. Then `const background = await getBackground()`. Wrap `<AppHeader … />`, the `#conteudo` div and `<BottomNav />` in `<BackgroundProvider initial={background} onChange={setBackground}>…</BackgroundProvider>`. The skip link stays first, outside it.
- [ ] **Step 2: Update `app-header.tsx`.** Render `<BackgroundPicker />` right before `<ThemeToggle …>`, wrapped in `<div className="flex items-center max-md:order-3">`. Keep the toggle's `max-md:order-3` too, so both sit at the end on mobile, picker before toggle.
- [ ] **Step 3: Run the full checks.** Run `npm test`, `npm run lint` and `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"`. Everything must be green.
- [ ] **Step 4: Commit.**
- [ ] **Step 5: Check in the browser** (controller, on the running dev server):
  - Aurora and Grade de pontos in both themes, on Hoje, Objetivos and the new objective form.
  - Switching in the header applies instantly and survives a reload.
  - Nenhum matches today.
  - Theme toggle recolors live.
  - Content stays clickable and legible.
  - No horizontal scroll at 375px.
- [ ] **Step 6: Final review, then merge into `develop` with `--no-ff`.** Use a detailed message. Do not push or touch `master` without the user.
