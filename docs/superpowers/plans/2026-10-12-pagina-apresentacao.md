# Public Presentation Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a colourful presentation page at `/` to visitors without a session, while signed-in users keep seeing Hoje.

**Architecture:** `/` becomes a public path in the proxy. The root page reads the session: `null` renders a static `Landing` server component (hero, three actions, six `LandingCard`s, footer); otherwise the existing Hoje code runs unchanged. The guest button gains a plain variant. Card hover and entrance are plain CSS behind hover and reduced-motion media queries.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs` before Next code, per AGENTS.md), React 19, Tailwind 4, lucide-react icons, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-pagina-apresentacao-design.md`

## Global Constraints

- Copy is pt-BR, sentence case, no terminal punctuation on labels, no claims the app cannot back up.
- Title "Metas"; subtitle "Do objetivo à tarefa do dia, sem se perder no meio do caminho."
- Actions: "Entrar como visitante" (highlighted), "Criar conta" (link `/cadastro`), "Já tenho conta" (link `/entrar`); guest note "Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso."
- Six cards, in this order and colours: Objetivos (green), Metas semanais (blue), Tarefas diárias (amber), Modo visitante (violet), Quiz de plano (pink), App instalável (cyan).
- Hover: card rises 4 px, border and soft glow take the card colour, icon grows slightly; only where a pointer can hover and motion is allowed. Entrance fade-up in sequence, off under `prefers-reduced-motion`.
- Cards are not links or buttons. One `h1`; card titles are headings inside a list.
- No new data, tables or server actions. Hoje code is not moved.
- Every change goes through issue #34 on branch `feature/34-pagina-apresentacao`; commits are detailed, end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, and mention `Refs #34`.

## Review Focus

- A request to `/` with no session (including an expired cookie) shows the presentation page, not a redirect: pinned by the root page test with `actAs(null)`.
- A signed-in user at `/` still gets Hoje (here: the redirect to the quiz when there is no objective): pinned by the root page test.
- A throttled or failing guest sign-in on the presentation page shows the same messages as on `/entrar`: pinned by a `GuestButton` plain-variant test.
- Reduced-motion and touch users get no hover or entrance animation: pinned by a test that reads `globals.css` for the media-query guard, and checked in the browser.
- `/funil`, `/entrar`, `/cadastro` stay public and every other path still redirects without a cookie: pinned by the proxy and `isPublicPath` tests.
- No horizontal scroll at phone width and readable contrast in both themes: checked in the browser.

---

### Task 1: Make `/` a public path

**Files:**
- Modify: `src/lib/public-routes.ts`
- Modify: `src/lib/public-routes.test.ts`
- Modify: `src/proxy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPublicPath('/', anything)` returns `true`; everything else is unchanged.

- [ ] **Step 1: Update the tests first**

In `src/lib/public-routes.test.ts`, replace the "protects app pages" test and add one for the root:

```ts
  it('opens the presentation page at the root', () => {
    expect(isPublicPath('/', false)).toBe(true)
    expect(isPublicPath('/', true)).toBe(true)
  })

  it('protects app pages', () => {
    for (const path of ['/objectives', '/objectives/abc', '/quiz', '/week']) {
      expect(isPublicPath(path, true)).toBe(false)
    }
  })
```

In `src/proxy.test.ts`, in "sends a visitor without a session cookie to /entrar" remove `'/'` from the path list (it becomes `['/objectives', '/objectives/abc/weeks/xyz', '/quiz']`), change "ignores other cookies" to use `/objectives`, and add:

```ts
  it('lets the presentation page at / through without a cookie', () => {
    expect(passesThrough(proxy(request('/')))).toBe(true)
  })
```

The "also accepts the __Secure- cookie" and "lets a request with the session cookie through" tests keep using `/objectives` and `/` respectively; leave them.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/public-routes.test.ts src/proxy.test.ts`
Expected: FAIL on the two new root assertions.

- [ ] **Step 3: Implement**

In `src/lib/public-routes.ts`, add as the first line of `isPublicPath`:

```ts
  if (pathname === '/') return true
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/lib/public-routes.test.ts src/proxy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/public-routes.ts src/lib/public-routes.test.ts src/proxy.test.ts
git commit -m "feat: make / a public path for the presentation page" -m "Refs #34. The proxy lets / through without a session cookie; every other app path still redirects to /entrar. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Plain variant of the guest button

**Files:**
- Modify: `src/components/guest-button.tsx`
- Modify: `src/components/guest-button.test.tsx`

**Interfaces:**
- Consumes: the existing `GuestButton({ onEnter })`.
- Produces: `GuestButton({ onEnter, variant?: 'card' | 'plain' })`. `'card'` (default) is today's bordered box with the demo note. `'plain'` renders only a large primary button plus the shared error line, with no box and no note.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/guest-button.test.tsx`, inside the `describe`:

```tsx
  it('plain variant: no demo note, still calls onEnter and shows the throttle message', async () => {
    const onEnter = vi.fn().mockResolvedValue({ throttled: true })
    render(<GuestButton variant="plain" onEnter={onEnter} />)
    expect(screen.queryByText('Conta de demonstração com dados prontos')).toBeNull()
    const button = screen.getByRole('button', { name: 'Entrar como visitante' })
    await userEvent.click(button)
    expect(onEnter).toHaveBeenCalledOnce()
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Tente de novo em alguns minutos.')
    expect(button).toBeEnabled()
  })

  it('plain variant: shows the generic error when onEnter rejects', async () => {
    const onEnter = vi.fn().mockRejectedValue(new Error('boom'))
    render(<GuestButton variant="plain" onEnter={onEnter} />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar como visitante' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir. Tente de novo.')
  })
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/guest-button.test.tsx`
Expected: FAIL (the note is still rendered / TypeScript prop error).

- [ ] **Step 3: Implement**

In `src/components/guest-button.tsx`:

1. Change the signature to
```tsx
export function GuestButton({
  onEnter,
  variant = 'card',
}: {
  onEnter: () => Promise<{ throttled: true } | void>
  variant?: 'card' | 'plain'
}) {
```
2. Add `import { cn } from '@/lib/utils'` and make the wrapper
```tsx
    <div
      className={cn(
        'flex flex-col gap-2',
        variant === 'card' ? 'rounded-lg border border-border bg-card p-4' : 'items-start',
      )}
    >
```
3. On the `Button`, set `variant={variant === 'card' ? 'secondary' : 'default'}` and `size={variant === 'card' ? 'default' : 'lg'}`.
4. Render the note only for the card: `{variant === 'card' && <p className="text-xs text-muted-foreground">Conta de demonstração com dados prontos</p>}`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/components/guest-button.test.tsx`
Expected: PASS (existing and new cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/guest-button.tsx src/components/guest-button.test.tsx
git commit -m "feat: add a plain variant to the guest button" -m "Refs #34. The presentation page needs the same guest sign-in without the bordered box and note used on /entrar. Default behaviour is unchanged. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Landing card and its styles

**Files:**
- Create: `src/components/landing-card.tsx`
- Create: `src/components/landing-card.test.tsx`
- Create: `src/app/globals.landing.test.ts`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: lucide-react icons.
- Produces: `LandingColor = 'green' | 'blue' | 'amber' | 'violet' | 'pink' | 'cyan'` and `LandingCard({ icon, title, text, color, index }: { icon: LucideIcon; title: string; text: string; color: LandingColor; index: number })`, which renders an `<li>`.

- [ ] **Step 1: Write the failing tests**

`src/components/landing-card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Target } from 'lucide-react'
import { LandingCard } from '@/components/landing-card'

describe('LandingCard', () => {
  it('renders the title as a heading and the line of text, inside a list item', () => {
    render(
      <ul>
        <LandingCard icon={Target} title="Objetivos" text="O destino, com prazo e progresso" color="green" index={0} />
      </ul>,
    )
    expect(screen.getByRole('listitem')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Objetivos' })).toBeInTheDocument()
    expect(screen.getByText('O destino, com prazo e progresso')).toBeInTheDocument()
  })

  it('is not interactive and hides the decorative icon from assistive tech', () => {
    const { container } = render(
      <ul>
        <LandingCard icon={Target} title="Objetivos" text="O destino" color="blue" index={2} />
      </ul>,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('carries its colour and entrance order as CSS variables', () => {
    render(
      <ul>
        <LandingCard icon={Target} title="Objetivos" text="O destino" color="pink" index={3} />
      </ul>,
    )
    const item = screen.getByRole('listitem')
    expect(item.style.getPropertyValue('--card-color')).toBe('var(--lp-pink)')
    expect(item.style.getPropertyValue('--i')).toBe('3')
  })
})
```

`src/app/globals.landing.test.ts` (pins the motion guards):

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('landing card styles', () => {
  it('only lifts the card where a pointer can hover and motion is allowed', () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)\s*{[^}]*\.landing-card:hover/s)
  })

  it('turns the entrance animation off for reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.landing-card\s*{\s*animation: none/s)
  })

  it('defines the six colours for both themes', () => {
    for (const name of ['green', 'blue', 'amber', 'violet', 'pink', 'cyan']) {
      expect(css.match(new RegExp(`--lp-${name}:`, 'g'))?.length, name).toBe(2)
    }
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/landing-card.test.tsx src/app/globals.landing.test.ts`
Expected: FAIL (module and CSS missing).

- [ ] **Step 3: Implement the component**

`src/components/landing-card.tsx`:

```tsx
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

export type LandingColor = 'green' | 'blue' | 'amber' | 'violet' | 'pink' | 'cyan'

export function LandingCard({
  icon: Icon,
  title,
  text,
  color,
  index,
}: {
  icon: LucideIcon
  title: string
  text: string
  color: LandingColor
  index: number
}) {
  return (
    <li
      className="landing-card rounded-xl border border-border bg-card p-4"
      style={{ '--card-color': `var(--lp-${color})`, '--i': index } as CSSProperties}
    >
      <span
        className="landing-card-icon mb-3 flex size-9 items-center justify-center rounded-lg"
        style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 16%, transparent)' }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </li>
  )
}
```

- [ ] **Step 4: Append the styles to `src/app/globals.css`**

```css

/* Presentation page: one accent per card. Light values are darker so the icon
   and border keep their contrast on a white card; dark values are the neon ones. */
:root {
  --lp-green: #15803d;
  --lp-blue: #2563eb;
  --lp-amber: #b45309;
  --lp-violet: #7c3aed;
  --lp-pink: #be185d;
  --lp-cyan: #0e7490;
}
.dark {
  --lp-green: #39ff14;
  --lp-blue: #4f9dff;
  --lp-amber: #ffb020;
  --lp-violet: #b78cff;
  --lp-pink: #ff6fae;
  --lp-cyan: #2fd4d4;
}

@keyframes landing-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.landing-card {
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
  animation: landing-in 500ms ease both;
  animation-delay: calc(var(--i, 0) * 70ms);
}
.landing-card-icon {
  transition: transform 180ms ease;
}

@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .landing-card:hover {
    transform: translateY(-4px);
    border-color: var(--card-color);
    box-shadow: 0 8px 28px color-mix(in oklab, var(--card-color) 28%, transparent);
  }
  .landing-card:hover .landing-card-icon {
    transform: scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-card {
    animation: none;
  }
}
```

- [ ] **Step 5: Run to see them pass**

Run: `npx vitest run src/components/landing-card.test.tsx src/app/globals.landing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing-card.tsx src/components/landing-card.test.tsx src/app/globals.landing.test.ts src/app/globals.css
git commit -m "feat: add the presentation card and its hover styles" -m "Refs #34. LandingCard with per-card colour tokens for both themes, hover lift and glow only where a pointer can hover and motion is allowed, and a staggered entrance that is off under prefers-reduced-motion. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Landing component and the root page

**Files:**
- Create: `src/components/landing.tsx`
- Create: `src/components/landing.test.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `LandingCard`, `LandingColor` (Task 3), `GuestButton` with `variant="plain"` (Task 2), `isPublicPath('/')` (Task 1), `getCurrentUser` from `@/lib/session`, `enterAsGuest` from `@/lib/actions/guest`.
- Produces: `Landing({ onEnterAsGuest }: { onEnterAsGuest: () => Promise<{ throttled: true } | void> })`; the root page's `generateMetadata()` and default export `Home()`.

- [ ] **Step 1: Read the Next docs for metadata**

Run: `ls node_modules/next/dist/docs` and open the guide on `generateMetadata` before writing the page change; confirm that an async `generateMetadata` exported from a page replaces a static `metadata` export and that `title.absolute` still skips the layout template.

- [ ] **Step 2: Write the failing Landing tests**

`src/components/landing.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Landing } from '@/components/landing'

const setup = () => render(<Landing onEnterAsGuest={vi.fn()} />)

describe('Landing', () => {
  it('shows the title, the subtitle and one h1', () => {
    setup()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument()
    expect(screen.getByText('Do objetivo à tarefa do dia, sem se perder no meio do caminho.')).toBeInTheDocument()
  })

  it('offers the three ways in', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Entrar como visitante' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/entrar')
    expect(
      screen.getByText('Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso.'),
    ).toBeInTheDocument()
  })

  it('lists the six cards in order, none of them interactive', () => {
    setup()
    const list = screen.getByRole('list', { name: 'O que o Metas oferece' })
    const titles = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent)
    expect(titles).toEqual([
      'Objetivos',
      'Metas semanais',
      'Tarefas diárias',
      'Modo visitante',
      'Quiz de plano',
      'App instalável',
    ])
    expect(within(list).queryAllByRole('link')).toHaveLength(0)
    expect(within(list).queryAllByRole('button')).toHaveLength(0)
  })

  it('has a footer with the source link and the rights notice', () => {
    setup()
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Código no GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/fraissatt/metas-app',
    )
    expect(within(footer).getByText('Todos os direitos reservados')).toBeInTheDocument()
  })
})
```

`src/app/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { actAs } from '@/test/session-mock'
import Home, { generateMetadata } from '@/app/page'

describe('root page', () => {
  it('shows the presentation page when there is no session', async () => {
    actAs(null)
    render(await Home())
    expect(screen.getByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar como visitante' })).toBeInTheDocument()
  })

  it('keeps showing Hoje to a signed-in user (no objective yet sends them to the quiz)', async () => {
    await expect(Home()).rejects.toMatchObject({ digest: expect.stringContaining('/quiz') })
  })

  it('titles the page for the presentation or for Hoje', async () => {
    actAs(null)
    expect(await generateMetadata()).toMatchObject({ title: { absolute: 'Metas · Do objetivo à tarefa do dia' } })
    actAs({ id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false })
    expect(await generateMetadata()).toMatchObject({ title: { absolute: 'Hoje · Metas' } })
  })
})
```

The signed-in test relies on the default `beforeEach` in `src/test/setup.ts`, which calls `actAs(await createTestUser(TEST_USER_ID))`.

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run src/components/landing.test.tsx src/app/page.test.tsx`
Expected: FAIL (module and exports missing).

- [ ] **Step 4: Implement `Landing`**

`src/components/landing.tsx`:

```tsx
import Link from 'next/link'
import { CalendarDays, ListChecks, Route, Smartphone, Target, User } from 'lucide-react'
import { GuestButton } from '@/components/guest-button'
import { LandingCard, type LandingColor } from '@/components/landing-card'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

const CARDS: { icon: LucideIcon; title: string; text: string; color: LandingColor }[] = [
  { icon: Target, title: 'Objetivos', text: 'O destino, com prazo e progresso', color: 'green' },
  { icon: CalendarDays, title: 'Metas semanais', text: 'O que fazer em cada semana', color: 'blue' },
  { icon: ListChecks, title: 'Tarefas diárias', text: 'O passo de hoje, na tela Hoje', color: 'amber' },
  { icon: User, title: 'Modo visitante', text: 'Teste com dados prontos', color: 'violet' },
  { icon: Route, title: 'Quiz de plano', text: 'Responda e receba um plano', color: 'pink' },
  { icon: Smartphone, title: 'App instalável', text: 'PWA em tela cheia', color: 'cyan' },
]

export function Landing({ onEnterAsGuest }: { onEnterAsGuest: () => Promise<{ throttled: true } | void> }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:px-8 md:py-16">
      <section className="flex flex-col items-start gap-5">
        <h1 className="text-4xl font-bold text-accent-foreground md:text-5xl">Metas</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Do objetivo à tarefa do dia, sem se perder no meio do caminho.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <GuestButton variant="plain" onEnter={onEnterAsGuest} />
          <Button nativeButton={false} variant="outline" size="lg" render={<Link href="/cadastro" />}>
            Criar conta
          </Button>
          <Link
            href="/entrar"
            className="self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Já tenho conta
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso.
        </p>
      </section>

      <section>
        <h2 className="sr-only">O que o Metas oferece</h2>
        <ul aria-label="O que o Metas oferece" className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((card, index) => (
            <LandingCard key={card.title} {...card} index={index} />
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <a
          href="https://github.com/fraissatt/metas-app"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Código no GitHub
        </a>
        <span>Todos os direitos reservados</span>
      </footer>
    </main>
  )
}
```

- [ ] **Step 5: Change the root page**

In `src/app/page.tsx`:

1. Add imports: `import { getCurrentUser } from '@/lib/session'`, `import { enterAsGuest } from '@/lib/actions/guest'`, `import { Landing } from '@/components/landing'`.
2. Replace the static `export const metadata ...` line (and keep its comment about the layout title template, reworded to say the title depends on the session) with:

```ts
// The layout's title template skips pages in its own segment, so spell it out.
export async function generateMetadata(): Promise<Metadata> {
  if (await getCurrentUser()) return { title: { absolute: 'Hoje · Metas' } }
  return {
    title: { absolute: 'Metas · Do objetivo à tarefa do dia' },
    description: 'Objetivos, metas semanais e tarefas diárias em um só lugar. Entre como visitante e teste agora.',
  }
}
```

3. As the first line inside `export default async function Home()`, before `const goals = ...`:

```ts
  // Signed-out visitors (and expired cookies) get the presentation page.
  if (!(await getCurrentUser())) return <Landing onEnterAsGuest={enterAsGuest} />

```

- [ ] **Step 6: Run to see them pass**

Run: `npx vitest run src/components/landing.test.tsx src/app/page.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors, no warnings.

```bash
git add src/components/landing.tsx src/components/landing.test.tsx src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: show a presentation page at / to visitors without a session" -m "Refs #34. Landing server component with the hero, the three actions, six colourful cards and a footer; the root page renders it when there is no session and keeps Hoje otherwise. The page title depends on the session. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verify in the browser, document, and open the PR

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/apresentacao.jpg`

**Interfaces:**
- Consumes: the running page from Task 4.
- Produces: README entries and the screenshot.

- [ ] **Step 1: Run the full suite and the zone runner**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: everything passes. Then `node scripts/test-both-tz.mjs src/lib src/components` for the three zones; expected all passing.

- [ ] **Step 2: Check the page in the browser**

Start the `dev` preview (`preview_start` with name `dev`; never run `next build` while it runs). Signed out, open `http://localhost:3000/` and check, with screenshots: dark theme at desktop width, light theme at desktop width, phone width (375 px, no horizontal scroll, cards in one column). Hover a card in the desktop view and confirm the lift, the coloured border and glow, and the icon growing. Click "Entrar como visitante" and confirm it lands on Hoje. Confirm a signed-in visit to `/` still shows Hoje, and that `/objectives` signed out still redirects to `/entrar`. Reset the viewport and stop the preview when done.

- [ ] **Step 3: Add the screenshot**

Copy the desktop dark-theme screenshot file that the browser tool saved (its path is printed with the screenshot) to `docs/screenshots/apresentacao.jpg`.

- [ ] **Step 4: Update the README**

In the "Funcionalidades" list add, as the first bullet:

```md
- **Página de apresentação:** quem abre o site sem sessão vê, na raiz, uma página com seis cards (objetivos,
  metas semanais, tarefas diárias, modo visitante, quiz e app instalável) e três formas de entrar. Quem já
  está logado continua indo direto para o Hoje.
```

In "Capturas de tela", add before "### Objetivos":

```md
### Página de apresentação

![Página de apresentação com seis cards coloridos e os botões de entrada](docs/screenshots/apresentacao.jpg)
```

- [ ] **Step 5: Commit, push and open the PR**

```bash
git add README.md docs/screenshots/apresentacao.jpg
git commit -m "docs: document the presentation page in the README" -m "Refs #34. Adds the feature bullet and a screenshot. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/34-pagina-apresentacao
```

Open the PR into `develop` with the attribution block first, `Closes #34`, the Antes/Depois/Como foi feito/Como foi testado sections and the Claude Code footer; assign and request review from `fraissatt`; move the cards to "Em revisão"; wait for CI with `gh pr checks <n> --watch`; ask the user to merge. After the merge, close #34 by hand, sync `develop`, then follow the release routine (version bump PR to 1.2.0, release PR `develop` → `master`, tag and GitHub Release `v1.2.0`).
