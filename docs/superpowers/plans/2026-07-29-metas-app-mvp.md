# Metas App MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of a personal daily/weekly goals app: full CRUD across Objective → WeeklyGoal → DailyTask, a Today view, a Week view, and a progress chart per Objective.

**Architecture:** Next.js App Router (TypeScript) fullstack app. Prisma 6 talks to a local PostgreSQL instance (via Docker Compose) for both dev and test. Mutations go through Next.js Server Actions colocated in `src/lib/actions/`; reads happen directly in async Server Components. UI is composed from shadcn/ui primitives on top of Tailwind CSS. Interactive leaf pieces (toggle buttons, delete buttons, forms) are small Client Components, unit-tested with Vitest + React Testing Library; page-level Server Components are verified manually in the browser (Next.js doesn't yet support unit-testing async Server Components directly).

**Tech Stack:** Next.js (App Router, `src/` dir), TypeScript (strict), Tailwind CSS, shadcn/ui, Prisma 6.x (`prisma-client-js` generator, no driver adapter), PostgreSQL 16 (Docker Compose), Vitest + @testing-library/react + jsdom, date-fns, Recharts, npm.

## Global Constraints

- Package manager: npm only (no yarn/pnpm lockfiles).
- Next.js App Router with `src/` directory and `@/*` import alias.
- Prisma major version pinned to `^6` — classic `prisma-client-js` generator, `PrismaClient` imported from `@prisma/client`, no `@prisma/adapter-*` package. Do not upgrade to Prisma 7 as part of this plan.
- Dev database name: `metas_app`. Test database name: `metas_app_test`. Both live in the same Docker Postgres container, user/password `metas`/`metas`, port 5432.
- Week convention: weeks run Monday → Sunday (`date-fns` `startOfWeek`/`endOfWeek` with `weekStartsOn: 1`).
- No authentication in this plan.
- `.env` and `.env.test` hold real connection strings and must never be committed; `.env.example` is the committed template.
- Every task that touches logic (Prisma queries, Server Actions, date math, interactive components) follows red/green TDD: failing test first, then minimal implementation.
- Commit after each task using `git add <files touched by this task>` (never `git add -A`).

---

## Task 1: Project scaffold, Tailwind, shadcn/ui

**Files:**
- Create: entire Next.js scaffold (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `components.json`, `src/components/ui/*`)
- Modify: `.gitignore` (created by scaffold)

**Interfaces:**
- Produces: a working Next.js dev/build pipeline and shadcn/ui primitives under `src/components/ui/` (`button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `checkbox.tsx`, `dialog.tsx`, `progress.tsx`, `separator.tsx`) that later tasks import from `@/components/ui/*`.

- [ ] **Step 1: Scaffold Next.js into a temp subfolder (the target folder already has `.git` and `docs/`, so scaffold in isolation and merge)**

Run from `C:\Users\João Vítor Mamede\projects\metas-app`:

```powershell
npx create-next-app@latest scaffold-tmp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-git
```

If the CLI prompts interactively despite the flags, accept: TypeScript = yes, ESLint = yes, Tailwind = yes, `src/` directory = yes, App Router = yes, import alias = `@/*`, Turbopack = default.

- [ ] **Step 2: Merge scaffold into the project root and remove the temp folder**

```powershell
Get-ChildItem -Path .\scaffold-tmp -Force | Move-Item -Destination .
Remove-Item -Path .\scaffold-tmp -Recurse -Force
```

- [ ] **Step 3: Initialize shadcn/ui and add the base components this plan needs**

```powershell
npx shadcn@latest init -d
npx shadcn@latest add button card input label checkbox dialog progress separator -y
```

- [ ] **Step 4: Replace the default home page with a minimal Hello card to prove Tailwind + shadcn/ui render together**

`src/app/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Metas</CardTitle>
        </CardHeader>
        <CardContent>
          <Button>Começar</Button>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no type or lint errors, and the output lists `/` as a route.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js app with Tailwind and shadcn/ui"
```

---

## Task 2: Postgres via Docker Compose (dev + test databases)

**Files:**
- Create: `docker-compose.yml`, `docker/init-test-db.sql`, `.env.example`, `.env` (untracked), `.env.test` (untracked)
- Modify: `.gitignore`

**Interfaces:**
- Produces: a running Postgres container reachable at `localhost:5432` with two databases — `metas_app` (dev) and `metas_app_test` (test) — and `DATABASE_URL` in `.env` / `.env.test` pointing at each. Later tasks (Prisma migrations, Vitest setup) depend on both databases existing.

- [ ] **Step 1: Add the Compose file**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: metas
      POSTGRES_PASSWORD: metas
      POSTGRES_DB: metas_app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro

volumes:
  pgdata:
```

- [ ] **Step 2: Add the init script that creates the second (test) database**

`docker/init-test-db.sql`:

```sql
CREATE DATABASE metas_app_test;
```

- [ ] **Step 3: Add env files**

`.env.example` (committed):

```
DATABASE_URL="postgresql://metas:metas@localhost:5432/metas_app"
```

`.env` (untracked, real dev value):

```
DATABASE_URL="postgresql://metas:metas@localhost:5432/metas_app"
```

`.env.test` (untracked, real test value):

```
DATABASE_URL="postgresql://metas:metas@localhost:5432/metas_app_test"
```

- [ ] **Step 4: Ignore the untracked env files**

Append to `.gitignore` (if not already covered):

```
.env
.env.test
```

- [ ] **Step 5: Start the container and verify both databases exist**

```powershell
docker compose up -d
docker compose exec -T db psql -U metas -d postgres -c "\l"
```

Expected: the listing includes both `metas_app` and `metas_app_test`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml docker/init-test-db.sql .env.example .gitignore
git commit -m "chore: add Docker Compose Postgres with dev and test databases"
```

---

## Task 3: Prisma schema, client singleton, Vitest harness, smoke test

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `vitest.config.ts`, `src/test/setup.ts`, `src/lib/db.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Produces:
  - `prisma` — exported `PrismaClient` singleton from `src/lib/db.ts`, imported as `import { prisma } from '@/lib/db'` everywhere data is read/written.
  - Models: `Objective`, `WeeklyGoal`, `DailyTask`, enum `Status` (`ACTIVE | COMPLETED | ABANDONED`).
  - Vitest config that loads `.env.test` and resets all three tables after every test via `src/test/setup.ts`.

- [ ] **Step 1: Install Prisma (pinned to major 6) and the testing toolchain**

```powershell
npm install prisma@6 @prisma/client@6
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event vite-tsconfig-paths dotenv dotenv-cli
```

- [ ] **Step 2: Write the Prisma schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Objective {
  id          String       @id @default(cuid())
  title       String
  description String?
  startDate   DateTime
  targetDate  DateTime?
  status      Status       @default(ACTIVE)
  weeklyGoals WeeklyGoal[]
  createdAt   DateTime     @default(now())
}

model WeeklyGoal {
  id          String      @id @default(cuid())
  title       String
  objective   Objective   @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  objectiveId String
  weekStart   DateTime
  weekEnd     DateTime
  status      Status      @default(ACTIVE)
  dailyTasks  DailyTask[]
}

model DailyTask {
  id           String     @id @default(cuid())
  title        String
  weeklyGoal   WeeklyGoal @relation(fields: [weeklyGoalId], references: [id], onDelete: Cascade)
  weeklyGoalId String
  date         DateTime
  completed    Boolean    @default(false)
  completedAt  DateTime?
}

enum Status {
  ACTIVE
  COMPLETED
  ABANDONED
}
```

`onDelete: Cascade` on both relations so deleting an Objective or WeeklyGoal (part of the MVP CRUD) removes its children instead of failing on a foreign key constraint.

- [ ] **Step 3: Run the initial migration against the dev database**

```powershell
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/<timestamp>_init/`, applies it to `metas_app`, and generates the Prisma Client.

- [ ] **Step 4: Apply the same migration to the test database**

Add to `package.json` `scripts`:

```json
"test:migrate": "dotenv -e .env.test -- prisma migrate deploy"
```

Run: `npm run test:migrate`
Expected: `metas_app_test` now has the same schema.

- [ ] **Step 5: Add the Prisma client singleton**

`src/lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 6: Configure Vitest to run against the test database with jsdom**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { config } from 'dotenv'

config({ path: '.env.test' })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { prisma } from '@/lib/db'

afterEach(async () => {
  cleanup()
  await prisma.dailyTask.deleteMany()
  await prisma.weeklyGoal.deleteMany()
  await prisma.objective.deleteMany()
})
```

Add to `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Write the smoke test (failing first)**

`src/lib/db.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'

describe('prisma test database', () => {
  it('creates and reads an Objective', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Aprender React', startDate: new Date('2026-01-01') },
    })

    const found = await prisma.objective.findUnique({ where: { id: objective.id } })

    expect(found?.title).toBe('Aprender React')
  })
})
```

Run: `npm run test` — this should already pass once Steps 1-6 are done (there's no separate "red" state here since the schema/migration must exist before the test file can even type-check). If it fails, the failure must be a Prisma/connection error, not a missing-module error — fix the harness before moving on.

- [ ] **Step 8: Verify the test passes**

Run: `npm run test`
Expected: 1 passed.

- [ ] **Step 9: Commit**

```bash
git add prisma package.json package-lock.json src/lib/db.ts src/lib/db.test.ts vitest.config.ts src/test/setup.ts
git commit -m "feat: add Prisma schema, client singleton, and Vitest harness against test DB"
```

---

## Task 4: Week boundary helper (date-fns)

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/dates.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date }` — Monday 00:00:00 through Sunday 23:59:59.999 of the week containing `date`. Used by `weeklyGoals` actions (Task 6) and the Week view (Task 12).

- [ ] **Step 1: Install date-fns**

```powershell
npm install date-fns
```

- [ ] **Step 2: Write the failing test**

`src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getWeekBounds } from '@/lib/dates'

describe('getWeekBounds', () => {
  it('returns Monday through Sunday for a mid-week date', () => {
    const wednesday = new Date('2026-07-29T12:00:00')
    const { weekStart, weekEnd } = getWeekBounds(wednesday)

    expect(weekStart.getDay()).toBe(1) // Monday
    expect(weekStart.getDate()).toBe(27)
    expect(weekEnd.getDay()).toBe(0) // Sunday
    expect(weekEnd.getDate()).toBe(2) // Aug 2
  })

  it('keeps a Monday as its own week start', () => {
    const monday = new Date('2026-07-27T09:00:00')
    const { weekStart } = getWeekBounds(monday)

    expect(weekStart.getDate()).toBe(27)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- dates.test`
Expected: FAIL — `@/lib/dates` has no exported member `getWeekBounds` (module doesn't exist yet).

- [ ] **Step 4: Implement**

`src/lib/dates.ts`:

```ts
import { startOfWeek, endOfWeek } from 'date-fns'

export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return {
    weekStart: startOfWeek(date, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(date, { weekStartsOn: 1 }),
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- dates.test`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts package.json package-lock.json
git commit -m "feat: add Monday-Sunday week boundary helper"
```

---

## Task 5: Objective Server Actions (CRUD)

**Files:**
- Create: `src/lib/actions/objectives.ts`, `src/lib/actions/objectives.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (Task 3).
- Produces (all in `src/lib/actions/objectives.ts`, all `'use server'`):
  - `createObjective(formData: FormData): Promise<void>` — reads `title`, `description`, `startDate`, `targetDate` fields.
  - `listObjectives(): Promise<Objective[]>` — ordered by `createdAt` desc.
  - `getObjective(id: string): Promise<Objective | null>`
  - `updateObjective(id: string, formData: FormData): Promise<void>`
  - `deleteObjective(id: string): Promise<void>`

  Used by the Objectives UI (Task 8) and the progress chart (Task 13).

- [ ] **Step 1: Write the failing tests**

`src/lib/actions/objectives.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  createObjective,
  deleteObjective,
  getObjective,
  listObjectives,
  updateObjective,
} from '@/lib/actions/objectives'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

describe('objective actions', () => {
  it('creates an objective from form data', async () => {
    await createObjective(formData({ title: 'Aprender React', startDate: '2026-01-01' }))

    const all = await prisma.objective.findMany()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Aprender React')
    expect(all[0].status).toBe('ACTIVE')
  })

  it('lists objectives newest first', async () => {
    const first = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await prisma.objective.create({ data: { title: 'B', startDate: new Date() } })

    const result = await listObjectives()

    expect(result.map((o) => o.id)).toEqual([second.id, first.id])
  })

  it('gets a single objective by id', async () => {
    const created = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })

    const found = await getObjective(created.id)

    expect(found?.title).toBe('A')
  })

  it('updates an objective', async () => {
    const created = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })

    await updateObjective(created.id, formData({ title: 'B', startDate: '2026-02-01' }))

    const updated = await prisma.objective.findUnique({ where: { id: created.id } })
    expect(updated?.title).toBe('B')
  })

  it('deletes an objective', async () => {
    const created = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })

    await deleteObjective(created.id)

    const found = await prisma.objective.findUnique({ where: { id: created.id } })
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- objectives.test`
Expected: FAIL — `@/lib/actions/objectives` doesn't exist.

- [ ] **Step 3: Implement**

`src/lib/actions/objectives.ts`:

```ts
'use server'

import { prisma } from '@/lib/db'
import type { Objective } from '@prisma/client'

function readObjectiveFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const description = formData.get('description')
  const startDate = String(formData.get('startDate') ?? '')
  const targetDate = formData.get('targetDate')

  return {
    title,
    description: description ? String(description) : null,
    startDate: new Date(startDate),
    targetDate: targetDate ? new Date(String(targetDate)) : null,
  }
}

export async function createObjective(formData: FormData): Promise<void> {
  await prisma.objective.create({ data: readObjectiveFields(formData) })
}

export async function listObjectives(): Promise<Objective[]> {
  return prisma.objective.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getObjective(id: string): Promise<Objective | null> {
  return prisma.objective.findUnique({ where: { id } })
}

export async function updateObjective(id: string, formData: FormData): Promise<void> {
  await prisma.objective.update({ where: { id }, data: readObjectiveFields(formData) })
}

export async function deleteObjective(id: string): Promise<void> {
  await prisma.objective.delete({ where: { id } })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- objectives.test`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/objectives.ts src/lib/actions/objectives.test.ts
git commit -m "feat: add Objective CRUD server actions"
```

---

## Task 6: WeeklyGoal Server Actions (CRUD + progress)

**Files:**
- Create: `src/lib/actions/weeklyGoals.ts`, `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `getWeekBounds` from `@/lib/dates` (Task 4).
- Produces (all in `src/lib/actions/weeklyGoals.ts`, all `'use server'`):
  - `createWeeklyGoal(objectiveId: string, formData: FormData): Promise<void>` — reads `title` and `weekOf` (any date inside the target week); computes `weekStart`/`weekEnd` via `getWeekBounds`.
  - `listWeeklyGoalsByObjective(objectiveId: string): Promise<WeeklyGoal[]>` — ordered by `weekStart` asc.
  - `getWeeklyGoal(id: string): Promise<WeeklyGoal | null>`
  - `updateWeeklyGoal(id: string, formData: FormData): Promise<void>`
  - `deleteWeeklyGoal(id: string): Promise<void>`
  - `getWeekProgress(weeklyGoalId: string): Promise<{ total: number; completed: number; percent: number }>`
  - `listWeeklyGoalsForCurrentWeek(): Promise<Array<WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }>>` — all weekly goals whose `weekStart`/`weekEnd` cover today, across every objective. Used by the Week view (Task 12).

  Used by the WeeklyGoals UI (Task 9) and the Week view (Task 12).

- [ ] **Step 1: Write the failing tests**

`src/lib/actions/weeklyGoals.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  getWeekProgress,
  getWeeklyGoal,
  listWeeklyGoalsByObjective,
  listWeeklyGoalsForCurrentWeek,
  updateWeeklyGoal,
} from '@/lib/actions/weeklyGoals'
import { getWeekBounds } from '@/lib/dates'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

async function makeObjective() {
  return prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
}

describe('weekly goal actions', () => {
  it('creates a weekly goal with computed Monday-Sunday bounds', async () => {
    const objective = await makeObjective()

    await createWeeklyGoal(objective.id, formData({ title: 'Correr 3x', weekOf: '2026-07-29' }))

    const goals = await prisma.weeklyGoal.findMany()
    expect(goals).toHaveLength(1)
    expect(goals[0].weekStart.getDate()).toBe(27)
    expect(goals[0].weekEnd.getDate()).toBe(2)
  })

  it('lists weekly goals for an objective ordered by week start', async () => {
    const objective = await makeObjective()
    const later = getWeekBounds(new Date('2026-08-10'))
    const earlier = getWeekBounds(new Date('2026-07-29'))
    const laterGoal = await prisma.weeklyGoal.create({
      data: { title: 'Later', objectiveId: objective.id, ...later },
    })
    const earlierGoal = await prisma.weeklyGoal.create({
      data: { title: 'Earlier', objectiveId: objective.id, ...earlier },
    })

    const result = await listWeeklyGoalsByObjective(objective.id)

    expect(result.map((g) => g.id)).toEqual([earlierGoal.id, laterGoal.id])
  })

  it('gets, updates, and deletes a weekly goal', async () => {
    const objective = await makeObjective()
    const bounds = getWeekBounds(new Date('2026-07-29'))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Original', objectiveId: objective.id, ...bounds },
    })

    expect((await getWeeklyGoal(goal.id))?.title).toBe('Original')

    await updateWeeklyGoal(goal.id, formData({ title: 'Renamed', weekOf: '2026-07-29' }))
    expect((await prisma.weeklyGoal.findUnique({ where: { id: goal.id } }))?.title).toBe('Renamed')

    await deleteWeeklyGoal(goal.id)
    expect(await prisma.weeklyGoal.findUnique({ where: { id: goal.id } })).toBeNull()
  })

  it('computes week progress from daily tasks', async () => {
    const objective = await makeObjective()
    const bounds = getWeekBounds(new Date('2026-07-29'))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Goal', objectiveId: objective.id, ...bounds },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'A', weeklyGoalId: goal.id, date: new Date('2026-07-27'), completed: true },
        { title: 'B', weeklyGoalId: goal.id, date: new Date('2026-07-28'), completed: false },
      ],
    })

    const progress = await getWeekProgress(goal.id)

    expect(progress).toEqual({ total: 2, completed: 1, percent: 50 })
  })

  it('lists weekly goals covering the current week across objectives', async () => {
    const objective = await makeObjective()
    const currentBounds = getWeekBounds(new Date())
    const currentGoal = await prisma.weeklyGoal.create({
      data: { title: 'Current', objectiveId: objective.id, ...currentBounds },
    })
    const pastBounds = getWeekBounds(new Date('2020-01-06'))
    await prisma.weeklyGoal.create({
      data: { title: 'Past', objectiveId: objective.id, ...pastBounds },
    })

    const result = await listWeeklyGoalsForCurrentWeek()

    expect(result.map((g) => g.id)).toEqual([currentGoal.id])
    expect(result[0].objective.id).toBe(objective.id)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- weeklyGoals.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

`src/lib/actions/weeklyGoals.ts`:

```ts
'use server'

import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import type { WeeklyGoal } from '@prisma/client'

function readWeeklyGoalFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const weekOf = String(formData.get('weekOf') ?? '')
  const { weekStart, weekEnd } = getWeekBounds(new Date(weekOf))

  return { title, weekStart, weekEnd }
}

export async function createWeeklyGoal(objectiveId: string, formData: FormData): Promise<void> {
  const fields = readWeeklyGoalFields(formData)
  await prisma.weeklyGoal.create({ data: { ...fields, objectiveId } })
}

export async function listWeeklyGoalsByObjective(objectiveId: string): Promise<WeeklyGoal[]> {
  return prisma.weeklyGoal.findMany({ where: { objectiveId }, orderBy: { weekStart: 'asc' } })
}

export async function getWeeklyGoal(id: string): Promise<WeeklyGoal | null> {
  return prisma.weeklyGoal.findUnique({ where: { id } })
}

export async function updateWeeklyGoal(id: string, formData: FormData): Promise<void> {
  await prisma.weeklyGoal.update({ where: { id }, data: readWeeklyGoalFields(formData) })
}

export async function deleteWeeklyGoal(id: string): Promise<void> {
  await prisma.weeklyGoal.delete({ where: { id } })
}

export async function getWeekProgress(
  weeklyGoalId: string,
): Promise<{ total: number; completed: number; percent: number }> {
  const tasks = await prisma.dailyTask.findMany({ where: { weeklyGoalId } })
  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

export async function listWeeklyGoalsForCurrentWeek() {
  const { weekStart, weekEnd } = getWeekBounds(new Date())
  return prisma.weeklyGoal.findMany({
    where: { weekStart: { equals: weekStart }, weekEnd: { equals: weekEnd } },
    include: { objective: true, dailyTasks: true },
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- weeklyGoals.test`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add WeeklyGoal CRUD server actions and progress calculation"
```

---

## Task 7: DailyTask Server Actions (CRUD + toggle)

**Files:**
- Create: `src/lib/actions/dailyTasks.ts`, `src/lib/actions/dailyTasks.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3).
- Produces (all in `src/lib/actions/dailyTasks.ts`, all `'use server'`):
  - `createDailyTask(weeklyGoalId: string, formData: FormData): Promise<void>` — reads `title`, `date`.
  - `listDailyTasksByWeeklyGoal(weeklyGoalId: string): Promise<DailyTask[]>` — ordered by `date` asc.
  - `listDailyTasksByDate(date: Date): Promise<Array<DailyTask & { weeklyGoal: WeeklyGoal & { objective: Objective } }>>` — all tasks whose `date` falls on the given calendar day, across every objective.
  - `getDailyTask(id: string): Promise<DailyTask | null>`
  - `updateDailyTask(id: string, formData: FormData): Promise<void>` — reads `title`, `date`; does not touch `completed`/`completedAt`.
  - `toggleDailyTask(id: string): Promise<void>` — flips `completed`, sets/clears `completedAt`.
  - `deleteDailyTask(id: string): Promise<void>`

  Used by the DailyTasks UI (Task 10) and the Today view (Task 11).

- [ ] **Step 1: Write the failing tests**

`src/lib/actions/dailyTasks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  createDailyTask,
  deleteDailyTask,
  getDailyTask,
  listDailyTasksByDate,
  listDailyTasksByWeeklyGoal,
  toggleDailyTask,
  updateDailyTask,
} from '@/lib/actions/dailyTasks'
import { getWeekBounds } from '@/lib/dates'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

async function makeWeeklyGoal() {
  const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
  const bounds = getWeekBounds(new Date('2026-07-29'))
  return prisma.weeklyGoal.create({ data: { title: 'Goal', objectiveId: objective.id, ...bounds } })
}

describe('daily task actions', () => {
  it('creates a daily task from form data', async () => {
    const goal = await makeWeeklyGoal()

    await createDailyTask(goal.id, formData({ title: 'Correr 5km', date: '2026-07-29' }))

    const tasks = await prisma.dailyTask.findMany()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Correr 5km')
    expect(tasks[0].completed).toBe(false)
  })

  it('lists tasks for a weekly goal ordered by date', async () => {
    const goal = await makeWeeklyGoal()
    const later = await prisma.dailyTask.create({
      data: { title: 'Later', weeklyGoalId: goal.id, date: new Date('2026-07-30') },
    })
    const earlier = await prisma.dailyTask.create({
      data: { title: 'Earlier', weeklyGoalId: goal.id, date: new Date('2026-07-28') },
    })

    const result = await listDailyTasksByWeeklyGoal(goal.id)

    expect(result.map((t) => t.id)).toEqual([earlier.id, later.id])
  })

  it('lists tasks for a specific date across weekly goals, with objective included', async () => {
    const goal = await makeWeeklyGoal()
    const match = await prisma.dailyTask.create({
      data: { title: 'Today task', weeklyGoalId: goal.id, date: new Date('2026-07-29T08:00:00') },
    })
    await prisma.dailyTask.create({
      data: { title: 'Other day', weeklyGoalId: goal.id, date: new Date('2026-07-30') },
    })

    const result = await listDailyTasksByDate(new Date('2026-07-29T23:00:00'))

    expect(result.map((t) => t.id)).toEqual([match.id])
    expect(result[0].weeklyGoal.objective.title).toBe('Obj')
  })

  it('gets and updates a task without touching its completed state', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Original', weeklyGoalId: goal.id, date: new Date('2026-07-29'), completed: true },
    })

    expect((await getDailyTask(task.id))?.title).toBe('Original')

    await updateDailyTask(task.id, formData({ title: 'Renamed', date: '2026-07-30' }))

    const updated = await prisma.dailyTask.findUnique({ where: { id: task.id } })
    expect(updated?.title).toBe('Renamed')
    expect(updated?.date.getDate()).toBe(30)
    expect(updated?.completed).toBe(true)
  })

  it('toggles completion and stamps completedAt', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Task', weeklyGoalId: goal.id, date: new Date('2026-07-29') },
    })

    await toggleDailyTask(task.id)
    const completed = await prisma.dailyTask.findUnique({ where: { id: task.id } })
    expect(completed?.completed).toBe(true)
    expect(completed?.completedAt).not.toBeNull()

    await toggleDailyTask(task.id)
    const uncompleted = await prisma.dailyTask.findUnique({ where: { id: task.id } })
    expect(uncompleted?.completed).toBe(false)
    expect(uncompleted?.completedAt).toBeNull()
  })

  it('deletes a task', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Task', weeklyGoalId: goal.id, date: new Date('2026-07-29') },
    })

    await deleteDailyTask(task.id)

    expect(await prisma.dailyTask.findUnique({ where: { id: task.id } })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- dailyTasks.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

`src/lib/actions/dailyTasks.ts`:

```ts
'use server'

import { prisma } from '@/lib/db'
import type { DailyTask } from '@prisma/client'

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export async function createDailyTask(weeklyGoalId: string, formData: FormData): Promise<void> {
  const title = String(formData.get('title') ?? '').trim()
  const date = String(formData.get('date') ?? '')

  await prisma.dailyTask.create({ data: { title, date: new Date(date), weeklyGoalId } })
}

export async function listDailyTasksByWeeklyGoal(weeklyGoalId: string): Promise<DailyTask[]> {
  return prisma.dailyTask.findMany({ where: { weeklyGoalId }, orderBy: { date: 'asc' } })
}

export async function getDailyTask(id: string): Promise<DailyTask | null> {
  return prisma.dailyTask.findUnique({ where: { id } })
}

export async function updateDailyTask(id: string, formData: FormData): Promise<void> {
  const title = String(formData.get('title') ?? '').trim()
  const date = String(formData.get('date') ?? '')

  await prisma.dailyTask.update({ where: { id }, data: { title, date: new Date(date) } })
}

export async function listDailyTasksByDate(date: Date) {
  return prisma.dailyTask.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: { weeklyGoal: { include: { objective: true } } },
    orderBy: { date: 'asc' },
  })
}

export async function toggleDailyTask(id: string): Promise<void> {
  const task = await prisma.dailyTask.findUniqueOrThrow({ where: { id } })
  await prisma.dailyTask.update({
    where: { id },
    data: { completed: !task.completed, completedAt: task.completed ? null : new Date() },
  })
}

export async function deleteDailyTask(id: string): Promise<void> {
  await prisma.dailyTask.delete({ where: { id } })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- dailyTasks.test`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/dailyTasks.ts src/lib/actions/dailyTasks.test.ts
git commit -m "feat: add DailyTask CRUD and toggle server actions"
```

---

## Task 8: Objectives UI (list, create, edit, delete)

**Files:**
- Create: `src/components/objective-form.tsx`, `src/components/delete-button.tsx`, `src/app/objectives/page.tsx`, `src/app/objectives/new/page.tsx`, `src/app/objectives/[id]/edit/page.tsx`, `src/components/delete-button.test.tsx`, `src/components/objective-form.test.tsx`

**Interfaces:**
- Consumes: `createObjective`, `listObjectives`, `getObjective`, `updateObjective`, `deleteObjective` (Task 5).
- Produces:
  - `ObjectiveForm` client component — props: `{ action: (formData: FormData) => Promise<void>; defaultValues?: { title: string; description?: string | null; startDate: string; targetDate?: string | null } }`. Reused by WeeklyGoal/DailyTask forms in Tasks 9-10 with the same prop shape.
  - `DeleteButton` client component — props: `{ action: () => Promise<void>; label?: string }`. Reused in Tasks 9-10.

- [ ] **Step 1: Write the failing component tests**

`src/components/delete-button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteButton } from '@/components/delete-button'

describe('DeleteButton', () => {
  it('calls the action when clicked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<DeleteButton action={action} />)

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))

    expect(action).toHaveBeenCalledOnce()
  })
})
```

`src/components/objective-form.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectiveForm } from '@/components/objective-form'

describe('ObjectiveForm', () => {
  it('submits the entered title and start date', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Aprender React')
    await userEvent.type(screen.getByLabelText(/início/i), '2026-07-29')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(action).toHaveBeenCalledOnce()
    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Aprender React')
    expect(submitted.get('startDate')).toBe('2026-07-29')
  })

  it('pre-fills fields from defaultValues', () => {
    render(
      <ObjectiveForm
        action={vi.fn()}
        defaultValues={{ title: 'Existing', startDate: '2026-01-01' }}
      />,
    )

    expect(screen.getByLabelText(/título/i)).toHaveValue('Existing')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- delete-button.test objective-form.test`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement the shared components**

`src/components/delete-button.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'

export function DeleteButton({
  action,
  label = 'Excluir',
}: {
  action: () => Promise<void>
  label?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={isPending}
      onClick={() => startTransition(() => action())}
    >
      {label}
    </Button>
  )
}
```

`src/components/objective-form.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ObjectiveForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: {
    title: string
    description?: string | null
    startDate: string
    targetDate?: string | null
  }
}) {
  return (
    <form
      action={action}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" defaultValue={defaultValues?.description ?? ''} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate">Início</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          required
          defaultValue={defaultValues?.startDate}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetDate">Meta para</Label>
        <Input
          id="targetDate"
          name="targetDate"
          type="date"
          defaultValue={defaultValues?.targetDate ?? ''}
        />
      </div>
      <Button type="submit">Salvar</Button>
    </form>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- delete-button.test objective-form.test`
Expected: 3 passed.

- [ ] **Step 5: Wire up the pages (Server Components, no automated test — verify manually in the browser)**

`src/app/objectives/page.tsx`:

```tsx
import Link from 'next/link'
import { listObjectives } from '@/lib/actions/objectives'
import { deleteObjective } from '@/lib/actions/objectives'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ObjectivesPage() {
  const objectives = await listObjectives()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Objetivos</h1>
        <Button asChild>
          <Link href="/objectives/new">Novo objetivo</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {objectives.map((objective) => (
          <Card key={objective.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/objectives/${objective.id}`}>{objective.title}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{objective.status}</span>
              <div className="flex gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/objectives/${objective.id}/edit`}>Editar</Link>
                </Button>
                <DeleteButton action={deleteObjective.bind(null, objective.id)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
```

`src/app/objectives/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createObjective } from '@/lib/actions/objectives'
import { ObjectiveForm } from '@/components/objective-form'

export default function NewObjectivePage() {
  async function action(formData: FormData) {
    'use server'
    await createObjective(formData)
    redirect('/objectives')
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Novo objetivo</h1>
      <ObjectiveForm action={action} />
    </main>
  )
}
```

`src/app/objectives/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getObjective, updateObjective } from '@/lib/actions/objectives'
import { ObjectiveForm } from '@/components/objective-form'

export default async function EditObjectivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateObjective(id, formData)
    redirect('/objectives')
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar objetivo</h1>
      <ObjectiveForm
        action={action}
        defaultValues={{
          title: objective.title,
          description: objective.description,
          startDate: objective.startDate.toISOString().slice(0, 10),
          targetDate: objective.targetDate?.toISOString().slice(0, 10) ?? null,
        }}
      />
    </main>
  )
}
```

Manual verification: `npm run dev`, open `http://localhost:3000/objectives`, create an objective, edit it, delete it — confirm the list updates each time (Server Actions call `revalidatePath`-free here because the whole page re-renders on navigation after `redirect`; the list itself re-fetches on every request since it's a Server Component).

- [ ] **Step 6: Commit**

```bash
git add src/components/objective-form.tsx src/components/objective-form.test.tsx src/components/delete-button.tsx src/components/delete-button.test.tsx src/app/objectives
git commit -m "feat: add Objectives list, create, edit, and delete UI"
```

---

## Task 9: WeeklyGoals UI (nested under an Objective)

**Files:**
- Create: `src/components/weekly-goal-form.tsx`, `src/app/objectives/[id]/page.tsx`, `src/app/objectives/[id]/weeks/new/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx`, `src/components/weekly-goal-form.test.tsx`

**Interfaces:**
- Consumes: `getObjective` (Task 5); `createWeeklyGoal`, `listWeeklyGoalsByObjective`, `getWeeklyGoal`, `updateWeeklyGoal`, `deleteWeeklyGoal`, `getWeekProgress` (Task 6); `ObjectiveForm`'s sibling `DeleteButton` (Task 8).
- Produces: `WeeklyGoalForm` client component — props: `{ action: (formData: FormData) => Promise<void>; defaultValues?: { title: string; weekOf: string } }`.

- [ ] **Step 1: Write the failing component test**

`src/components/weekly-goal-form.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

describe('WeeklyGoalForm', () => {
  it('submits title and the reference week date', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<WeeklyGoalForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Correr 3x')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-07-29')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Correr 3x')
    expect(submitted.get('weekOf')).toBe('2026-07-29')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- weekly-goal-form.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

`src/components/weekly-goal-form.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function WeeklyGoalForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: { title: string; weekOf: string }
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weekOf">Semana de</Label>
        <Input
          id="weekOf"
          name="weekOf"
          type="date"
          required
          defaultValue={defaultValues?.weekOf}
        />
      </div>
      <Button type="submit">Salvar</Button>
    </form>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- weekly-goal-form.test`
Expected: 1 passed.

- [ ] **Step 5: Wire up the pages (manual browser verification)**

`src/app/objectives/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getObjective } from '@/lib/actions/objectives'
import { deleteWeeklyGoal, getWeekProgress, listWeeklyGoalsByObjective } from '@/lib/actions/weeklyGoals'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  const weeklyGoals = await listWeeklyGoalsByObjective(id)
  const progressByGoal = await Promise.all(weeklyGoals.map((g) => getWeekProgress(g.id)))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{objective.title}</h1>
        <Button asChild>
          <Link href={`/objectives/${id}/weeks/new`}>Nova meta semanal</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {weeklyGoals.map((goal, i) => (
          <Card key={goal.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/objectives/${id}/weeks/${goal.id}`}>{goal.title}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Progress value={progressByGoal[i].percent} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {progressByGoal[i].completed}/{progressByGoal[i].total} tarefas
                </span>
                <div className="flex gap-2">
                  <Button asChild variant="secondary">
                    <Link href={`/objectives/${id}/weeks/${goal.id}/edit`}>Editar</Link>
                  </Button>
                  <DeleteButton action={deleteWeeklyGoal.bind(null, goal.id)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
```

`src/app/objectives/[id]/weeks/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

export default function NewWeeklyGoalPage({ params }: { params: Promise<{ id: string }> }) {
  async function action(formData: FormData) {
    'use server'
    const { id } = await params
    await createWeeklyGoal(id, formData)
    redirect(`/objectives/${id}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Nova meta semanal</h1>
      <WeeklyGoalForm action={action} />
    </main>
  )
}
```

`src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getWeeklyGoal, updateWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

export default async function EditWeeklyGoalPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id, weekId } = await params
  const goal = await getWeeklyGoal(weekId)
  if (!goal) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateWeeklyGoal(weekId, formData)
    redirect(`/objectives/${id}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar meta semanal</h1>
      <WeeklyGoalForm
        action={action}
        defaultValues={{ title: goal.title, weekOf: goal.weekStart.toISOString().slice(0, 10) }}
      />
    </main>
  )
}
```

Manual verification: from an objective's detail page, create a weekly goal, confirm the progress bar shows 0/0, edit the title, delete it.

- [ ] **Step 6: Commit**

```bash
git add src/components/weekly-goal-form.tsx src/components/weekly-goal-form.test.tsx src/app/objectives/[id]
git commit -m "feat: add WeeklyGoals UI nested under an objective"
```

---

## Task 10: DailyTasks UI (nested under a WeeklyGoal, with toggle)

**Files:**
- Create: `src/components/daily-task-form.tsx`, `src/components/task-toggle.tsx`, `src/app/objectives/[id]/weeks/[weekId]/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit/page.tsx`, `src/components/daily-task-form.test.tsx`, `src/components/task-toggle.test.tsx`

**Interfaces:**
- Consumes: `getWeeklyGoal` (Task 6); `createDailyTask`, `listDailyTasksByWeeklyGoal`, `getDailyTask`, `updateDailyTask`, `toggleDailyTask`, `deleteDailyTask` (Task 7); `DeleteButton` (Task 8).
- Produces:
  - `DailyTaskForm` — props: `{ action: (formData: FormData) => Promise<void>; defaultValues?: { title: string; date: string } }`.
  - `TaskToggle` client component — props: `{ taskId: string; completed: boolean; action: (id: string) => Promise<void> }`. Reused by the Today view (Task 11).

- [ ] **Step 1: Write the failing component tests**

`src/components/daily-task-form.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyTaskForm } from '@/components/daily-task-form'

describe('DailyTaskForm', () => {
  it('submits title and date', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<DailyTaskForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Correr 5km')
    await userEvent.type(screen.getByLabelText(/data/i), '2026-07-29')
    await userEvent.click(screen.getByRole('button', { name: /adicionar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Correr 5km')
    expect(submitted.get('date')).toBe('2026-07-29')
  })

  it('pre-fills fields from defaultValues', () => {
    render(
      <DailyTaskForm action={vi.fn()} defaultValues={{ title: 'Existing', date: '2026-07-29' }} />,
    )

    expect(screen.getByLabelText(/título/i)).toHaveValue('Existing')
    expect(screen.getByLabelText(/data/i)).toHaveValue('2026-07-29')
  })
})
```

`src/components/task-toggle.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskToggle } from '@/components/task-toggle'

describe('TaskToggle', () => {
  it('calls the action with the task id when checked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<TaskToggle taskId="task-1" completed={false} action={action} />)

    await userEvent.click(screen.getByRole('checkbox'))

    expect(action).toHaveBeenCalledWith('task-1')
  })

  it('renders as checked when completed is true', () => {
    render(<TaskToggle taskId="task-1" completed action={vi.fn()} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- daily-task-form.test task-toggle.test`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

`src/components/daily-task-form.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DailyTaskForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: { title: string; date: string }
}) {
  return (
    <form action={action} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Data</Label>
        <Input id="date" name="date" type="date" required defaultValue={defaultValues?.date} />
      </div>
      <Button type="submit">{defaultValues ? 'Salvar' : 'Adicionar'}</Button>
    </form>
  )
}
```

`src/components/task-toggle.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

export function TaskToggle({
  taskId,
  completed,
  action,
}: {
  taskId: string
  completed: boolean
  action: (id: string) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Checkbox
      checked={completed}
      disabled={isPending}
      onCheckedChange={() => startTransition(() => action(taskId))}
    />
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- daily-task-form.test task-toggle.test`
Expected: 4 passed.

- [ ] **Step 5: Wire up the weekly goal detail page (manual browser verification)**

`src/app/objectives/[id]/weeks/[weekId]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { createDailyTask, deleteDailyTask, listDailyTasksByWeeklyGoal, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { DailyTaskForm } from '@/components/daily-task-form'
import { TaskToggle } from '@/components/task-toggle'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'

export default async function WeeklyGoalDetailPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id, weekId } = await params
  const goal = await getWeeklyGoal(weekId)
  if (!goal) notFound()

  const tasks = await listDailyTasksByWeeklyGoal(weekId)

  async function addTask(formData: FormData) {
    'use server'
    await createDailyTask(weekId, formData)
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">{goal.title}</h1>
      <DailyTaskForm action={addTask} />
      <ul className="mt-6 flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-3">
              <TaskToggle taskId={task.id} completed={task.completed} action={toggleDailyTask} />
              <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                {task.title}
              </span>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="secondary">
                <Link href={`/objectives/${id}/weeks/${weekId}/tasks/${task.id}/edit`}>Editar</Link>
              </Button>
              <DeleteButton action={deleteDailyTask.bind(null, task.id)} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

`src/app/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { getDailyTask, updateDailyTask } from '@/lib/actions/dailyTasks'
import { DailyTaskForm } from '@/components/daily-task-form'

export default async function EditDailyTaskPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string; taskId: string }>
}) {
  const { id, weekId, taskId } = await params
  const task = await getDailyTask(taskId)
  if (!task) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateDailyTask(taskId, formData)
    redirect(`/objectives/${id}/weeks/${weekId}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar tarefa</h1>
      <DailyTaskForm
        action={action}
        defaultValues={{ title: task.title, date: task.date.toISOString().slice(0, 10) }}
      />
    </main>
  )
}
```

Manual verification: add a daily task, edit its title/date, toggle it complete and back, delete it; confirm the strikethrough style follows `completed` and editing doesn't reset `completed`.

- [ ] **Step 6: Commit**

```bash
git add src/components/daily-task-form.tsx src/components/daily-task-form.test.tsx src/components/task-toggle.tsx src/components/task-toggle.test.tsx "src/app/objectives/[id]/weeks/[weekId]/page.tsx" "src/app/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit/page.tsx"
git commit -m "feat: add DailyTasks UI with edit and toggle-complete under a weekly goal"
```

---

## Task 11: Today view (home page)

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `listDailyTasksByDate`, `toggleDailyTask` (Task 7); `TaskToggle` (Task 10).

- [ ] **Step 1: Replace the placeholder home page with the Today view**

`src/app/page.tsx`:

```tsx
import Link from 'next/link'
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { TaskToggle } from '@/components/task-toggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Hoje</h1>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  <Link href={`/objectives/${task.weeklyGoal.objective.id}`}>
                    {task.weeklyGoal.objective.title}
                  </Link>
                  {' · '}
                  {task.weeklyGoal.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <TaskToggle taskId={task.id} completed={task.completed} action={toggleDailyTask} />
                <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                  {task.title}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`. Add a daily task dated today via the objective/week flow, confirm it shows up here and toggling it here updates the checked state after a refresh.

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add Today view as the home page"
```

---

## Task 12: Week view

**Files:**
- Create: `src/app/week/page.tsx`

**Interfaces:**
- Consumes: `listWeeklyGoalsForCurrentWeek`, `getWeekProgress` (Task 6).

- [ ] **Step 1: Implement the page**

`src/app/week/page.tsx`:

```tsx
import Link from 'next/link'
import { getWeekProgress, listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default async function WeekPage() {
  const goals = await listWeeklyGoalsForCurrentWeek()
  const progress = await Promise.all(goals.map((g) => getWeekProgress(g.id)))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Esta semana</h1>
      {goals.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal, i) => (
            <Card key={goal.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/objectives/${goal.objective.id}/weeks/${goal.id}`}>{goal.title}</Link>
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {goal.objective.title}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Progress value={progress[i].percent} />
                <span className="text-sm text-muted-foreground">
                  {progress[i].completed}/{progress[i].total} tarefas ({progress[i].percent}%)
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open `http://localhost:3000/week`. Confirm every weekly goal whose `weekStart`/`weekEnd` cover today shows up with the same progress numbers as its own detail page.

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/week
git commit -m "feat: add Week view with aggregated progress per weekly goal"
```

---

## Task 13: Progress chart per Objective (Recharts)

**Files:**
- Create: `src/lib/actions/progress.ts`, `src/lib/actions/progress.test.ts`, `src/components/objective-progress-chart.tsx`
- Modify: `src/app/objectives/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 3); `getWeekProgress` (Task 6).
- Produces: `getObjectiveProgressSeries(objectiveId: string): Promise<Array<{ weekLabel: string; percent: number }>>` in `src/lib/actions/progress.ts`, ordered by `weekStart` ascending, `weekLabel` formatted `dd/MM`. `ObjectiveProgressChart` client component — props: `{ data: Array<{ weekLabel: string; percent: number }> }`.

- [ ] **Step 1: Install Recharts**

```powershell
npm install recharts
```

- [ ] **Step 2: Write the failing test for the data series**

`src/lib/actions/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { getWeekBounds } from '@/lib/dates'

describe('getObjectiveProgressSeries', () => {
  it('returns one point per weekly goal, ordered by week, with completion percent', async () => {
    const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
    const week1 = getWeekBounds(new Date('2026-07-06'))
    const week2 = getWeekBounds(new Date('2026-07-13'))

    const goal1 = await prisma.weeklyGoal.create({
      data: { title: 'W1', objectiveId: objective.id, ...week1 },
    })
    const goal2 = await prisma.weeklyGoal.create({
      data: { title: 'W2', objectiveId: objective.id, ...week2 },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: goal1.id, date: week1.weekStart, completed: true },
        { title: 'b', weeklyGoalId: goal1.id, date: week1.weekStart, completed: false },
        { title: 'c', weeklyGoalId: goal2.id, date: week2.weekStart, completed: true },
      ],
    })

    const series = await getObjectiveProgressSeries(objective.id)

    expect(series).toEqual([
      { weekLabel: '06/07', percent: 50 },
      { weekLabel: '13/07', percent: 100 },
    ])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- progress.test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement the data series function**

`src/lib/actions/progress.ts`:

```ts
'use server'

import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekProgress } from '@/lib/actions/weeklyGoals'

export async function getObjectiveProgressSeries(
  objectiveId: string,
): Promise<Array<{ weekLabel: string; percent: number }>> {
  const weeklyGoals = await prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
  })

  const series = await Promise.all(
    weeklyGoals.map(async (goal) => {
      const { percent } = await getWeekProgress(goal.id)
      return { weekLabel: format(goal.weekStart, 'dd/MM'), percent }
    }),
  )

  return series
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- progress.test`
Expected: 1 passed.

- [ ] **Step 6: Implement the chart component**

`src/components/objective-progress-chart.tsx`:

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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="weekLabel" />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip formatter={(value: number) => [`${value}%`, 'Concluído']} />
        <Bar dataKey="percent" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 7: Add the chart to the objective detail page**

In `src/app/objectives/[id]/page.tsx`, add the import and render the chart above the weekly goals list:

```tsx
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { ObjectiveProgressChart } from '@/components/objective-progress-chart'
```

```tsx
  const series = await getObjectiveProgressSeries(id)
```

```tsx
      <ObjectiveProgressChart data={series} />
```

(placed right after the `<h1>`/button row, before the weekly goals `<div>`).

- [ ] **Step 8: Verify manually and via build**

Run: `npm run dev`, open an objective with a few weekly goals that have completed tasks, confirm the bar chart renders one bar per week with the right percentage.
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/lib/actions/progress.ts src/lib/actions/progress.test.ts src/components/objective-progress-chart.tsx "src/app/objectives/[id]/page.tsx" package.json package-lock.json
git commit -m "feat: add progress chart per objective using Recharts"
```

---

## Task 14: Navigation and visual polish

**Files:**
- Create: `src/components/nav-bar.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing new — pure layout/navigation wiring on top of existing routes (`/`, `/week`, `/objectives`).

- [ ] **Step 1: Add a nav bar component**

`src/components/nav-bar.tsx`:

```tsx
import Link from 'next/link'

const links = [
  { href: '/', label: 'Hoje' },
  { href: '/week', label: 'Semana' },
  { href: '/objectives', label: 'Objetivos' },
]

export function NavBar() {
  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-2xl items-center gap-6 p-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm font-medium hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Mount it in the root layout**

In `src/app/layout.tsx`, import `NavBar` from `@/components/nav-bar` and render it as the first child inside `<body>`, before `{children}`.

- [ ] **Step 3: Manual responsive/visual QA**

Run: `npm run dev`. Walk through: Hoje → Semana → Objetivos → an objective → a weekly goal, at both a desktop width and a narrow (~375px) viewport. Checklist:
- Nav links work and the current section is reachable from every page.
- No horizontal scrollbars at 375px width.
- Buttons and checkboxes are comfortably tappable (not cramped) on the narrow viewport.
- Long objective/task titles wrap instead of overflowing their card.

Fix any issues found directly in the affected page/component files (e.g., add `flex-wrap`, `break-words`, or reduce `max-w-*` as needed) before moving on — there's no separate task for this, it's part of this task's deliverable.

- [ ] **Step 4: Full regression pass**

Run: `npm run test`
Expected: all tests still pass.
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-bar.tsx src/app/layout.tsx
git commit -m "feat: add navigation bar and polish responsive layout"
```
