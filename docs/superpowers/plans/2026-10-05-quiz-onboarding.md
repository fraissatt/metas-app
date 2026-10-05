# Onboarding Quiz and Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a five-step branching onboarding quiz that creates the user's first real plan, first-party funnel event tracking, and a `/funil` page with drop-off and conversion metrics.

**Architecture:**
- The quiz definition, answer validation and plan building are pure modules in `src/lib/quiz/`, tested with an injected `today`.
- A new `FunnelEvent` table is written through a validating Server Action, which never throws on bad input.
- `createPlanFromQuiz` writes the objective, weeks and tasks in one transaction.
- `OnboardingQuiz` is a client component that receives the actions as props.
- `/funil` aggregates the events server-side and renders Recharts plus accessible tables.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before touching Next APIs, per AGENTS.md), React 19, Tailwind 4, Prisma + Postgres, date-fns, Recharts, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-05-quiz-onboarding-design.md`. It is the binding source for copy, step ids, option ids, plan templates and behavior. Copy text verbatim from it.

## Global Constraints

- **Branch:** work on `feature/quiz-onboarding` (cut from `develop`). Merge into `develop` with `--no-ff`. Never commit directly to `develop` or `master`.
- **Commit messages:** detailed. The last line is exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and must never name another model; verify with `git log -1 --format=%B`. On Windows, write the message to a file and run `git commit -F <file>`.
- **Dependencies:** none new.
- **Copy:** UI copy is Portuguese, exactly as in the spec.
- **Colors:** no 6- or 8-digit hex literals in `src/**/*.tsx?` (`theme-contrast.test.ts` checks this). Use theme tokens. Small primary-colored text uses `text-accent-foreground`.
- **Client imports:** client components import nothing as values from `@/lib/actions/*`, `@/lib/theme` or `@/lib/background`. Actions arrive as props. `@/lib/quiz/*` modules must stay pure, with no `next/*` and no Prisma imports, so client code can import them.
- **Weeks:** weeks start on Monday, via `getWeekBounds` from `@/lib/dates`.
- **Process rules:**
  - Never kill processes: no taskkill, `Stop-Process` or `kill`.
  - Never run `next build` in this folder, because the user's dev server runs from it.
  - Don't start or stop servers.
  - Run the full suite as `timeout 500 npm test`. It needs the Docker Postgres.
  - Four test files have pre-existing TS fixture errors (`completedAt` missing); they are not yours.
- **Migrations:** create them with `npx prisma migrate dev --name quiz_funnel_events --create-only`, then apply them to the dev DB with `npx prisma migrate deploy` and to the test DB with `npm run test:migrate`. The change is additive (a new table only); the user approved a migration.

## Review Focus

1. **Some chosen weekdays already passed this week.** The current week must get only the remaining days and not be recurring. Next week gets the full set and is recurring. Pinned in Task 1.
2. **A focus that doesn't belong to the chosen area, or a forged answer sent to the Server Action.** It must be rejected before any write. Pinned in Tasks 1 and 3.
3. **Tracking failures or garbage events.** They must never break the quiz or throw. Pinned in Tasks 2 and 4.
4. **Going back and forth between steps.** Answers are kept, `step_viewed` events are re-recorded, and the funnel counts distinct sessions, not views. Pinned in Tasks 2 and 4.
5. **Keyboard-only and screen-reader users.** The radiogroup and checkbox semantics, roving focus, and focus moving to each new question. Pinned in Task 4.

---

### Task 1: Quiz definition, answer validation, plan builder (pure)

**Files:** create `src/lib/quiz/definition.ts`, `src/lib/quiz/build-plan.ts`, `src/lib/quiz/definition.test.ts` and `src/lib/quiz/build-plan.test.ts`.

**Interfaces (produces):**
- `type StepId = 'area' | 'foco' | 'prazo' | 'dias' | 'obstaculo'`
- `STEP_ORDER: readonly StepId[]`
- `type Area`, `type Focus`, `type Weekday = 'seg'|'ter'|'qua'|'qui'|'sex'|'sab'|'dom'`, `type Obstacle`, `type Prazo = 1|3|6|12`
- `type QuizAnswers = { area: Area; foco: Focus; prazo: Prazo; dias: Weekday[]; obstaculo: Obstacle }`
- `type QuizOption = { id: string; label: string; emoji?: string }`
- `getStep(stepId, answersSoFar: Partial<QuizAnswers>): { id: StepId; title: string; multiple: boolean; options: QuizOption[] }`. The `foco` step branches on `answersSoFar.area`.
- `optionLabel(stepId, value): string` (for `/funil`)
- `WEEKDAY_LABELS: Record<Weekday, string>` (`Seg` … `Dom`)
- `validateAnswers(input: unknown): QuizAnswers`. Throws `Error('Respostas inválidas')` on anything invalid.
- `type PlanWeek = { weekStart: Date; weekEnd: Date; recurring: boolean; tasks: Array<{ title: string; date: Date }> }`
- `type Plan = { objective: { title: string; startDate: Date; targetDate: Date }; weeklyGoal: { title: string }; weeks: PlanWeek[]; tip: string }`
- `buildPlan(answers: QuizAnswers, today: Date): Plan`, in `build-plan.ts`

**Steps:**
- [ ] **Step 1: Write the failing tests.** Cover everything in the spec's "Testing" bullets for `definition.test.ts` and `build-plan.test.ts`. The concrete cases below are required; use `today = new Date(2026, 9, 1, 15)`, a Thursday whose week starts Monday 2026-09-28.
  - **Every focus has a template.** `buildPlan` works for every area/focus combination.
  - **`foco` branches by area.** `getStep('foco', { area: 'estudos' })` returns the three estudos options and the title "Nos estudos, qual é o seu foco?".
  - **`validateAnswers` rejects:**
    - a missing step;
    - `{ area: 'saude', foco: 'idioma', … }`;
    - `dias: []`;
    - an unknown weekday;
    - `prazo: 2`;
    - non-object input.
  - **`validateAnswers` accepts a full valid set** and returns days de-duplicated and in week order.
  - **Target date.** With prazo 3, `targetDate` is 2027-01-01.
  - **All chosen days still ahead.** With `dias: ['qui','sex','sab']`:
    - exactly one week, `recurring: true`;
    - tasks on Oct 1, 2 and 3;
    - the weekly goal title contains "3".
  - **Some days passed.** With `dias: ['seg','qua','sab']`:
    - two weeks;
    - week 1 is Sep 28, `recurring: false`, and has only the Oct 3 task;
    - week 2 is Oct 5, `recurring: true`, with tasks on Oct 5, 7 and 10;
    - both weeks use the same goal title.
  - **No days left this week.** With `dias: ['seg','ter']`, there is only the next week (Oct 5, recurring), with tasks on Oct 5 and 6.
  - **Short variant.** With `obstaculo: 'tempo'`, every task title is the short variant (for example it contains "min"). Any other obstacle uses the normal variant. The tip equals the spec's sentence for each obstacle.
- [ ] **Step 2: Run the tests to verify they fail.**
- [ ] **Step 3: Implement** from the spec's "Quiz content" section, with copy verbatim. The templates are yours to write per focus, following the spec's examples and tone:
  - Objective title.
  - Weekly goal title with the day count, for example "Correr {n} vezes na semana" or "Ler em {n} dias da semana".
  - At least three normal task titles and three short ones, assigned to the chosen days in rotation.
  - Dates are local midnights, via date-fns `addDays` from `getWeekBounds(today).weekStart`. "Remaining" means `date >= startOfDay(today)`.
- [ ] **Step 4: Run the tests to verify they pass,** then run lint.
- [ ] **Step 5: Commit.**

---

### Task 2: FunnelEvent model, tracking action, stats

**Files:**
- Modify: `prisma/schema.prisma` and `src/test/setup.ts` (add `await prisma.funnelEvent.deleteMany()` to `afterEach`).
- Create: the migration, `src/lib/actions/funnel.ts` and `src/lib/actions/funnel.test.ts`.

**Interfaces (produces):**
- `type FunnelEventType = 'quiz_started' | 'step_viewed' | 'step_answered' | 'result_viewed' | 'plan_created'`
- `type FunnelEventInput = { sessionId: string; type: FunnelEventType; step?: StepId; value?: string }`
- `trackFunnelEvent(event: FunnelEventInput): Promise<void>`. Validates and never throws on invalid input.
- `type FunnelStage = { id: 'area'|'foco'|'prazo'|'dias'|'obstaculo'|'result'|'plan'; label: string; sessions: number; percentOfStart: number; dropFromPrevious: number | null }`
- `getFunnelStats(): Promise<{ starts: number; conversion: number | null; medianSecondsToPlan: number | null; stages: FunnelStage[]; biggestDrop: FunnelStage | null; answers: Array<{ step: StepId; title: string; options: Array<{ value: string; label: string; count: number; share: number }> }>; recent: Array<{ sessionId: string; startedAt: Date; furthest: string; created: boolean }> }>`

**Steps:**
- [ ] **Step 1: Add the model** from the spec to `schema.prisma`. Create the migration with `--create-only`, inspect the SQL (it must only create the table and its indexes), then apply it with `npx prisma migrate deploy` (dev) and `npm run test:migrate` (test). Run `npx prisma generate` if needed. Update `src/test/setup.ts`.
- [ ] **Step 2: Write the failing tests** (real test DB).
  - **Stores valid events.** `trackFunnelEvent` stores a valid `step_viewed`.
  - **Drops bad input silently,** with no row and no throw:
    - unknown type;
    - missing step on `step_answered`;
    - a step id that isn't a `StepId`;
    - a value over 100 characters, which is truncated or dropped (choose truncate, and test that);
    - a `sessionId` that is empty, longer than 40 characters, or contains spaces.
  - **`getFunnelStats` over a seeded scenario.** Seed 4 sessions:
    - A reaches `plan_created`;
    - B stops after viewing `dias`;
    - C stops after viewing `area`;
    - D reaches `result_viewed` and goes back once, so `prazo` is viewed twice.

    Assert:
    - `starts = 4`;
    - stage sessions are area 4, foco 3, prazo 3, dias 3, obstaculo 2, result 2, plan 1;
    - D's double view counts once;
    - `conversion = 25`;
    - `biggestDrop` is the largest `dropFromPrevious`, rounded;
    - `answers` counts `step_answered` values, with `dias` values comma-joined in events but counted per weekday;
    - `recent` is newest first and limited to 10;
    - `medianSecondsToPlan` comes from A's timestamps (set `createdAt` explicitly).
  - **Empty database.** Zeros, `conversion: null`, `biggestDrop: null`, and empty `recent`.
- [ ] **Step 3: Implement.**
  - **Session id rule:** `/^[A-Za-z0-9-]{8,40}$/`.
  - **Stage labels:** Área, Foco, Prazo, Dias, Obstáculo, Resultado and Plano criado.
  - **Percentages:** rounded integers.
  - **Answer labels:** come from `optionLabel`.
  - **Aggregation:** a single `findMany` ordered by `createdAt`, grouped in memory, is acceptable.
- [ ] **Step 4: Run the tests to verify they pass,** then run lint.
- [ ] **Step 5: Commit.** Include the migration folder, schema, setup, action and test.

---

### Task 3: `createPlanFromQuiz` Server Action

**Files:** create `src/lib/actions/quiz.ts` and `src/lib/actions/quiz.test.ts`.

**Interfaces:**
- Consumes `validateAnswers` and `buildPlan` (Task 1) and the `FunnelEvent` model (Task 2).
- Produces `createPlanFromQuiz(input: { sessionId: string; answers: unknown }): Promise<void>`. It redirects to `/` on success and throws `Error('Não foi possível criar o plano')` on invalid input.

**Steps:**
- [ ] **Step 1: Write the failing tests** (real test DB). Mock `next/navigation`'s `redirect` as a `vi.fn()` that does not throw, and use fake system time via `vi.setSystemTime(new Date(2026, 9, 1, 15))` so `new Date()` is deterministic.
  - **Valid answers with `dias: ['seg','qua','sab']`:**
    - creates one objective with the template title and target date;
    - creates two weekly goals with `recurring` false and then true;
    - creates tasks on the dates from Task 1's case;
    - records one `plan_created` event for the sessionId;
    - calls `redirect('/')`.
  - **Invalid answers:** the action throws, and the objective, weeklyGoal, dailyTask and funnelEvent counts all stay 0.
- [ ] **Step 2: Run the test to verify it fails.**
- [ ] **Step 3: Implement.** Read the Next docs for `redirect` in Server Actions; it throws internally in real Next, so call it after the transaction.
  - Validate the answers, then build the plan.
  - In `prisma.$transaction`, create the objective (`startDate: startOfDay(now)`), then for each week a `weeklyGoal` (`weekStart`, `weekEnd`, `recurring`, `title`), then `dailyTask.createMany`, then the `funnelEvent`.
  - Revalidate `/` and `/objectives`, then `redirect('/')`.
  - Validate `sessionId` with the same rule as Task 2. If it is invalid, still create the plan but skip the event, because tracking must never block the user.
- [ ] **Step 4: Run the tests to verify they pass,** then run lint.
- [ ] **Step 5: Commit.**

---

### Task 4: `OnboardingQuiz` client component

**Files:** create `src/components/onboarding-quiz.tsx` and `src/components/onboarding-quiz.test.tsx`.

**Interfaces:**
- Consumes `getStep`, `STEP_ORDER`, `WEEKDAY_LABELS`, `buildPlan` and types from `@/lib/quiz/*` (pure; `buildPlan` builds the preview client-side with `new Date()`).
- Produces `OnboardingQuiz(props: { onTrack: (e: FunnelEventInput) => Promise<void>; onCreate: (input: { sessionId: string; answers: QuizAnswers }) => Promise<void> })`. Import `FunnelEventInput` type-only from `@/lib/actions/funnel`.

**Steps:**
- [ ] **Step 1: Write the failing tests.** Stub `crypto.randomUUID` to return predictable ids.
  - **Mouse walkthrough** of all 5 steps. The `foco` options match the chosen area.
  - **Voltar keeps answers,** with the previous option still `aria-checked="true"`.
  - **Day picking is required.** On `dias`, Continuar does nothing and shows the hint "Escolha pelo menos um dia" until a day is checked. Days are `role="checkbox"`.
  - **Result screen** shows "Seu plano está pronto", the objective title, the weekly goal title, a line per task ("Seg · …") and the tip.
  - **"Criar meu plano"** calls `onCreate` with `{ sessionId, answers }` and shows a busy state.
  - **On `onCreate` rejection,** the error "Não foi possível criar o plano. Tente de novo." is shown and the button is usable again.
  - **Refazer** returns to step 1 with a new sessionId (the next `onTrack` uses the new id) and cleared answers.
  - **Event sequence.** `onTrack` receives `quiz_started`, `step_viewed(area)`, `step_answered(area, value)`, `step_viewed(foco)` and so on through `result_viewed`, in order and with the same sessionId. Calls are serialized: the next call starts only after the previous promise settles. Test this with deferred promises.
  - **`onTrack` rejection** doesn't break navigation.
  - **Keyboard:**
    - ArrowDown moves the selection within the radiogroup;
    - Enter on a selected single-choice option continues;
    - focus moves to the new step's heading after advancing.
  - **The progress text** is "Etapa N de 5".
- [ ] **Step 2: Run the tests to verify they fail.**
- [ ] **Step 3: Implement** per the spec's "OnboardingQuiz" section: layout, classes, roving tabindex, `motion-safe` transitions, the `role`/`aria` attributes, and 44px minimum targets.
- [ ] **Step 4: Run the tests to verify they pass** with pristine output, then run lint.
- [ ] **Step 5: Commit.**

---

### Task 5: `/funil` page and chart

**Files:** create `src/components/funnel-chart.tsx` (client), `src/components/funnel-chart.test.tsx` and `src/app/funil/page.tsx`.

**Interfaces:**
- Consumes `getFunnelStats` and the `FunnelStage` type (Task 2).
- Produces `FunnelChart({ stages, biggestDropId })`.

**Steps:**
- [ ] **Step 1: Write the failing tests** for `FunnelChart`:
  - a visually hidden `<table>` lists each stage's label, sessions, percentage and drop;
  - the biggest-drop row is marked;
  - the caption "Maior abandono: {stage} (−N%)" renders;
  - with all-zero stages there is no caption.

  Recharts may not lay out in jsdom; test the table and caption, not SVG geometry.
- [ ] **Step 2: Run the tests to verify they fail.**
- [ ] **Step 3: Implement.**
  - **Chart:** Recharts `ResponsiveContainer` plus `BarChart layout="vertical"`. Bars use `var(--primary)`, with `var(--support)` for "Plano criado" and the largest-drop bar's label in `text-destructive` via a custom label.
  - **Page** (Server Component, `export const dynamic = 'force-dynamic'`, metadata title "Funil do quiz"):
    - tiles, as in the spec;
    - the chart;
    - the answers section, with simple proportion bars in plain elements and labels;
    - the recent runs list, with relative times in pt-BR via `Intl.RelativeTimeFormat` or date-fns `formatDistanceToNow` with the `ptBR` locale;
    - the empty state with a "Fazer o quiz" link to `/quiz`.
  - **Layout:** `max-w-5xl`, `p-4 md:p-8`, using the app's card styles.
- [ ] **Step 4: Run the tests to verify they pass,** then run lint.
- [ ] **Step 5: Commit.**

---

### Task 6: Entry points and wiring

**Files:**
- Create: `src/app/quiz/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/objectives/page.tsx` and `src/components/home-empty-state.tsx`, plus its test if it references `no-objective`.

**Steps:**
- [ ] **Step 1: Create `/quiz`.** A Server Component with metadata title "Montar plano" that renders `<OnboardingQuiz onTrack={trackFunnelEvent} onCreate={createPlanFromQuiz} />` inside `<main className="mx-auto max-w-md p-4 md:p-8">`. Below it, a muted link "Ver métricas do quiz" → `/funil`.
- [ ] **Step 2: Home redirect.** In `src/app/page.tsx`, the S1 branch (`countObjectives() === 0`) calls `redirect('/quiz')` (from `next/navigation`) instead of rendering `HomeEmptyState variant="no-objective"`. Remove the `no-objective` variant from `HomeEmptyState` and its test. Keep `no-goal`.
- [ ] **Step 3: Objetivos links.** In `src/app/objectives/page.tsx`:
  - next to "Novo objetivo", add a secondary button-link "Montar plano com o quiz" → `/quiz`;
  - in the no-objectives empty state, make "Montar plano com o quiz" the primary call to action, keeping "Criar meu primeiro objetivo" as secondary;
  - at the bottom of the page, add a muted link "Ver métricas do quiz" → `/funil`.
- [ ] **Step 4: Run the checks.** Run `timeout 500 npm test`, `npm run lint` and `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"`.
- [ ] **Step 5: Commit.**

---

### Task 7: Browser verification (controller) and merge

- [ ] **Empty-app check with a separate database.**
  - Create a throwaway database `metas_app_quizcheck` on the Docker Postgres (`docker exec … createdb`).
  - Apply the migrations to it with `DATABASE_URL=… npx prisma migrate deploy`.
  - Run a second dev server on another port against it from a separate working copy, so the user's server and data are never touched.
  - Verify:
    - `/` redirects to `/quiz`;
    - the five steps work by mouse and keyboard;
    - the result screen appears;
    - "Criar meu plano" leads to Hoje with tasks;
    - `/funil` shows the run;
    - redoing the quiz adds a second run;
    - both themes, 375px, and reduced motion.
- [ ] **Clean up.** Stop that server (only the one you started), drop the throwaway database, and remove the working copy.
- [ ] **Final whole-branch review, then merge** into `develop` with `--no-ff` and a detailed message. Do not push or touch `master` without the user.
