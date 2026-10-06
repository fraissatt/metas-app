# User Accounts and Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add e-mail/password accounts and per-guest demo accounts so that every user sees and edits only their own objectives, weekly goals and tasks.

**Architecture:**
- **Auth library:** Better Auth (Prisma adapter, anonymous plugin, `nextCookies`) owns users, sessions and password hashes.
- **Ownership:** `Objective.userId` is the single ownership column; goals and tasks inherit it through their relations.
- **Scoping:** every data function resolves the user with `requireUser()` (from `src/lib/session.ts`) and scopes its Prisma query by owner.
- **Routing:** `src/proxy.ts` does an optimistic cookie redirect to `/entrar`. Real authorization stays in `requireUser()`.
- **Guests:** anonymous Better Auth users seeded by a pure demo-data generator. Cleanup runs lazily whenever a new guest is created.

**Tech Stack:** Next.js 16.2 App Router (Proxy, Server Actions), React 19, Better Auth 1.7.x, Prisma 6 + Postgres, Vitest + Testing Library (real test DB), Base UI, Tailwind 4, date-fns.

**Spec:** `docs/superpowers/specs/2026-10-05-usuarios-login-design.md`

## Global Constraints

- **Next.js docs:** read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md). Middleware is called **Proxy** in Next 16 (`src/proxy.ts`, exported function `proxy`).
- **Server Action modules** (`'use server'`) export only async functions. Sync helpers and constants live in plain modules.
- **Client components** receive Server Actions as props and import only types from server modules.
- **Colors:** only theme tokens. No hex literals in non-test `src` files (`theme-contrast.test.ts` enforces this). Small primary-colored text uses `text-accent-foreground`.
- **Password:** minimum 8 characters.
- **Guest lifetime and cap:** a guest idle for more than **24 h** is deleted, and at most **200** guests are active.
- **`/funil`:** public only while `FUNNEL_PUBLIC === "true"`.
- **Copy (pt-BR, exact):**
  - "E-mail ou senha incorretos"
  - "Esse e-mail já tem conta"
  - "Muitas tentativas. Tente de novo em alguns minutos."
  - "Não foi possível concluir. Tente de novo."
  - "Entrar como visitante"
  - "Conta de demonstração com dados prontos"
  - "Sua sessão de visitante expirou"
  - "Você está como visitante. Os dados somem após 24 h sem uso."
  - "Criar conta"
  - "Sair"
  - "Visitante"
- **Tests:** they run against the real Postgres test DB, sequentially. There is no Prisma mocking for data tests.
- **Processes:** never kill processes (no `taskkill`, no `kill`). If `prisma generate` fails with EPERM because the user's dev server holds the engine file, stop and report it to the controller.
- **Builds:** do not run `next build` in the repo while a dev server may be running.
- **Commits:** detailed messages that say what was impacted, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Write each message to a file and use `git commit -F <file>`; `-F -` fails on this Windows setup.
- **Branch:** `feature/usuarios-login`.

## Review Focus

1. **A user tries to reach another user's records by id** (URL of someone else's objective or week; a Server Action called with a foreign id). Expected: "não encontrado" or a not-found error, with nothing changed. Pinned in Tasks 2, 3 and 4.
2. **Recurring goals and the "repeat last week" card mix users.** User A's recurring goal must never be cloned into user B's week, and A's planned week must not hide B's. Pinned in Task 3.
3. **A guest comes back after cleanup deleted their account.** Expected: they land on `/entrar?expirado=1` instead of seeing an error page. Pinned in Task 1 (`requireUser`).
4. **Cleanup must never delete real accounts**, even idle ones, and must delete the guest's objectives, goals and tasks with them. Pinned in Task 9.
5. **Logged-out header and pages.** `/entrar`, `/cadastro` and public `/funil` must render without a user: no summary, search or bottom nav, and no crash. Pinned in Task 10.

---

## File Structure

- **Auth core:**
  - `src/lib/auth.ts`: Better Auth server config.
  - `src/lib/auth-client.ts`: browser client, used by the login and sign-up forms.
  - `src/lib/session.ts`: `getCurrentUser()` and `requireUser()`.
  - `src/app/api/auth/[...all]/route.ts`: the Better Auth handler.
- **Ownership:** `src/lib/owned.ts`, owner-checked lookups shared by the data modules.
- **Routing:** `src/proxy.ts` (optimistic redirect) and `src/lib/public-routes.ts` (the pure rule, unit tested).
- **Auth UI:**
  - `src/lib/auth-errors.ts`: maps auth errors to pt-BR copy.
  - `src/components/auth-form.tsx`: shared login/sign-up form.
  - `src/components/guest-button.tsx`.
  - `src/app/entrar/page.tsx`, `src/app/cadastro/page.tsx`.
- **Guests:**
  - `src/lib/guest/demo-data.ts`: pure generator.
  - `src/lib/guest/seed.ts`: writes the demo data.
  - `src/lib/guest/cleanup.ts`.
  - `src/lib/actions/guest.ts`: the `enterAsGuest` Server Action.
- **Shell:**
  - `src/lib/actions/auth.ts`: the `signOut` Server Action.
  - `src/components/user-menu.tsx`, `src/components/guest-banner.tsx`.
  - Changes to `app-header.tsx`, `bottom-nav` usage and `layout.tsx`.
- **Test infrastructure:** `src/test/session-mock.ts`, plus changes to `src/test/setup.ts`.

---

### Task 1: Auth foundation (schema, Better Auth, session helpers, test infra)

This task must land as one unit. Making `Objective.userId` required breaks every objective create, so the session helper, the test infrastructure and the two create paths (`createObjective`, `createPlanFromQuiz`) change together to keep the suite green.

**Files:**
- Modify: `package.json`, `prisma/schema.prisma`, `.env.example`, `src/test/setup.ts`, `src/lib/actions/objectives.ts` (create only), `src/lib/actions/quiz.ts` (create only), every test file that calls `prisma.objective.create(...)`
- Create: `prisma/migrations/<timestamp>_usuarios_login/migration.sql`, `src/lib/auth.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/session.ts`, `src/test/session-mock.ts`
- Test: `src/lib/session.test.ts`, `src/lib/db.test.ts` (extend)

**Interfaces:**
- Produces:
  - `auth` (Better Auth instance) from `@/lib/auth`.
  - `type CurrentUser = { id: string; name: string; email: string; isAnonymous: boolean }`.
  - `getCurrentUser(): Promise<CurrentUser | null>` (React `cache`d per request).
  - `requireUser(): Promise<CurrentUser>`, which redirects to `/entrar` or `/entrar?expirado=1`.
  - From `@/test/session-mock`: `TEST_USER_ID = 'test-user'`, `actAs(user: CurrentUser | null)`, `createTestUser(id: string, overrides?) => Promise<CurrentUser>`. Tests use these to switch the current user.

- [ ] **Step 1: Install Better Auth**

Run: `npm install better-auth@^1.7.7`
Expected: added to `dependencies`. Check that `node_modules/better-auth/package.json` exports `./adapters/prisma`, `./plugins`, `./next-js`, `./cookies` and `./react` (or `./client/plugins`). If the Prisma adapter is a separate package in this version (`@better-auth/prisma-adapter`), install it too and use that import path instead of `better-auth/adapters/prisma` below.

- [ ] **Step 2: Add the auth models and ownership to `prisma/schema.prisma`**

Add the models below. Then run `npx auth@latest generate --config src/lib/auth.ts --output scratch-schema.prisma` after Step 4, in a scratch path outside the repo, and **diff against these models**. If the generator expects different field names or types for this Better Auth version, follow the generator and keep `lastSeenAt`, `isAnonymous` and the cascades.

```prisma
model User {
  id            String      @id
  name          String
  email         String      @unique
  emailVerified Boolean     @default(false)
  image         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  isAnonymous   Boolean     @default(false)
  lastSeenAt    DateTime    @default(now())
  sessions      Session[]
  accounts      Account[]
  objectives    Objective[]

  @@index([isAnonymous, lastSeenAt])
  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}
```

In `model Objective`, add:

```prisma
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
```

- [ ] **Step 3: Create the migration and make it delete existing data first**

Run: `npx prisma migrate dev --create-only --name usuarios_login`

Open the generated `migration.sql`. **Before** the statement `ALTER TABLE "Objective" ADD COLUMN "userId" TEXT NOT NULL`, insert:

```sql
-- Spec decision: data created before accounts existed has no owner and is
-- discarded. Funnel events are anonymous and are kept.
DELETE FROM "DailyTask";
DELETE FROM "WeeklyGoal";
DELETE FROM "Objective";
```

Then run `npx prisma migrate dev`. It applies the migration to the local dev DB, which deletes local objectives, and regenerates the client. Then run `npm run test:migrate`.
Expected: both succeed. If `prisma generate` fails with EPERM, stop and report it (see Global Constraints).

- [ ] **Step 4: Better Auth server config `src/lib/auth.ts`**

```ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { anonymous } from 'better-auth/plugins'
import { prisma } from '@/lib/db'

export const PASSWORD_MIN_LENGTH = 8

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // Server-owned: bumped by getCurrentUser for guests, read by cleanup.
      lastSeenAt: { type: 'date', required: false, input: false, defaultValue: () => new Date() },
    },
  },
  rateLimit: { enabled: process.env.NODE_ENV === 'production' },
  plugins: [
    anonymous({ generateName: () => 'Visitante' }),
    // Must stay last: lets Server Actions set the session cookie.
    nextCookies(),
  ],
})
```

Add `src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export const { GET, POST } = toNextJsHandler(auth)
```

Add to `.env.example`:

```bash
# Long random string, e.g. `openssl rand -base64 32`
BETTER_AUTH_SECRET="troque-por-um-segredo-longo"
BETTER_AUTH_URL="http://localhost:3000"
# "true" keeps /funil public; anything else requires login
FUNNEL_PUBLIC="true"
```

Add the same three keys to the local `.env` and `.env.test`. Both are gitignored; use any 32+ character string as the secret.

- [ ] **Step 5: Write the failing session helper tests `src/lib/session.test.ts`**

`setup.ts` (Step 7) mocks `@/lib/session` globally, so this file unmocks it and mocks its dependencies instead:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'

vi.unmock('@/lib/session')

const getSession = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`) }))
const cookieHeader = vi.hoisted(() => ({ value: '' }))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(cookieHeader.value ? { cookie: cookieHeader.value } : {}),
}))
// React's cache() is a no-op outside a request in tests; keep the real one.

const { getCurrentUser, requireUser } = await import('@/lib/session')

async function makeUser(id: string, isAnonymous: boolean, lastSeenAt: Date) {
  return prisma.user.create({
    data: { id, name: id, email: `${id}@example.com`, isAnonymous, lastSeenAt },
  })
}

beforeEach(() => {
  getSession.mockReset()
  redirect.mockClear()
  cookieHeader.value = ''
})

describe('getCurrentUser', () => {
  it('returns null without a session', async () => {
    getSession.mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the session user', async () => {
    const u = await makeUser('u1', false, new Date())
    getSession.mockResolvedValue({ user: { ...u } })
    expect(await getCurrentUser()).toEqual({ id: 'u1', name: 'u1', email: 'u1@example.com', isAnonymous: false })
  })

  it('bumps lastSeenAt for a guest seen more than an hour ago', async () => {
    const old = new Date(Date.now() - 2 * 3600_000)
    const u = await makeUser('g1', true, old)
    getSession.mockResolvedValue({ user: { ...u } })
    await getCurrentUser()
    const after = await prisma.user.findUniqueOrThrow({ where: { id: 'g1' } })
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(old.getTime())
  })

  it('does not write when the guest was seen within the hour', async () => {
    const recent = new Date(Date.now() - 10 * 60_000)
    const u = await makeUser('g2', true, recent)
    getSession.mockResolvedValue({ user: { ...u } })
    await getCurrentUser()
    const after = await prisma.user.findUniqueOrThrow({ where: { id: 'g2' } })
    expect(after.lastSeenAt.getTime()).toBe(recent.getTime())
  })
})

describe('requireUser', () => {
  it('redirects to /entrar without a session cookie', async () => {
    getSession.mockResolvedValue(null)
    await expect(requireUser()).rejects.toThrow('REDIRECT /entrar')
  })

  it('redirects to /entrar?expirado=1 when a cookie exists but the session is gone', async () => {
    getSession.mockResolvedValue(null)
    cookieHeader.value = 'better-auth.session_token=abc'
    await expect(requireUser()).rejects.toThrow('REDIRECT /entrar?expirado=1')
  })
})
```

- [ ] **Step 6: Implement `src/lib/session.ts`**

```ts
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionCookie } from 'better-auth/cookies'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export type CurrentUser = { id: string; name: string; email: string; isAnonymous: boolean }

const LAST_SEEN_THROTTLE_MS = 3600_000

// cache(): the layout, the header and every data function ask for the user
// in the same request; this keeps it to one session lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const user = session.user as typeof session.user & { isAnonymous?: boolean | null; lastSeenAt?: Date | string | null }
  const isAnonymous = Boolean(user.isAnonymous)

  if (isAnonymous) {
    const lastSeen = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0
    if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    }
  }

  return { id: user.id, name: user.name, email: user.email, isAnonymous }
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (user) return user
  // A cookie without a valid session means the session was deleted, which
  // for guests means cleanup removed the account.
  const hadCookie = Boolean(getSessionCookie(await headers()))
  redirect(hadCookie ? '/entrar?expirado=1' : '/entrar')
}
```

If `getSessionCookie` in this version accepts only a `Request`, wrap it: `getSessionCookie(new Request('http://x', { headers: await headers() }))`. The cookie name in the test (`better-auth.session_token`) must match what `getSessionCookie` looks for. Check it in `node_modules/better-auth` and adjust the test if the prefix differs.

- [ ] **Step 7: Test infra: session mock and default user**

Create `src/test/session-mock.ts`:

```ts
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { CurrentUser } from '@/lib/session'

export const TEST_USER_ID = 'test-user'

let current: CurrentUser | null = null

export function actAs(user: CurrentUser | null): void {
  current = user
}

export async function createTestUser(id: string, overrides: Partial<CurrentUser> = {}): Promise<CurrentUser> {
  const user: CurrentUser = { id, name: id, email: `${id}@example.com`, isAnonymous: false, ...overrides }
  await prisma.user.create({ data: user })
  return user
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return current
}

export async function requireUser(): Promise<CurrentUser> {
  if (!current) redirect('/entrar')
  return current
}
```

In `src/test/setup.ts`:
- Add `vi.mock('@/lib/session', () => import('@/test/session-mock'))`.
- Add a `beforeEach` that runs `actAs(await createTestUser(TEST_USER_ID))`.
- In `afterEach`, after the existing deletes, add `await prisma.session.deleteMany()`, `await prisma.account.deleteMany()`, `await prisma.verification.deleteMany()`, `await prisma.user.deleteMany()` and `actAs(null)`.

The existing order (tasks → goals → objectives) stays first.

- [ ] **Step 8: Set the owner on create**

In `src/lib/actions/objectives.ts`, change `createObjective`:

```ts
export async function createObjective(formData: FormData): Promise<void> {
  const user = await requireUser()
  await prisma.objective.create({ data: { ...readObjectiveFields(formData), userId: user.id } })
  revalidatePath('/objectives')
}
```

In `src/lib/actions/quiz.ts`, call `const user = await requireUser()` before the transaction and add `userId: user.id` to `tx.objective.create({ data: { ... } })`. Import `requireUser` from `@/lib/session` in both files.

- [ ] **Step 9: Update test fixtures**

Every `prisma.objective.create({ data: { ... } })` (and `createMany`) in test files gets `userId: TEST_USER_ID`, imported from `@/test/session-mock`. Find them with `rg -n "objective\.create" src --glob "*.test.*"`. There are about 31, in objectives, weeklyGoals, progress, search, stats, summary, dailyTasks and db tests.

Extend `src/lib/db.test.ts` with:

```ts
it('deleting a user cascades to objectives, goals and tasks', async () => {
  const objective = await prisma.objective.create({
    data: { title: 'O', startDate: new Date(), userId: TEST_USER_ID },
  })
  const goal = await prisma.weeklyGoal.create({
    data: { title: 'G', objectiveId: objective.id, weekStart: new Date(), weekEnd: new Date() },
  })
  await prisma.dailyTask.create({ data: { title: 'T', weeklyGoalId: goal.id, date: new Date() } })

  await prisma.user.delete({ where: { id: TEST_USER_ID } })

  expect(await prisma.objective.count()).toBe(0)
  expect(await prisma.weeklyGoal.count()).toBe(0)
  expect(await prisma.dailyTask.count()).toBe(0)
})
```

Add a test to `objectives.test.ts` and `quiz.test.ts` that the created objective's `userId` is `TEST_USER_ID`.

- [ ] **Step 10: Run the suite**

Run: `npx vitest run`
Expected: all tests pass, including `session.test.ts`. Run `npx tsc --noEmit` and report any errors outside the 4 known pre-existing fixture files (missing `completedAt`).

- [ ] **Step 11: Commit**

Commit message: "feat: add Better Auth accounts, ownership column and session helpers". List the schema/migration (including that it deletes existing objectives/goals/tasks), `auth.ts`, the route handler, `session.ts`, the test infrastructure, the owner set on create and the env vars.

---

### Task 2: Owner-scoped objectives

**Files:**
- Create: `src/lib/owned.ts`
- Modify: `src/lib/actions/objectives.ts`
- Test: `src/lib/owned.test.ts`, `src/lib/actions/objectives.test.ts`

**Interfaces:**
- Consumes: `requireUser()`, `TEST_USER_ID`, `actAs`, `createTestUser` (Task 1).
- Produces, from `@/lib/owned`:
  - `NOT_FOUND = 'Não encontrado'`.
  - `findOwnedObjective(userId: string, id: string): Promise<Objective>`.
  - `findOwnedWeeklyGoal(userId: string, id: string): Promise<WeeklyGoal>`.
  - `findOwnedDailyTask(userId: string, id: string): Promise<DailyTask>`.

  Each throws `new Error(NOT_FOUND)` for a missing or foreign id. Tasks 3 and 4 rely on these.

- [ ] **Step 1: Write the failing tests**

`src/lib/owned.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { findOwnedDailyTask, findOwnedObjective, findOwnedWeeklyGoal, NOT_FOUND } from '@/lib/owned'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

async function tree(userId: string) {
  const objective = await prisma.objective.create({ data: { title: 'O', startDate: new Date(), userId } })
  const goal = await prisma.weeklyGoal.create({
    data: { title: 'G', objectiveId: objective.id, weekStart: new Date(), weekEnd: new Date() },
  })
  const task = await prisma.dailyTask.create({ data: { title: 'T', weeklyGoalId: goal.id, date: new Date() } })
  return { objective, goal, task }
}

describe('owned lookups', () => {
  it('return records owned by the user', async () => {
    const t = await tree(TEST_USER_ID)
    expect((await findOwnedObjective(TEST_USER_ID, t.objective.id)).id).toBe(t.objective.id)
    expect((await findOwnedWeeklyGoal(TEST_USER_ID, t.goal.id)).id).toBe(t.goal.id)
    expect((await findOwnedDailyTask(TEST_USER_ID, t.task.id)).id).toBe(t.task.id)
  })

  it("reject another user's records exactly like missing ids", async () => {
    await createTestUser('other')
    const t = await tree('other')
    await expect(findOwnedObjective(TEST_USER_ID, t.objective.id)).rejects.toThrow(NOT_FOUND)
    await expect(findOwnedWeeklyGoal(TEST_USER_ID, t.goal.id)).rejects.toThrow(NOT_FOUND)
    await expect(findOwnedDailyTask(TEST_USER_ID, t.task.id)).rejects.toThrow(NOT_FOUND)
    await expect(findOwnedObjective(TEST_USER_ID, 'missing')).rejects.toThrow(NOT_FOUND)
  })
})
```

Add an isolation block to `src/lib/actions/objectives.test.ts`:

```ts
describe('isolation between users', () => {
  async function otherObjective() {
    await createTestUser('other')
    return prisma.objective.create({ data: { title: 'Alheio', startDate: new Date(), userId: 'other' } })
  }

  it("lists, counts and searches only the current user's objectives", async () => {
    const foreign = await otherObjective()
    await prisma.objective.create({ data: { title: 'Meu', startDate: new Date(), userId: TEST_USER_ID } })
    expect((await listObjectives()).map((o) => o.title)).toEqual(['Meu'])
    expect(await countObjectives()).toBe(1)
    const { active, completed } = await listObjectivesWithStats()
    expect([...active, ...completed].map((o) => o.id)).not.toContain(foreign.id)
  })

  it("returns null for another user's objective", async () => {
    const foreign = await otherObjective()
    expect(await getObjective(foreign.id)).toBeNull()
  })

  it("cannot update, delete, complete, reopen or read stats of another user's objective", async () => {
    const foreign = await otherObjective()
    const form = new FormData()
    form.set('title', 'Hack')
    form.set('startDate', '2026-10-01')
    await expect(updateObjective(foreign.id, form)).rejects.toThrow(NOT_FOUND)
    await expect(deleteObjective(foreign.id)).rejects.toThrow(NOT_FOUND)
    await expect(completeObjective(foreign.id)).rejects.toThrow(NOT_FOUND)
    await expect(reopenObjective(foreign.id)).rejects.toThrow(NOT_FOUND)
    await expect(getObjectiveStats(foreign.id)).rejects.toThrow(NOT_FOUND)
    const after = await prisma.objective.findUniqueOrThrow({ where: { id: foreign.id } })
    expect(after.title).toBe('Alheio')
    expect(after.status).toBe('ACTIVE')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/owned.test.ts src/lib/actions/objectives.test.ts`
Expected: FAIL. `@/lib/owned` does not exist yet, and the isolation assertions fail.

- [ ] **Step 3: Implement `src/lib/owned.ts`**

```ts
import { prisma } from '@/lib/db'
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'

export const NOT_FOUND = 'Não encontrado'

// A foreign record is indistinguishable from a missing one, so ids of other
// users' data cannot be probed.
export async function findOwnedObjective(userId: string, id: string): Promise<Objective> {
  const objective = await prisma.objective.findFirst({ where: { id, userId } })
  if (!objective) throw new Error(NOT_FOUND)
  return objective
}

export async function findOwnedWeeklyGoal(userId: string, id: string): Promise<WeeklyGoal> {
  const goal = await prisma.weeklyGoal.findFirst({ where: { id, objective: { userId } } })
  if (!goal) throw new Error(NOT_FOUND)
  return goal
}

export async function findOwnedDailyTask(userId: string, id: string): Promise<DailyTask> {
  const task = await prisma.dailyTask.findFirst({ where: { id, weeklyGoal: { objective: { userId } } } })
  if (!task) throw new Error(NOT_FOUND)
  return task
}
```

- [ ] **Step 4: Scope `src/lib/actions/objectives.ts`**

- **Reads:**
  - `listObjectives`: `findMany({ where: { userId: user.id }, orderBy: ... })`.
  - `countObjectives`: `count({ where: { userId: user.id } })`.
  - `getObjective`: `findFirst({ where: { id, userId: user.id } })`.
  - `listObjectivesWithStats`: `findMany({ where: { userId: user.id }, ... })`.
- **Mutations:** `updateObjective`, `deleteObjective`, `completeObjective`, `reopenObjective` each start with `const user = await requireUser(); await findOwnedObjective(user.id, id)`, then keep the existing write.
- **`getObjectiveStats(objectiveId)`:** start with `const user = await requireUser()`. Replace `findUniqueOrThrow` with `await findOwnedObjective(user.id, objectiveId)` and use its `startDate`/`completedAt`.

Each function resolves the user once at its top.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/owned.test.ts src/lib/actions/objectives.test.ts`
Expected: PASS. Then run `npx vitest run` and expect everything to pass.

- [ ] **Step 6: Commit**

Commit message: "feat: scope objectives to the signed-in user". Mention `owned.ts`, that foreign ids behave as missing, and the functions changed.

---

### Task 3: Owner-scoped weekly goals and recurrences

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts`
- Test: `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Consumes: `requireUser()`, `findOwnedObjective`, `findOwnedWeeklyGoal`, `NOT_FOUND`.
- Produces: unchanged public signatures. `findMissingGoals(currentWeekStart, userId, db)` gains a `userId` parameter, in second position, before `db`.

- [ ] **Step 1: Write the failing isolation tests** (append to `weeklyGoals.test.ts`; reuse the file's existing fake-timer setup and helpers where they exist)

```ts
describe('isolation between users', () => {
  async function objectiveFor(userId: string, title = 'O') {
    return prisma.objective.create({ data: { title, startDate: new Date(2026, 8, 1), userId } })
  }

  it("does not list, get, update or delete another user's weekly goals", async () => {
    await createTestUser('other')
    const foreign = await objectiveFor('other')
    const { weekStart, weekEnd } = getWeekBounds(new Date())
    const goal = await prisma.weeklyGoal.create({ data: { title: 'Alheia', objectiveId: foreign.id, weekStart, weekEnd } })

    expect(await listWeeklyGoalsByObjective(foreign.id)).toEqual([])
    expect(await getWeeklyGoal(goal.id)).toBeNull()
    expect(await listWeeklyGoalsForCurrentWeek()).toEqual([])
    await expect(getWeekProgress(goal.id)).rejects.toThrow(NOT_FOUND)

    const form = new FormData()
    form.set('title', 'Hack')
    form.set('weekOf', '2026-10-05')
    await expect(updateWeeklyGoal(goal.id, form)).rejects.toThrow(NOT_FOUND)
    await expect(deleteWeeklyGoal(goal.id)).rejects.toThrow(NOT_FOUND)
    await expect(createWeeklyGoal(foreign.id, form)).rejects.toThrow(NOT_FOUND)
    expect(await prisma.weeklyGoal.count({ where: { objectiveId: foreign.id } })).toBe(1)
  })

  it("never clones another user's recurring goals into the current week", async () => {
    await createTestUser('other')
    const foreign = await objectiveFor('other')
    const lastWeek = getWeekBounds(addDays(new Date(), -7))
    await prisma.weeklyGoal.create({
      data: { title: 'Recorrente alheia', objectiveId: foreign.id, recurring: true, ...lastWeek },
    })

    expect(await countPendingRecurrences()).toBe(0)
    expect(await getMissingGoalsPreview()).toBeNull()
    await materializePendingWeek()
    await repeatMissingGoals()
    expect(await prisma.weeklyGoal.count()).toBe(1)
  })

  it("uses the current user's own last planned week as the source, ignoring others' newer weeks", async () => {
    await createTestUser('other')
    const mine = await objectiveFor(TEST_USER_ID, 'Meu')
    const foreign = await objectiveFor('other', 'Alheio')
    const twoWeeksAgo = getWeekBounds(addDays(new Date(), -14))
    const lastWeek = getWeekBounds(addDays(new Date(), -7))
    await prisma.weeklyGoal.create({ data: { title: 'Minha', objectiveId: mine.id, ...twoWeeksAgo } })
    await prisma.weeklyGoal.create({ data: { title: 'Dele', objectiveId: foreign.id, ...lastWeek } })

    const preview = await getMissingGoalsPreview()
    expect(preview?.goals.map((g) => g.title)).toEqual(['Minha'])
  })
})
```

Import `addDays` from `date-fns`, `getWeekBounds` from `@/lib/dates`, `NOT_FOUND` from `@/lib/owned`, and `TEST_USER_ID`/`createTestUser` from `@/test/session-mock` if they are not already imported.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: the new isolation tests FAIL.

- [ ] **Step 3: Scope the module**

- **`createWeeklyGoal(objectiveId, formData)`:** `const user = await requireUser(); await findOwnedObjective(user.id, objectiveId)` before creating.
- **`listWeeklyGoalsByObjective`:** `where: { objectiveId, objective: { userId: user.id } }`.
- **`getWeeklyGoal`:** `findFirst({ where: { id, objective: { userId: user.id } } })`.
- **`updateWeeklyGoal`, `deleteWeeklyGoal`:** `await findOwnedWeeklyGoal(user.id, id)` first.
- **`getWeekProgress(weeklyGoalId)`:** `await findOwnedWeeklyGoal(user.id, weeklyGoalId)` first.
- **`listWeeklyGoalsForCurrentWeek`:** add `objective: { userId: user.id }` to `where`.
- **`findMissingGoals(currentWeekStart, userId, db = prisma)`:** add `objective: { userId }` to all three queries: the `previous` lookup, `sourceGoals` and `currentGoals`. Update the doc comment.
- **`getMissingGoalsPreview`, `countPendingRecurrences`:** resolve the user and pass `user.id`.
- **`repeatMissingGoals`, `materializePendingWeek`:** resolve the user **before** `prisma.$transaction` and pass `user.id` into `findMissingGoals(currentWeekStart, user.id, tx)`.

`cloneGoalsInto` needs no change: clones keep the source `objectiveId`, which is already owned.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`, then `npx vitest run`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: "feat: scope weekly goals and recurrences to the signed-in user". Mention that recurrence sources are per user.

---

### Task 4: Owner-scoped daily tasks

**Files:**
- Modify: `src/lib/actions/dailyTasks.ts`
- Test: `src/lib/actions/dailyTasks.test.ts`

**Interfaces:**
- Consumes: `requireUser()`, `findOwnedWeeklyGoal`, `findOwnedDailyTask`, `NOT_FOUND`.
- Produces: unchanged public signatures.

- [ ] **Step 1: Write the failing isolation tests** (append)

```ts
describe('isolation between users', () => {
  async function foreignTask() {
    await createTestUser('other')
    const objective = await prisma.objective.create({ data: { title: 'O', startDate: new Date(), userId: 'other' } })
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'G', objectiveId: objective.id, weekStart: startOfDay(new Date()), weekEnd: endOfDay(new Date()) },
    })
    const task = await prisma.dailyTask.create({ data: { title: 'Alheia', weeklyGoalId: goal.id, date: new Date() } })
    return { goal, task }
  }

  it("does not list or get another user's tasks", async () => {
    const { goal, task } = await foreignTask()
    expect(await listDailyTasksByDate(new Date())).toEqual([])
    expect(await listDailyTasksByWeeklyGoal(goal.id)).toEqual([])
    expect(await getDailyTask(task.id)).toBeNull()
  })

  it("cannot toggle, update, delete or add tasks under another user's goal", async () => {
    const { goal, task } = await foreignTask()
    const form = new FormData()
    form.set('title', 'Hack')
    form.set('date', '2026-10-05')
    form.append('dates', '2026-10-05')
    await expect(toggleDailyTask(task.id)).rejects.toThrow(NOT_FOUND)
    await expect(updateDailyTask(task.id, form)).rejects.toThrow(NOT_FOUND)
    await expect(deleteDailyTask(task.id)).rejects.toThrow(NOT_FOUND)
    await expect(createDailyTask(goal.id, form)).rejects.toThrow(NOT_FOUND)
    await expect(createDailyTasks(goal.id, form)).rejects.toThrow(NOT_FOUND)
    const after = await prisma.dailyTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(after).toMatchObject({ title: 'Alheia', completed: false })
    expect(await prisma.dailyTask.count({ where: { weeklyGoalId: goal.id } })).toBe(1)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/actions/dailyTasks.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Scope the module**

- **`createDailyTask`, `createDailyTasks`:** `await findOwnedWeeklyGoal(user.id, weeklyGoalId)` before validation side effects. Throwing `NOT_FOUND` before the title/date errors is fine.
- **`listDailyTasksByWeeklyGoal`:** `where: { weeklyGoalId, weeklyGoal: { objective: { userId: user.id } } }`.
- **`getDailyTask`:** `findFirst({ where: { id, weeklyGoal: { objective: { userId: user.id } } } })`.
- **`updateDailyTask`, `deleteDailyTask`:** `await findOwnedDailyTask(user.id, id)` first.
- **`toggleDailyTask`:** replace `findUniqueOrThrow` with `const task = await findOwnedDailyTask(user.id, id)`.
- **`listDailyTasksByDate`:** add `weeklyGoal: { objective: { userId: user.id } }` to `where`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/actions/dailyTasks.test.ts`, then `npx vitest run`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: "feat: scope daily tasks to the signed-in user".

---

### Task 5: Owner-scoped search, stats, summary and progress

**Files:**
- Modify: `src/lib/actions/search.ts`, `src/lib/actions/stats.ts`, `src/lib/actions/summary.ts`, `src/lib/actions/progress.ts`
- Test: the matching `*.test.ts` files

**Interfaces:**
- Consumes: `requireUser()`, `findOwnedObjective`, `NOT_FOUND`.
- Produces: unchanged signatures.

- [ ] **Step 1: Write the failing tests** (one per file, appended)

Each test first creates a foreign tree: `await createTestUser('other')`, then an objective with `userId: 'other'`, a goal in the current week, and a task dated today with `completed: true`, `completedAt: new Date()`. Titles contain "Alheio". Then it asserts:

```ts
// search.test.ts
expect(await search('Alheio')).toEqual({ objectives: [], weeklyGoals: [] })

// stats.test.ts
expect(await getLifetimeStats()).toMatchObject({ totalCompleted: 0, firstCompletedAt: null })

// summary.test.ts
expect(await getTodaySummary()).toMatchObject({ completed: 0, total: 0 })

// progress.test.ts
await expect(getObjectiveProgressSeries(foreignObjective.id)).rejects.toThrow(NOT_FOUND)
```

Write the foreign-tree creation inline in each test, with the same fields as above, so each file stays self-contained.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/actions/search.test.ts src/lib/actions/stats.test.ts src/lib/actions/summary.test.ts src/lib/actions/progress.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Scope the modules**

- **`search`:** resolve the user after the empty-query early return. Use objectives `where: { title, userId: user.id }` and weekly goals `where: { title, objective: { userId: user.id } }`.
- **`getLifetimeStats`:** `const owned = { weeklyGoal: { objective: { userId: user.id } } }` is spread into all three `where`s.
- **`getTodaySummary`:** the same `owned` fragment is spread into both counts.
- **`getObjectiveProgressSeries(objectiveId)`:** `await findOwnedObjective(user.id, objectiveId)` first.

- [ ] **Step 4: Run the tests**

Run: the same four files, then `npx vitest run`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: "feat: scope search, stats, summary and progress to the signed-in user".

---

### Task 6: Proxy redirect and `/funil` visibility

Read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `node_modules/next/dist/docs/01-app/02-guides/authentication.md` first.

**Files:**
- Create: `src/lib/public-routes.ts`, `src/proxy.ts`
- Modify: `src/app/funil/page.tsx`
- Test: `src/lib/public-routes.test.ts`

**Interfaces:**
- Produces:
  - `isFunnelPublic(env = process.env): boolean`.
  - `isPublicPath(pathname: string, funnelPublic: boolean): boolean`.
  - `AUTH_PAGES = ['/entrar', '/cadastro'] as const`.

- [ ] **Step 1: Write the failing tests `src/lib/public-routes.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { isFunnelPublic, isPublicPath } from '@/lib/public-routes'

describe('isPublicPath', () => {
  it('always allows the auth pages', () => {
    expect(isPublicPath('/entrar', false)).toBe(true)
    expect(isPublicPath('/cadastro', false)).toBe(true)
  })

  it('protects app pages', () => {
    for (const path of ['/', '/objectives', '/objectives/abc', '/quiz', '/week']) {
      expect(isPublicPath(path, true)).toBe(false)
    }
  })

  it('opens /funil only when the funnel is public', () => {
    expect(isPublicPath('/funil', true)).toBe(true)
    expect(isPublicPath('/funil', false)).toBe(false)
  })

  it('does not treat lookalike paths as public', () => {
    expect(isPublicPath('/entrarx', false)).toBe(false)
    expect(isPublicPath('/funil-secreto', true)).toBe(false)
  })
})

describe('isFunnelPublic', () => {
  it('is true only for the exact string "true"', () => {
    expect(isFunnelPublic({ FUNNEL_PUBLIC: 'true' })).toBe(true)
    for (const v of [undefined, '', 'TRUE', '1', 'false']) {
      expect(isFunnelPublic({ FUNNEL_PUBLIC: v })).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/public-routes.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/public-routes.ts`:

```ts
export const AUTH_PAGES = ['/entrar', '/cadastro'] as const

export function isFunnelPublic(env: Record<string, string | undefined> = process.env): boolean {
  return env.FUNNEL_PUBLIC === 'true'
}

export function isPublicPath(pathname: string, funnelPublic: boolean): boolean {
  if ((AUTH_PAGES as readonly string[]).includes(pathname)) return true
  return funnelPublic && pathname === '/funil'
}
```

`src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { isFunnelPublic, isPublicPath } from '@/lib/public-routes'

// Optimistic only: it sees the cookie, not whether the session is valid.
// requireUser() does the real check on the server.
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname, isFunnelPublic())) return NextResponse.next()
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL('/entrar', request.url))
}

export const config = {
  // Skip Next internals, the auth API, the manifest and any file with an extension (icons, images).
  matcher: ['/((?!_next/|api/auth|manifest\\.webmanifest|.*\\.[a-zA-Z0-9]+$).*)'],
}
```

In `src/app/funil/page.tsx`, start the page with `if (!isFunnelPublic()) await requireUser()`. Keep `export const dynamic = 'force-dynamic'`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/public-routes.test.ts`, then `npx vitest run`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: "feat: redirect logged-out visitors to /entrar and gate /funil behind FUNNEL_PUBLIC".

---

### Task 7: Login and sign-up screens

**Files:**
- Create: `src/lib/auth-errors.ts`, `src/lib/auth-client.ts`, `src/components/auth-form.tsx`, `src/app/entrar/page.tsx`, `src/app/cadastro/page.tsx`
- Test: `src/lib/auth-errors.test.ts`, `src/components/auth-form.test.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()`, `PASSWORD_MIN_LENGTH` (re-export it from a plain module, `src/lib/auth-errors.ts`, so client code does not import `auth.ts`).
- Produces:
  - `authErrorMessage(error: { status?: number; code?: string } | null | undefined): string`.
  - `<AuthForm mode="entrar" | "cadastro" />`.
  - `authClient` from `@/lib/auth-client`.
  - Task 9 adds the guest button to `/entrar`.

- [ ] **Step 1: Write the failing tests**

`src/lib/auth-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '@/lib/auth-errors'

describe('authErrorMessage', () => {
  it('maps wrong credentials without saying which field is wrong', () => {
    expect(authErrorMessage({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe('E-mail ou senha incorretos')
  })
  it('maps an existing e-mail', () => {
    expect(authErrorMessage({ status: 422, code: 'USER_ALREADY_EXISTS' })).toBe('Esse e-mail já tem conta')
    expect(authErrorMessage({ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe('Esse e-mail já tem conta')
  })
  it('maps rate limiting', () => {
    expect(authErrorMessage({ status: 429 })).toBe('Muitas tentativas. Tente de novo em alguns minutos.')
  })
  it('falls back to a generic retry message', () => {
    expect(authErrorMessage({ status: 500 })).toBe('Não foi possível concluir. Tente de novo.')
    expect(authErrorMessage(undefined)).toBe('Não foi possível concluir. Tente de novo.')
  })
})
```

`src/components/auth-form.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from '@/components/auth-form'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const signInEmail = vi.hoisted(() => vi.fn())
const signUpEmail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: signInEmail }, signUp: { email: signUpEmail } },
}))

beforeEach(() => {
  push.mockClear(); refresh.mockClear(); signInEmail.mockReset(); signUpEmail.mockReset()
})

describe('AuthForm', () => {
  it('signs in and goes home', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null })
    render(<AuthForm mode="entrar" />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(signInEmail).toHaveBeenCalledWith({ email: 'a@b.com', password: 'segredo123' })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('announces wrong credentials', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' } })
    render(<AuthForm mode="entrar" />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos')
    expect(push).not.toHaveBeenCalled()
  })

  it('signs up with name, e-mail and password and links to /entrar when the e-mail exists', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { status: 422, code: 'USER_ALREADY_EXISTS' } })
    render(<AuthForm mode="cadastro" />)
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(signUpEmail).toHaveBeenCalledWith({ name: 'Ana', email: 'a@b.com', password: 'segredo123' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse e-mail já tem conta')
    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute('href', '/entrar')
  })

  it('requires at least 8 characters for the password', () => {
    render(<AuthForm mode="cadastro" />)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('minLength', '8')
  })

  it('toggles password visibility', async () => {
    render(<AuthForm mode="entrar" />)
    const input = screen.getByLabelText('Senha')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument()
  })
})
```

If `@testing-library/user-event` is not installed, use `fireEvent` from `@testing-library/react` (check `package.json`; the existing component tests show which one the project uses).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/auth-errors.test.ts src/components/auth-form.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/lib/auth-errors.ts`:

```ts
export const PASSWORD_MIN_LENGTH = 8

const GENERIC = 'Não foi possível concluir. Tente de novo.'

export function authErrorMessage(error: { status?: number; code?: string } | null | undefined): string {
  if (!error) return GENERIC
  if (error.status === 429) return 'Muitas tentativas. Tente de novo em alguns minutos.'
  if (error.code?.startsWith('USER_ALREADY_EXISTS')) return 'Esse e-mail já tem conta'
  if (error.status === 401 || error.code === 'INVALID_EMAIL_OR_PASSWORD') return 'E-mail ou senha incorretos'
  return GENERIC
}
```

Change `src/lib/auth.ts` to import `PASSWORD_MIN_LENGTH` from `@/lib/auth-errors` instead of declaring it.

`src/lib/auth-client.ts`:

```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()
```

`src/components/auth-form.tsx` (client). It uses `Input`, `Label`, `Button` from `@/components/ui/*`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage, PASSWORD_MIN_LENGTH } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm({ mode }: { mode: 'entrar' | 'cadastro' }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const signingUp = mode === 'cadastro'

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setPending(true)
    setError(null)
    try {
      const result = signingUp
        ? await authClient.signUp.email({ name: String(form.get('name') ?? '').trim(), email, password })
        : await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(authErrorMessage(result.error))
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError(authErrorMessage(null))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
      {signingUp && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={PASSWORD_MIN_LENGTH}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {signingUp && <p className="text-xs text-muted-foreground">Mínimo de {PASSWORD_MIN_LENGTH} caracteres.</p>}
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
            {error === 'Esse e-mail já tem conta' && (
              <> <Link href="/entrar" className="underline underline-offset-4">Entrar</Link></>
            )}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {signingUp ? 'Criar conta' : 'Entrar'}
      </Button>
    </form>
  )
}
```

If `Input`'s smooth caret wrapper does not forward `type="password"`/`minLength` to the real `<input>`, check `src/components/ui/input.tsx` and fix the forwarding there; the test asserts the attributes on the labelled input.

`src/app/entrar/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Entrar' }

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ expirado?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const { expirado } = await searchParams

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Entrar</h1>
      {expirado === '1' && (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          Sua sessão de visitante expirou
        </p>
      )}
      <AuthForm mode="entrar" />
      <p className="text-sm text-muted-foreground">
        Não tem conta? <Link href="/cadastro" className="text-accent-foreground underline-offset-4 hover:underline">Criar conta</Link>
      </p>
      {/* Task 9 adds the guest button here */}
    </main>
  )
}
```

`src/app/cadastro/page.tsx` follows the same shape: title "Criar conta", `<AuthForm mode="cadastro" />`, and a link "Já tem conta? Entrar" to `/entrar`. It also redirects to `/` when there is a user. Check `searchParams` typing against `node_modules/next/dist/docs` (Promise in Next 15+).

- [ ] **Step 4: Run the tests**

Run: the two files, then `npx vitest run`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: "feat: add /entrar and /cadastro with e-mail and password". Mention the error copy, the password toggle, `aria-live` and the redirect for logged-in users.

---

### Task 8: Guest demo data generator and seeding

**Files:**
- Create: `src/lib/guest/demo-data.ts`, `src/lib/guest/seed.ts`
- Test: `src/lib/guest/demo-data.test.ts`, `src/lib/guest/seed.test.ts`

**Interfaces:**
- Consumes: `getWeekBounds(date): { weekStart: Date; weekEnd: Date }` from `@/lib/dates` (Monday-based weeks).
- Produces:
  - Types:
    - `DemoTask = { title: string; date: Date; completed: boolean; completedAt: Date | null }`
    - `DemoGoal = { title: string; weekStart: Date; weekEnd: Date; recurring: boolean; tasks: DemoTask[] }`
    - `DemoObjective = { title: string; startDate: Date; targetDate: Date; status: 'ACTIVE' | 'COMPLETED'; completedAt: Date | null; goals: DemoGoal[] }`
  - `buildDemoData(now: Date): DemoObjective[]`.
  - `seedDemoData(userId: string, now?: Date): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`src/lib/guest/demo-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isSameDay, startOfDay } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'
import { buildDemoData } from '@/lib/guest/demo-data'

const NOW = new Date(2026, 9, 7, 15) // Wednesday 07/10/2026 15:00
const data = buildDemoData(NOW)
const currentWeek = getWeekBounds(NOW).weekStart

describe('buildDemoData', () => {
  it('has two active objectives and one completed with completedAt', () => {
    expect(data).toHaveLength(3)
    expect(data.filter((o) => o.status === 'ACTIVE')).toHaveLength(2)
    const done = data.find((o) => o.status === 'COMPLETED')!
    expect(done.completedAt).toBeInstanceOf(Date)
    expect(done.completedAt!.getTime()).toBeLessThan(NOW.getTime())
  })

  it('gives the active objectives 8 weeks: 7 past plus the current one', () => {
    for (const objective of data.filter((o) => o.status === 'ACTIVE')) {
      const weeks = objective.goals.map((g) => g.weekStart.getTime())
      expect(new Set(weeks).size).toBe(8)
      expect(objective.goals.some((g) => isSameDay(g.weekStart, currentWeek))).toBe(true)
    }
  })

  it('has one active objective near its target date', () => {
    const days = data
      .filter((o) => o.status === 'ACTIVE')
      .map((o) => (o.targetDate.getTime() - NOW.getTime()) / 86_400_000)
    expect(Math.min(...days)).toBeLessThanOrEqual(14)
    expect(Math.min(...days)).toBeGreaterThan(0)
  })

  it('never marks a future task as done, and stamps completedAt on done tasks', () => {
    for (const task of data.flatMap((o) => o.goals.flatMap((g) => g.tasks))) {
      if (task.date > startOfDay(NOW) && !isSameDay(task.date, NOW)) expect(task.completed).toBe(false)
      expect(task.completed).toBe(task.completedAt !== null)
      if (task.completedAt) expect(task.completedAt.getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('has varied completion in past weeks (not all 100%)', () => {
    const past = data.flatMap((o) => o.goals).filter((g) => g.weekStart < currentWeek)
    const rates = past.map((g) => g.tasks.filter((t) => t.completed).length / g.tasks.length)
    expect(rates.some((r) => r === 1)).toBe(true)
    expect(rates.some((r) => r < 1)).toBe(true)
  })

  it('keeps tasks inside their goal week, and dates relative to now', () => {
    for (const goal of data.flatMap((o) => o.goals)) {
      for (const task of goal.tasks) {
        expect(task.date >= goal.weekStart && task.date <= goal.weekEnd).toBe(true)
      }
    }
    const later = buildDemoData(new Date(2027, 0, 13, 15))
    expect(later[0].goals.at(-1)!.weekStart.getFullYear()).toBe(2027)
  })

  it('marks the active goals recurring so next week materializes', () => {
    for (const objective of data.filter((o) => o.status === 'ACTIVE')) {
      expect(objective.goals.every((g) => g.recurring)).toBe(true)
    }
  })
})
```

`src/lib/guest/seed.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { seedDemoData } from '@/lib/guest/seed'
import { createTestUser } from '@/test/session-mock'

describe('seedDemoData', () => {
  it('writes the demo objectives, goals and tasks owned by the user', async () => {
    await createTestUser('guest-1', { isAnonymous: true })
    await seedDemoData('guest-1', new Date(2026, 9, 7, 15))
    expect(await prisma.objective.count({ where: { userId: 'guest-1' } })).toBe(3)
    expect(await prisma.weeklyGoal.count({ where: { objective: { userId: 'guest-1' } } })).toBeGreaterThanOrEqual(16)
    expect(await prisma.dailyTask.count({ where: { weeklyGoal: { objective: { userId: 'guest-1' } }, completed: true } })).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/guest`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `src/lib/guest/demo-data.ts`**

```ts
import { addDays, addWeeks, isAfter, isSameDay, setHours, startOfDay } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'

export type DemoTask = { title: string; date: Date; completed: boolean; completedAt: Date | null }
export type DemoGoal = { title: string; weekStart: Date; weekEnd: Date; recurring: boolean; tasks: DemoTask[] }
export type DemoObjective = {
  title: string
  startDate: Date
  targetDate: Date
  status: 'ACTIVE' | 'COMPLETED'
  completedAt: Date | null
  goals: DemoGoal[]
}

type Plan = {
  goal: string
  task: string
  days: number[] // 0 = Monday … 6 = Sunday
  rates: number[] // completion per past week, oldest first
  recurring: boolean
}

// Fixed patterns, not randomness: every guest sees the same believable story,
// and tests can rely on it.
const RUN: Plan = { goal: 'Treinar 3x na semana', task: 'Corrida leve', days: [0, 2, 4], rates: [1, 1, 0.67, 1, 1, 0.33, 1], recurring: true }
const READ: Plan = { goal: 'Ler 20 páginas por dia', task: 'Ler 20 páginas', days: [0, 1, 2, 3, 4], rates: [0.8, 1, 1, 0.6, 1, 0.8, 1], recurring: true }
const GUITAR: Plan = { goal: 'Praticar acordes', task: 'Praticar 20 min', days: [1, 3, 5], rates: [1, 1, 0.67, 1, 1, 1, 1, 1], recurring: false }

function week(weekStart: Date, plan: Plan, rate: number | 'current', now: Date): DemoGoal {
  const { weekEnd } = getWeekBounds(weekStart)
  const today = startOfDay(now)
  const doneCount = rate === 'current' ? 0 : Math.round(rate * plan.days.length)

  const tasks = plan.days.map((offset, index): DemoTask => {
    const date = addDays(weekStart, offset)
    let completed: boolean
    if (rate === 'current') {
      // Past days of this week are done; today is done only for reading, so Hoje shows one open and one checked.
      completed = isAfter(today, date) || (isSameDay(date, today) && plan === READ)
    } else {
      completed = index < doneCount
    }
    const completedAt = completed ? (isSameDay(date, today) ? now : setHours(date, 19)) : null
    return { title: plan.task, date, completed, completedAt }
  })

  return { title: plan.goal, weekStart, weekEnd, recurring: plan.recurring, tasks }
}

function weeksOf(plan: Plan, firstWeek: Date, now: Date, includeCurrent: boolean): DemoGoal[] {
  const goals = plan.rates.map((rate, i) => week(addWeeks(firstWeek, i), plan, rate, now))
  if (includeCurrent) goals.push(week(addWeeks(firstWeek, plan.rates.length), plan, 'current', now))
  return goals
}

export function buildDemoData(now: Date): DemoObjective[] {
  const current = getWeekBounds(now).weekStart
  const sevenAgo = addWeeks(current, -7)
  const tenAgo = addWeeks(current, -10)

  return [
    {
      title: 'Correr 10 km',
      startDate: sevenAgo,
      targetDate: addWeeks(startOfDay(now), 8),
      status: 'ACTIVE',
      completedAt: null,
      goals: weeksOf(RUN, sevenAgo, now, true),
    },
    {
      title: 'Ler 12 livros no ano',
      startDate: sevenAgo,
      targetDate: addDays(startOfDay(now), 10),
      status: 'ACTIVE',
      completedAt: null,
      goals: weeksOf(READ, sevenAgo, now, true),
    },
    {
      title: 'Aprender o básico de violão',
      startDate: tenAgo,
      targetDate: addWeeks(current, -2),
      status: 'COMPLETED',
      completedAt: setHours(addDays(addWeeks(current, -3), 5), 18),
      goals: weeksOf(GUITAR, tenAgo, now, false),
    },
  ]
}
```

`src/lib/guest/seed.ts`:

```ts
import { prisma } from '@/lib/db'
import { buildDemoData } from '@/lib/guest/demo-data'

export async function seedDemoData(userId: string, now: Date = new Date()): Promise<void> {
  const objectives = buildDemoData(now)
  await prisma.$transaction(async (tx) => {
    for (const { goals, ...objective } of objectives) {
      const created = await tx.objective.create({ data: { ...objective, userId } })
      for (const { tasks, ...goal } of goals) {
        const createdGoal = await tx.weeklyGoal.create({ data: { ...goal, objectiveId: created.id } })
        await tx.dailyTask.createMany({ data: tasks.map((task) => ({ ...task, weeklyGoalId: createdGoal.id })) })
      }
    }
  })
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/guest`, then `npx vitest run`.
Expected: PASS. If the "near target date" or "varied completion" assertion fails, fix the generator, not the test.

- [ ] **Step 5: Commit**

Commit message: "feat: generate and seed demo data for guest accounts".

---

### Task 9: Guest cleanup, `enterAsGuest` and the guest button

**Files:**
- Create: `src/lib/guest/cleanup.ts`, `src/lib/actions/guest.ts`, `src/components/guest-button.tsx`
- Modify: `src/app/entrar/page.tsx`
- Test: `src/lib/guest/cleanup.test.ts`, `src/lib/actions/guest.test.ts`, `src/components/guest-button.test.tsx`

**Interfaces:**
- Consumes: `seedDemoData(userId, now?)` (Task 8), `auth` (Task 1).
- Produces:
  - `GUEST_IDLE_MS = 24 * 3600_000`, `MAX_GUESTS = 200`.
  - `cleanupGuests(now?: Date): Promise<number>`, which returns the number deleted.
  - `enterAsGuest(): Promise<void>` (Server Action).
  - `<GuestButton onEnter={() => Promise<void>} />`.

- [ ] **Step 1: Write the failing tests**

`src/lib/guest/cleanup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { cleanupGuests, GUEST_IDLE_MS, MAX_GUESTS } from '@/lib/guest/cleanup'

const NOW = new Date(2026, 9, 7, 15)

async function user(id: string, isAnonymous: boolean, idleMs: number) {
  await prisma.user.create({
    data: { id, name: id, email: `${id}@example.com`, isAnonymous, lastSeenAt: new Date(NOW.getTime() - idleMs) },
  })
}

describe('cleanupGuests', () => {
  it('deletes guests idle for more than 24 h, with their data, and keeps active guests', async () => {
    await user('old', true, GUEST_IDLE_MS + 60_000)
    await user('fresh', true, GUEST_IDLE_MS - 60_000)
    await prisma.objective.create({ data: { title: 'O', startDate: NOW, userId: 'old' } })

    expect(await cleanupGuests(NOW)).toBe(1)
    expect(await prisma.user.findUnique({ where: { id: 'old' } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: 'fresh' } })).not.toBeNull()
    expect(await prisma.objective.count({ where: { userId: 'old' } })).toBe(0)
  })

  it('never deletes real accounts, however idle', async () => {
    await user('real', false, 365 * 24 * 3600_000)
    await cleanupGuests(NOW)
    expect(await prisma.user.findUnique({ where: { id: 'real' } })).not.toBeNull()
  })

  it('keeps room for one more guest under the cap, removing the least recently seen', async () => {
    for (let i = 0; i < MAX_GUESTS; i++) await user(`g${String(i).padStart(3, '0')}`, true, i * 1000)
    // g000 is the most recent, g199 the least recent.
    expect(await cleanupGuests(NOW)).toBe(1)
    expect(await prisma.user.count({ where: { isAnonymous: true } })).toBe(MAX_GUESTS - 1)
    expect(await prisma.user.findUnique({ where: { id: 'g199' } })).toBeNull()
  })
})
```

`src/lib/actions/guest.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const signInAnonymous = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: { api: { signInAnonymous } } }))

const cleanupGuests = vi.hoisted(() => vi.fn())
vi.mock('@/lib/guest/cleanup', () => ({ cleanupGuests }))

const { enterAsGuest } = await import('@/lib/actions/guest')

beforeEach(() => {
  redirect.mockClear()
  cleanupGuests.mockReset().mockResolvedValue(0)
  signInAnonymous.mockReset().mockImplementation(async () => {
    const user = await prisma.user.create({
      data: { id: 'anon-1', name: 'Visitante', email: 'anon-1@example.com', isAnonymous: true },
    })
    return { token: 't', user }
  })
})

describe('enterAsGuest', () => {
  it('cleans up, signs in anonymously, seeds the demo and goes home', async () => {
    await enterAsGuest()
    expect(cleanupGuests).toHaveBeenCalledBefore(signInAnonymous)
    expect(await prisma.objective.count({ where: { userId: 'anon-1' } })).toBe(3)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('still creates the guest when cleanup fails', async () => {
    cleanupGuests.mockRejectedValue(new Error('db hiccup'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await enterAsGuest()
    expect(await prisma.objective.count({ where: { userId: 'anon-1' } })).toBe(3)
  })
})
```

If `toHaveBeenCalledBefore` is unavailable in this Vitest version, compare `mock.invocationCallOrder[0]` values instead.

`src/components/guest-button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestButton } from '@/components/guest-button'

describe('GuestButton', () => {
  it('explains the demo and calls onEnter, disabling itself while pending', async () => {
    let resolve!: () => void
    const onEnter = vi.fn(() => new Promise<void>((r) => { resolve = r }))
    render(<GuestButton onEnter={onEnter} />)
    expect(screen.getByText('Conta de demonstração com dados prontos')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Entrar como visitante' })
    await userEvent.click(button)
    expect(onEnter).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    resolve()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/guest/cleanup.test.ts src/lib/actions/guest.test.ts src/components/guest-button.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/lib/guest/cleanup.ts`:

```ts
import { prisma } from '@/lib/db'

export const GUEST_IDLE_MS = 24 * 3600_000
export const MAX_GUESTS = 200

// Runs right before a guest is created, so it keeps MAX_GUESTS - 1 and the
// new one brings the total to the cap. Objectives, goals, tasks, sessions
// and accounts go with each user through the schema's cascades.
export async function cleanupGuests(now: Date = new Date()): Promise<number> {
  const idle = await prisma.user.deleteMany({
    where: { isAnonymous: true, lastSeenAt: { lt: new Date(now.getTime() - GUEST_IDLE_MS) } },
  })

  const overflow = await prisma.user.findMany({
    where: { isAnonymous: true },
    orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
    skip: MAX_GUESTS - 1,
    select: { id: true },
  })
  const capped = overflow.length
    ? await prisma.user.deleteMany({ where: { id: { in: overflow.map((u) => u.id) } } })
    : { count: 0 }

  return idle.count + capped.count
}
```

`src/lib/actions/guest.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { cleanupGuests } from '@/lib/guest/cleanup'
import { seedDemoData } from '@/lib/guest/seed'

export async function enterAsGuest(): Promise<void> {
  try {
    await cleanupGuests()
  } catch (error) {
    // Cleanup is housekeeping: the next guest retries it.
    console.error('Guest cleanup failed', error)
  }

  const result = await auth.api.signInAnonymous({ headers: await headers() })
  if (!result?.user) throw new Error('Não foi possível concluir. Tente de novo.')

  await seedDemoData(result.user.id)
  redirect('/')
}
```

Check the `signInAnonymous` signature and return shape in `node_modules/better-auth` (`plugins/anonymous`). If it returns `{ token, user }` under a different key, adapt both the action and the test mock.

`src/components/guest-button.tsx` (client):

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function GuestButton({ onEnter }: { onEnter: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            await onEnter()
          } catch (error) {
            // redirect() throws to navigate; only real failures reach here as non-redirects.
            if (!(error instanceof Error && error.message === 'NEXT_REDIRECT')) setFailed(true)
            setPending(false)
          }
        }}
      >
        Entrar como visitante
      </Button>
      <p className="text-xs text-muted-foreground">Conta de demonstração com dados prontos</p>
      {failed && <p role="alert" className="text-xs text-destructive">Não foi possível concluir. Tente de novo.</p>}
    </div>
  )
}
```

In `src/app/entrar/page.tsx`, replace the Task 7 placeholder comment with `<GuestButton onEnter={enterAsGuest} />`, placed after the "Criar conta" line, and import both. In the layout order, put the guest card **above** the e-mail form, because recruiters come from the README.

- [ ] **Step 4: Run the tests**

Run: the three files, then `npx vitest run`.
Expected: PASS. The 200-user test is slow but fine.

- [ ] **Step 5: Commit**

Commit message: "feat: guest accounts with demo data and lazy cleanup (24 h idle, cap 200)".

---

### Task 10: Header, user menu, guest banner and logged-out shell

**Files:**
- Create: `src/lib/actions/auth.ts`, `src/components/user-menu.tsx`, `src/components/guest-banner.tsx`
- Modify: `src/components/app-header.tsx`, `src/app/layout.tsx`
- Test: `src/lib/actions/auth.test.ts`, `src/components/user-menu.test.tsx`, `src/components/guest-banner.test.tsx`, `src/components/app-header.test.tsx` (create, or extend if it exists)

**Interfaces:**
- Consumes: `getCurrentUser()`, `CurrentUser`, `auth`.
- Produces:
  - `signOut(destination?: unknown): Promise<void>`, which goes to `/cadastro` only when `destination === '/cadastro'`, and to `/entrar` otherwise.
  - `<UserMenu name isAnonymous onSignOut />`.
  - `<GuestBanner onCreateAccount />`.
  - `AppHeader` gains `user: CurrentUser | null`.

- [ ] **Step 1: Write the failing tests**

`src/lib/actions/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
const apiSignOut = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: { api: { signOut: apiSignOut } } }))

const { signOut } = await import('@/lib/actions/auth')

beforeEach(() => { redirect.mockClear(); apiSignOut.mockReset().mockResolvedValue({ success: true }) })

describe('signOut', () => {
  it('signs out and goes to /entrar by default', async () => {
    await signOut()
    expect(apiSignOut).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith('/entrar')
  })
  it('goes to /cadastro only when asked exactly', async () => {
    await signOut('/cadastro')
    expect(redirect).toHaveBeenCalledWith('/cadastro')
    await signOut('https://evil.example')
    expect(redirect).toHaveBeenLastCalledWith('/entrar')
  })
})
```

`src/components/user-menu.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/user-menu'

describe('UserMenu', () => {
  it('names the user and signs out from the menu', async () => {
    const onSignOut = vi.fn(async () => {})
    render(<UserMenu name="Ana" isAnonymous={false} onSignOut={onSignOut} />)
    await userEvent.click(screen.getByRole('button', { name: 'Conta: Ana' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
  it('shows "Visitante" for guests', () => {
    render(<UserMenu name="Visitante" isAnonymous onSignOut={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Conta: Visitante' })).toBeInTheDocument()
  })
})
```

`src/components/guest-banner.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestBanner } from '@/components/guest-banner'

describe('GuestBanner', () => {
  it('explains the 24 h rule and offers to create an account', async () => {
    const onCreateAccount = vi.fn(async () => {})
    render(<GuestBanner onCreateAccount={onCreateAccount} />)
    expect(screen.getByText('Você está como visitante. Os dados somem após 24 h sem uso.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(onCreateAccount).toHaveBeenCalledOnce()
  })
})
```

`src/components/app-header.test.tsx`. `AppHeader` is an async Server Component: render it with `render(await AppHeader({...}))`, mocking `@/lib/actions/summary`, `@/lib/actions/search` and `next/navigation` (`usePathname`, `useRouter`) as needed.

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/entrar', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
const getTodaySummary = vi.hoisted(() => vi.fn(async () => ({ completed: 1, total: 3, weekStart: new Date(2026, 9, 5) })))
vi.mock('@/lib/actions/summary', () => ({ getTodaySummary }))
vi.mock('@/lib/actions/search', () => ({ search: vi.fn() }))
vi.mock('@/lib/actions/auth', () => ({ signOut: vi.fn() }))

const { AppHeader } = await import('@/components/app-header')
const base = { theme: 'dark' as const, onThemeChange: vi.fn() }

describe('AppHeader', () => {
  it('logged out: no summary, search, nav or user menu, and no summary query', async () => {
    getTodaySummary.mockClear()
    render(await AppHeader({ ...base, user: null }))
    expect(getTodaySummary).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /buscar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /conta:/i })).toBeNull()
    expect(screen.getByRole('link', { name: 'Metas' })).toBeInTheDocument()
  })

  it('logged in: shows the user menu', async () => {
    render(await AppHeader({ ...base, user: { id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false } }))
    expect(screen.getByRole('button', { name: 'Conta: Ana' })).toBeInTheDocument()
  })
})
```

`BackgroundPicker` uses `useBackground()`. If rendering fails without a provider, wrap the render in `<BackgroundProvider initial="nenhum" onChange={vi.fn()}>`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/actions/auth.test.ts src/components/user-menu.test.tsx src/components/guest-banner.test.tsx src/components/app-header.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/actions/auth.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function signOut(destination?: unknown): Promise<void> {
  await auth.api.signOut({ headers: await headers() })
  // Only the two known destinations: never redirect to caller-supplied URLs.
  redirect(destination === '/cadastro' ? '/cadastro' : '/entrar')
}
```

`src/components/user-menu.tsx` (client). It uses the Base UI Menu pattern of `objective-actions-menu.tsx`, with the same `itemClass` and popover tokens:

```tsx
'use client'

import { Menu } from '@base-ui/react/menu'
import { CircleUser } from 'lucide-react'

const itemClass =
  'px-2 py-1.5 text-sm rounded-sm cursor-default outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground'

export function UserMenu({ name, isAnonymous, onSignOut }: { name: string; isAnonymous: boolean; onSignOut: () => Promise<void> }) {
  const label = isAnonymous ? 'Visitante' : name
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Conta: ${label}`}
        className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleUser className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md min-w-40">
            <p className="px-2 py-1.5 text-xs text-muted-foreground truncate">{label}</p>
            <Menu.Item className={itemClass} onClick={() => void onSignOut()}>
              Sair
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
```

`src/components/guest-banner.tsx` (client):

```tsx
'use client'

import { Button } from '@/components/ui/button'

export function GuestBanner({ onCreateAccount }: { onCreateAccount: () => Promise<void> }) {
  return (
    <div role="status" className="border-b border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-8">
        <p className="flex-1">Você está como visitante. Os dados somem após 24 h sem uso.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void onCreateAccount()}>
          Criar conta
        </Button>
      </div>
    </div>
  )
}
```

Use the `Button` sizes and variants that exist in `src/components/ui/button.tsx`; check them there.

`src/components/app-header.tsx`:
- Add the prop `user: CurrentUser | null` (import the type from `@/lib/session`).
- **When `user` is null:** do not call `getTodaySummary`, and render only the logo, the spacer, `BackgroundPicker` and `ThemeToggle`. Skip `HeaderNav`, `SearchDialog`, `DaySummary` and `RefreshOnFocus`.
- **When `user` is set:** render as today, plus `<UserMenu name={user.name} isAnonymous={user.isAnonymous} onSignOut={signOut} />` after `ThemeToggle`, with class `max-md:order-3`.
- **For guests:** render `<GuestBanner onCreateAccount={async () => { 'use server'; await signOut('/cadastro') }} />` directly below the header row, inside the `<header>`.

If an inline `'use server'` closure is not allowed in this file, add `leaveGuestToSignUp()` to `src/lib/actions/auth.ts` (it calls `signOut('/cadastro')`) and pass that instead.

`src/app/layout.tsx`: `const user = await getCurrentUser()`. Pass `user` to `AppHeader`, and render `<BottomNav />` only when `user` is set.

- [ ] **Step 4: Run the tests**

Run: the four files, then `npx vitest run`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: "feat: user menu, guest banner and a logged-out header". List the layout, the bottom nav hidden when logged out and the `signOut` destinations.

---

### Task 11: README and manual verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

- **Intro, under the "Ver online" line:** replace the note "A versão online é uma demonstração sem login…" with: "Entre como visitante para ver uma conta de demonstração com dados prontos (apagada após 24 h sem uso), ou crie sua conta com e-mail e senha."
- **Features:** add a bullet "**Contas e modo visitante:** login com e-mail e senha (Better Auth) e visitante com dados fictícios gerados na hora; cada pessoa só vê os próprios dados."
- **Design decisions:** add a bullet "**Isolamento por usuário testado.** Toda consulta filtra pelo dono, e registros de outra pessoa se comportam como inexistentes; cada módulo de dados tem testes garantindo isso."
- **Como rodar, step 2:** mention that `.env.example` now includes `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `FUNNEL_PUBLIC`, and that the secret must be changed.
- **Testes, step 2:** `.env.test` also needs `BETTER_AUTH_SECRET`.
- **Stack:** add "[Better Auth](https://www.better-auth.com/) para contas e sessões".

- [ ] **Step 2: Run the full suite and the type check**

Run: `npx vitest run` and `npx tsc --noEmit`.
Expected: all tests pass; no new type errors beyond the 4 known pre-existing fixture files.

- [ ] **Step 3: Manual check on the dev server** (controller: use the browser preview; do not run `next build` in the repo)

Check each of these:
- Logged out: `/` redirects to `/entrar`, and `/funil` opens.
- Sign up: lands on the quiz. Log out, log back in, and a wrong password shows the error.
- Guest: the banner shows, the charts and the streak have content, and Hoje has open and checked tasks.
- A second browser profile (or incognito) with another account sees none of the first account's data. Opening the first account's objective URL shows not found.
- At 375px: no horizontal scroll, the user menu is reachable, and the banner wraps.

- [ ] **Step 4: Commit**

Commit message: "docs: describe accounts, guest mode and the new env vars in the README".
