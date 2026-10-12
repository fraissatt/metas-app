# Guest Becomes an Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signing up from a guest session keeps the guest's objectives (with weekly goals and tasks) in the new account; signing in to an existing account discards them; the screens say so.

**Architecture:** Better Auth's `anonymous` plugin already calls `onLinkAccount` after a sign-up or sign-in that had an anonymous session, then deletes the guest. A new `moveGuestDataOnSignUp` hook re-owns the guest's objectives only for `/sign-up/email`. Banner and menu stop signing the guest out and link to `/cadastro`; the auth pages accept guests and show a note. No migration.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs` before Next code, per AGENTS.md), Better Auth 1.7 (anonymous plugin), Prisma 6, Base UI menu, Vitest and Testing Library with the real test database.

**Spec:** `docs/superpowers/specs/2026-10-12-visitante-vira-conta-design.md`

## Global Constraints

- Only `/sign-up/email` with a non-anonymous new user moves data; every other path moves nothing and the plugin's deletion discards the guest data.
- A failed sign-up must leave the guest's session and data intact.
- Texts (pt-BR, exact): banner "Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los."; `/cadastro` note "Seus dados de visitante vão para a nova conta."; `/entrar` note "Entrar numa conta existente descarta os dados de visitante."
- "Sair" for a guest keeps its confirmation dialog and wording ("Seus dados de visitante serão perdidos.").
- No schema change. Every change goes through issue #46 on branch `feature/46-visitante-vira-conta`; commits are detailed, mention `Refs #46` and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A sign-up that fails (e-mail already used, password too short) leaves the guest with their session and objectives: pinned by an end-to-end test.
- Signing in to an existing account from a guest cookie leaves that account's objectives exactly as they were and drops the guest's: pinned by an end-to-end test.
- Several objectives, with their goals and tasks, all move, and other users' data is untouched: pinned by the unit tests.
- A real (non-guest) account that opens `/cadastro` or `/entrar` is still sent to Hoje: pinned by the page tests.
- A guest on `/entrar` is not offered "Entrar como visitante" again (Better Auth refuses a second anonymous sign-in): pinned by a page test.
- "Criar conta" no longer signs the guest out or shows a "your data will be lost" dialog: pinned by banner and menu tests.

---

### Task 1: The data-moving hook, wired into Better Auth

**Files:**
- Create: `src/lib/guest/link.ts`
- Create: `src/lib/guest/link.test.ts`
- Create: `src/lib/auth-link.test.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `createTestUser` from `@/test/session-mock`.
- Produces: `moveGuestDataOnSignUp({ anonymousUser, newUser, ctx })` where `anonymousUser: { user: { id: string } }`, `newUser: { user: { id: string; isAnonymous?: boolean | null } }`, `ctx: { path?: string }`; returns `Promise<void>`. It is passed to `anonymous({ onLinkAccount })`.

- [ ] **Step 1: Write the failing unit tests**

`src/lib/guest/link.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { moveGuestDataOnSignUp } from '@/lib/guest/link'
import { createTestUser } from '@/test/session-mock'

async function guestWithData(id: string, objectives = 1) {
  const guest = await createTestUser(id, { isAnonymous: true })
  for (let i = 0; i < objectives; i++) {
    const objective = await prisma.objective.create({
      data: { userId: id, title: `Obj ${i}`, startDate: new Date('2026-10-05T03:00:00Z') },
    })
    const goal = await prisma.weeklyGoal.create({
      data: {
        title: `Meta ${i}`,
        objectiveId: objective.id,
        weekStart: new Date('2026-10-05T03:00:00Z'),
        weekEnd: new Date('2026-10-12T02:59:59.999Z'),
      },
    })
    await prisma.dailyTask.create({ data: { title: `Tarefa ${i}`, weeklyGoalId: goal.id, date: new Date('2026-10-06T03:00:00Z') } })
  }
  return guest
}

const args = (guestId: string, newUser: { id: string; isAnonymous?: boolean }, path: string) => ({
  anonymousUser: { user: { id: guestId } },
  newUser: { user: newUser },
  ctx: { path },
})

describe('moveGuestDataOnSignUp', () => {
  it('moves every objective, with its goals and tasks, to the new account on sign-up', async () => {
    await guestWithData('guest-1', 2)
    await createTestUser('new-1')

    await moveGuestDataOnSignUp(args('guest-1', { id: 'new-1' }, '/sign-up/email'))

    expect(await prisma.objective.count({ where: { userId: 'guest-1' } })).toBe(0)
    expect(await prisma.objective.count({ where: { userId: 'new-1' } })).toBe(2)
    expect(await prisma.weeklyGoal.count({ where: { objective: { userId: 'new-1' } } })).toBe(2)
    expect(await prisma.dailyTask.count({ where: { weeklyGoal: { objective: { userId: 'new-1' } } } })).toBe(2)
  })

  it('moves nothing when the guest signs in to an existing account', async () => {
    await guestWithData('guest-2')
    await createTestUser('existing-2')

    await moveGuestDataOnSignUp(args('guest-2', { id: 'existing-2' }, '/sign-in/email'))

    expect(await prisma.objective.count({ where: { userId: 'guest-2' } })).toBe(1)
    expect(await prisma.objective.count({ where: { userId: 'existing-2' } })).toBe(0)
  })

  it('moves nothing when the new user is itself a guest', async () => {
    await guestWithData('guest-3')
    await createTestUser('guest-3b', { isAnonymous: true })

    await moveGuestDataOnSignUp(args('guest-3', { id: 'guest-3b', isAnonymous: true }, '/sign-up/email'))

    expect(await prisma.objective.count({ where: { userId: 'guest-3' } })).toBe(1)
  })

  it("leaves other users' objectives alone", async () => {
    await guestWithData('guest-4')
    await createTestUser('other-4')
    await prisma.objective.create({ data: { userId: 'other-4', title: 'Alheio', startDate: new Date('2026-10-05T03:00:00Z') } })
    await createTestUser('new-4')

    await moveGuestDataOnSignUp(args('guest-4', { id: 'new-4' }, '/sign-up/email'))

    expect(await prisma.objective.count({ where: { userId: 'other-4' } })).toBe(1)
    expect(await prisma.objective.count({ where: { userId: 'new-4' } })).toBe(1)
  })
})
```

`src/lib/auth-link.test.ts` (end to end through the real `auth`):

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery'

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  )
}

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

async function signInAsGuest() {
  const response = await post('/sign-in/anonymous', {})
  expect(response.status).toBe(200)
  const { user } = (await response.json()) as { user: { id: string } }
  return { id: user.id, cookie: cookieOf(response) }
}

const objectiveFor = (userId: string, title: string) =>
  prisma.objective.create({ data: { userId, title, startDate: new Date('2026-10-05T03:00:00Z') } })

describe('guest becomes an account', () => {
  it('sign-up from a guest session keeps the guest objectives in the new account', async () => {
    const guest = await signInAsGuest()
    await objectiveFor(guest.id, 'Do visitante')

    const response = await post('/sign-up/email', { name: 'Ana', email: 'ana@example.com', password: PASSWORD }, guest.cookie)
    expect(response.status).toBe(200)
    const { user } = (await response.json()) as { user: { id: string } }

    const mine = await prisma.objective.findMany({ where: { userId: user.id } })
    expect(mine.map((o) => o.title)).toEqual(['Do visitante'])
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull()
  })

  it('a failed sign-up leaves the guest session and data intact', async () => {
    const guest = await signInAsGuest()
    await objectiveFor(guest.id, 'Do visitante')

    const response = await post('/sign-up/email', { name: 'Ana', email: 'ana@example.com', password: 'curta' }, guest.cookie)
    expect(response.status).toBeGreaterThanOrEqual(400)

    expect(await prisma.user.findUnique({ where: { id: guest.id } })).not.toBeNull()
    expect(await prisma.objective.count({ where: { userId: guest.id } })).toBe(1)
  })

  it("signing in to an existing account drops the guest data and keeps the account's own", async () => {
    const signUp = await post('/sign-up/email', { name: 'Bia', email: 'bia@example.com', password: PASSWORD })
    const { user: existing } = (await signUp.json()) as { user: { id: string } }
    await objectiveFor(existing.id, 'Da conta')

    const guest = await signInAsGuest()
    await objectiveFor(guest.id, 'Do visitante')

    const response = await post('/sign-in/email', { email: 'bia@example.com', password: PASSWORD }, guest.cookie)
    expect(response.status).toBe(200)

    const titles = (await prisma.objective.findMany({ where: { userId: existing.id } })).map((o) => o.title)
    expect(titles).toEqual(['Da conta'])
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toBeNull()
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/guest/link.test.ts src/lib/auth-link.test.ts`
Expected: FAIL (`link.ts` does not exist; the sign-up end-to-end test finds no objectives in the new account).

- [ ] **Step 3: Implement**

`src/lib/guest/link.ts`:

```ts
import { prisma } from '@/lib/db'

const SIGN_UP_PATH = '/sign-up/email'

type LinkArgs = {
  anonymousUser: { user: { id: string } }
  newUser: { user: { id: string; isAnonymous?: boolean | null } }
  ctx: { path?: string }
}

/**
 * Better Auth's anonymous plugin calls this after a sign-up or sign-in that
 * started from a guest session, and deletes the guest right afterwards. A new
 * account keeps what the guest built (objectives; goals and tasks follow them);
 * signing in to an existing account moves nothing, so that account is never
 * touched and the guest data is simply discarded.
 */
export async function moveGuestDataOnSignUp({ anonymousUser, newUser, ctx }: LinkArgs): Promise<void> {
  if (ctx.path !== SIGN_UP_PATH || newUser.user.isAnonymous) return
  await prisma.objective.updateMany({
    where: { userId: anonymousUser.user.id },
    data: { userId: newUser.user.id },
  })
}
```

In `src/lib/auth.ts`: add `import { moveGuestDataOnSignUp } from '@/lib/guest/link'` and change the plugin to

```ts
    anonymous({ generateName: () => 'Visitante', onLinkAccount: moveGuestDataOnSignUp }),
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/lib/guest/link.test.ts src/lib/auth-link.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors. If TypeScript rejects `moveGuestDataOnSignUp` as the plugin option, widen its parameter type to what the plugin passes (`ctx: { path: string }` is already a subtype) rather than casting.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guest/link.ts src/lib/guest/link.test.ts src/lib/auth-link.test.ts src/lib/auth.ts
git commit -m "feat: keep the guest's data when they sign up" -m "Refs #46. onLinkAccount re-owns the guest's objectives (goals and tasks follow) only for /sign-up/email with a non-guest new user; signing in to an existing account moves nothing and the guest is discarded. Unit tests on the real database plus end-to-end tests through auth.handler, including a failed sign-up. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banner and menu go straight to the sign-up page

**Files:**
- Modify: `src/components/guest-banner.tsx`, `src/components/guest-banner.test.tsx`
- Modify: `src/components/user-menu.tsx`, `src/components/user-menu.test.tsx`
- Modify: `src/components/app-header.tsx`, `src/components/app-header.test.tsx`
- Modify: `src/components/leave-guest-dialog.tsx`, `src/components/leave-guest-dialog.test.tsx`
- Modify: `src/lib/actions/auth.ts`, `src/lib/actions/auth.test.ts`

**Interfaces:**
- Consumes: Task 1 (behaviour only).
- Produces: `GuestBanner()` with no props, a link to `/cadastro`; `UserMenu` without the `onCreateAccount` prop, whose guest item "Criar conta" is a link to `/cadastro`; `LeaveGuestDialog` without `toSignUp`; no `leaveGuestToSignUp` action.

- [ ] **Step 1: Update the tests first**

Replace `src/components/guest-banner.test.tsx` with:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GuestBanner } from '@/components/guest-banner'

describe('GuestBanner', () => {
  it('explains the 24 h rule and offers to keep the data with an account', () => {
    render(<GuestBanner />)
    expect(
      screen.getByText('Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los.'),
    ).toBeInTheDocument()
  })

  it('goes straight to the sign-up page, without asking or signing out', () => {
    render(<GuestBanner />)
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

In `src/components/leave-guest-dialog.test.tsx` delete the last test ("mentions the sign-up page when leaving to create an account").

In `src/lib/actions/auth.test.ts` change the import to `const { signOut } = await import('@/lib/actions/auth')` and delete the `describe('leaveGuestToSignUp', ...)` block.

In `src/components/user-menu.test.tsx`: remove `onCreateAccount` from the `setup` parameters, its type, the returned object and the `<UserMenu>` props; delete the test "lets a guest create an account, after confirming"; and change "does not offer "Criar conta" to a real account" stays as is. Add:

```tsx
  it('offers a guest "Criar conta" as a link to the sign-up page, with no confirmation', async () => {
    setup({ user: guest })
    await open('Conta: Visitante')
    const item = await screen.findByRole('menuitem', { name: 'Criar conta' })
    expect(item).toHaveAttribute('href', '/cadastro')
    await userEvent.click(item)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
```

In `src/components/app-header.test.tsx` change the guest test to expect `screen.getByRole('link', { name: 'Criar conta' })`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/guest-banner.test.tsx src/components/user-menu.test.tsx src/components/app-header.test.tsx src/components/leave-guest-dialog.test.tsx src/lib/actions/auth.test.ts`
Expected: FAIL on the banner, header and menu link cases.

- [ ] **Step 3: Implement**

`src/components/guest-banner.tsx` becomes a plain server component:

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function GuestBanner() {
  return (
    <div role="status" className="border-b border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-8">
        <p className="flex-1">Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los.</p>
        <Link href="/cadastro" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Criar conta
        </Link>
      </div>
    </div>
  )
}
```

`src/components/user-menu.tsx`: remove the `onCreateAccount` prop (and its type), the `signUpOpen` state and the second `LeaveGuestDialog`; add `import Link from 'next/link'`; replace the guest "Criar conta" item with

```tsx
                <Menu.LinkItem className={itemClass} render={<Link href="/cadastro" />}>
                  Criar conta
                </Menu.LinkItem>
```

If `Menu.LinkItem` does not expose the `menuitem` role in the test, rule on the smallest fix that keeps a real link with that role (for example `<Menu.Item render={<Link href="/cadastro" />}>`) and ledger it.

`src/components/app-header.tsx`: change the import to `import { signOut } from '@/lib/actions/auth'`, drop `onCreateAccount={leaveGuestToSignUp}` from `UserMenu`, and render `<GuestBanner />`.

`src/components/leave-guest-dialog.tsx`: remove the `toSignUp` prop, its type and the conditional, leaving `<DialogDescription>Seus dados de visitante serão perdidos.</DialogDescription>`.

`src/lib/actions/auth.ts`: delete `leaveGuestToSignUp`. Leave `signOut` as it is.

- [ ] **Step 4: Run to see them pass, then typecheck and lint**

Run: `npx vitest run src/components/guest-banner.test.tsx src/components/user-menu.test.tsx src/components/app-header.test.tsx src/components/leave-guest-dialog.test.tsx src/lib/actions/auth.test.ts && npx tsc --noEmit && npx eslint src`
Expected: PASS, no errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components src/lib/actions/auth.ts src/lib/actions/auth.test.ts
git commit -m "feat: send a guest straight to the sign-up page from the banner and the menu" -m "Refs #46. Criar conta no longer signs the guest out or warns that their data will be lost; the banner and the menu item are plain links to /cadastro. The unused leaveGuestToSignUp action and the toSignUp mode of LeaveGuestDialog are gone; Sair keeps its confirmation. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The auth pages accept guests, with a note

**Files:**
- Modify: `src/app/cadastro/page.tsx`
- Modify: `src/app/entrar/page.tsx`
- Create: `src/app/cadastro/page.test.tsx`
- Create: `src/app/entrar/page.test.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (mocked by `src/test/setup.ts` through `actAs`).
- Produces: `/cadastro` and `/entrar` render for a guest with a note, still redirect a real account to `/`, and render unchanged without a session; `/entrar` hides "Entrar como visitante" for a guest.

- [ ] **Step 1: Write the failing tests**

`src/app/cadastro/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { actAs } from '@/test/session-mock'
import CadastroPage from '@/app/cadastro/page'

const NOTE = 'Seus dados de visitante vão para a nova conta.'
const guest = { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true }

describe('/cadastro', () => {
  it('shows the sign-up form with the data note to a guest', async () => {
    actAs(guest)
    render(await CadastroPage())
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it('shows the form without the note when there is no session', async () => {
    actAs(null)
    render(await CadastroPage())
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it('still sends a real account to Hoje', async () => {
    await expect(CadastroPage()).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') })
  })
})
```

`src/app/entrar/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { actAs } from '@/test/session-mock'

vi.mock('@/lib/actions/guest', () => ({ enterAsGuest: vi.fn() }))

import EntrarPage from '@/app/entrar/page'

const NOTE = 'Entrar numa conta existente descarta os dados de visitante.'
const guest = { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true }
const props = { searchParams: Promise.resolve({}) }

describe('/entrar', () => {
  it('shows the form and the discard note to a guest, without offering guest sign-in again', async () => {
    actAs(guest)
    render(await EntrarPage(props))
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar como visitante' })).toBeNull()
  })

  it('offers guest sign-in and no note when there is no session', async () => {
    actAs(null)
    render(await EntrarPage(props))
    expect(screen.getByRole('button', { name: 'Entrar como visitante' })).toBeInTheDocument()
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it('still sends a real account to Hoje', async () => {
    await expect(EntrarPage(props)).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') })
  })
})
```

The last test of each file relies on the default signed-in test user from `src/test/setup.ts`.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/app/cadastro/page.test.tsx src/app/entrar/page.test.tsx`
Expected: FAIL (guest is redirected today).

- [ ] **Step 3: Implement**

`src/app/cadastro/page.tsx`: replace the first line of the component with

```tsx
  const user = await getCurrentUser()
  if (user && !user.isAnonymous) redirect('/')
```

and render, between the `h1` and the form:

```tsx
      {user?.isAnonymous && (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          Seus dados de visitante vão para a nova conta.
        </p>
      )}
```

`src/app/entrar/page.tsx`: replace `if (await getCurrentUser()) redirect('/')` with

```tsx
  const user = await getCurrentUser()
  if (user && !user.isAnonymous) redirect('/')
```

render `<GuestButton onEnter={enterAsGuest} />` only when `!user`, and, in its place for a guest:

```tsx
      {user?.isAnonymous && (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          Entrar numa conta existente descarta os dados de visitante.
        </p>
      )}
```

- [ ] **Step 4: Run to see them pass, then typecheck and lint**

Run: `npx vitest run src/app/cadastro/page.test.tsx src/app/entrar/page.test.tsx && npx tsc --noEmit && npx eslint src`
Expected: PASS, no errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/cadastro src/app/entrar
git commit -m "feat: let a guest open the sign-up and sign-in pages, with a note" -m "Refs #46. Only a real account is redirected to Hoje now. A guest on /cadastro is told their data goes to the new account; on /entrar they are told signing in to an existing account discards it, and guest sign-in is not offered again. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verify in the browser, document, and open the PR

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the running app from Tasks 1 to 3.
- Produces: the README change.

- [ ] **Step 1: Run the full suite and the zone runner**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: everything passes.

- [ ] **Step 2: Check it in the browser**

Start the `dev` preview (`preview_start` with name `dev`; never run `next build` while it runs). Signed out, enter as a guest from `/`, and note one of the demo objectives. Click "Criar conta" in the banner: confirm there is no dialog, you land on `/cadastro` with the note, and you are still a guest. Sign up with test values for this local app (a made-up e-mail on example.com and a password you generate; do not paste the password into chat or files); confirm you land on Hoje with the same objectives and that the menu shows your name and e-mail. Then repeat from a fresh guest and pick "Entrar" with an existing test account to confirm the note on `/entrar`, that the demo data is gone and that the account kept its own objectives. Check the phone width on `/cadastro`. Stop the preview and reset the viewport when done.

- [ ] **Step 3: Update the README**

In the "Funcionalidades" bullet "Contas e modo visitante", append a sentence so it ends:

```md
  gerados na hora; cada pessoa só vê os próprios dados. O visitante pode criar uma conta e levar o que
  montou; entrar numa conta que já existe descarta os dados de visitante.
```

- [ ] **Step 4: Commit, push and open the PR**

```bash
git add README.md
git commit -m "docs: say that a guest can keep their data by creating an account" -m "Refs #46. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/46-visitante-vira-conta
```

Open the PR into `develop` with the attribution block first, `Closes #46`, the Antes/Depois/Como foi feito/Como foi testado sections and the Claude Code footer; assign and request review from `fraissatt`; move the cards to "Em revisão"; wait for CI with `gh pr checks <n> --watch`; ask the user to merge. After the merge, close #46 by hand, sync `develop`, then follow the release routine (version bump PR to 1.4.0, release PR `develop` to `master`, tag and GitHub Release `v1.4.0`).
