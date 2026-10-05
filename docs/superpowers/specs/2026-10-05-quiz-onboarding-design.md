# Onboarding Quiz and Funnel Design

## Context

A new user currently lands on an empty Hoje page that says "Comece pelo primeiro objetivo" and links to a blank form. That is the app's de facto acquisition funnel, and a weak one. The repository is also being shown to a recruiter for a front-end role whose core work is **quiz funnels**, event tracking and conversion dashboards (project memory: portfolio-for-recruiter).

Brainstorming on 2026-10-05 agreed on an onboarding quiz that builds the user's first real plan, plus first-party funnel tracking and a funnel page:

| Question | Decision |
|---|---|
| When the quiz appears | **First use and on demand.** It opens by itself when there are no objectives, and is always reachable from a "Montar plano com o quiz" button on Objetivos. |
| What "Criar meu plano" creates | **The full plan:** the objective with a target date, a recurring weekly goal and tasks on the chosen weekdays. The user lands on Hoje with tasks, and everything stays editable afterwards. |
| Where the funnel metrics live | **Its own page `/funil`**, linked discreetly from the quiz and from Objetivos. Main navigation is unchanged. |
| Tracking | **First party:** an anonymous session id per run, events in a new table, and no external analytics. |

## Goals

### Quiz content (`src/lib/quiz/definition.ts`, pure)

There are five steps and one question per step. The step ids and the options are stable strings, because analytics and tests key on them.

1. **`area`**, "O que você quer conquistar?":
   - `saude` 🏃 Saúde e corpo
   - `estudos` 📚 Estudos
   - `financas` 💰 Finanças
   - `carreira` 🚀 Carreira e projetos
2. **`foco`**: the title and options branch on the area.
   - **saude**, "Na saúde, qual é o seu foco?":
     - `correr` Correr uma prova
     - `forca` Ganhar força
     - `sono` Dormir melhor
     - `alimentacao` Comer melhor
   - **estudos**, "Nos estudos, qual é o seu foco?":
     - `leitura` Ler mais livros
     - `idioma` Aprender um idioma
     - `curso` Fazer um curso
   - **financas**, "Nas finanças, qual é o seu foco?":
     - `reserva` Montar uma reserva
     - `dividas` Sair das dívidas
     - `gastos` Organizar os gastos
   - **carreira**, "Na carreira, qual é o seu foco?":
     - `projeto` Tirar um projeto do papel
     - `promocao` Conseguir uma promoção
     - `emprego` Mudar de emprego
3. **`prazo`**, "Em quanto tempo?": `1` 1 mês · `3` 3 meses · `6` 6 meses · `12` 1 ano.
4. **`dias`**, "Em quais dias você pode se dedicar?". This is a multi-select of weekdays (`seg` … `dom`). At least one day is required, and "Continuar" stays inert with a hint until one is chosen.
5. **`obstaculo`**, "O que mais te atrapalha?":
   - `tempo` Falta de tempo
   - `constancia` Falta de constância
   - `comeco` Não sei por onde começar
   - `motivacao` Perco a motivação

Each focus has a **plan template**. A template holds:
- the objective title (for example "Correr uma prova de 10 km" or "Ler 12 livros");
- the weekly goal title, with the count of chosen days filled in (for example "Correr 3 vezes na semana");
- a rotating list of task titles, assigned to the chosen days in order.

Each template has a normal variant and a **short variant** used when the obstacle is `tempo`, where every task title ends with "(até 30 min)" or names a shorter duration. Each obstacle also has a tip sentence:

- **tempo:** "Como seu obstáculo é tempo, as tarefas são curtas."
- **constancia:** "A meta se repete toda semana para virar hábito."
- **comeco:** "As primeiras tarefas são simples para você começar hoje."
- **motivacao:** "Cada semana cumprida vira uma sequência 🔥 no painel."

`buildPlan(answers, today: Date)` is pure and returns:

```ts
{ objective: { title, startDate, targetDate }, weeklyGoal: { title }, weeks: Array<{ weekStart, weekEnd, recurring, tasks: Array<{ title, date }> }>, tip }
```

- **`targetDate`** is `today + prazo months`.
- **Week placement:** tasks go on the chosen weekdays from today onward in the current week (Monday start, via `getWeekBounds`).
  - **All chosen days still ahead:** one week, `recurring: true`.
  - **Some chosen days already passed:**
    - The current week gets only the remaining days, with `recurring: false`. It is omitted if no days remain.
    - The following week gets every chosen day, with `recurring: true` and the same goal title.
    - The recurrence engine copies task positions from the last planned week, so the following week must carry the full set.
    - The engine keys "already here" on objective plus title, so this cannot duplicate goals.

`validateAnswers(input)` returns typed answers or throws. It checks that every step is present, that the focus belongs to the area and that there is at least one valid day.

### Tracking

- **New Prisma model** (migration `quiz_funnel_events`):

  ```prisma
  model FunnelEvent {
    id        String   @id @default(cuid())
    sessionId String
    type      String   // 'quiz_started' | 'step_viewed' | 'step_answered' | 'result_viewed' | 'plan_created'
    step      String?  // step id for step_* events
    value     String?  // answer (comma-joined for 'dias')
    createdAt DateTime @default(now())

    @@index([sessionId])
    @@index([type, step])
  }
  ```

- **Server Action `trackFunnelEvent(event)`** in `src/lib/actions/funnel.ts`:
  - It validates every field: a known `type`, a known `step` when required, `value` capped at 100 characters, and `sessionId` matching a cuid- or uuid-like pattern capped at 40 characters. Invalid events are dropped silently, because tracking must never break the quiz.
  - It inserts the event. It does not call `revalidatePath`.
- **Session id:** the client generates one with `crypto.randomUUID()` when a run starts ("Refazer" starts a new run). It is held in component state, with no cookie and nothing personal.
- **Client calls are fire-and-forget** (`void trackFunnelEvent(...).catch(() => {})`). They are serialized per session through a promise chain, so `step_viewed` for step N+1 is never stored before `step_answered` for step N.

### Plan creation

Server Action `createPlanFromQuiz(input: { sessionId, answers })` in `src/lib/actions/quiz.ts`:
- It runs `validateAnswers`, then `buildPlan(answers, new Date())`.
- In one transaction it creates the objective (with `startDate = today`), then each week's `WeeklyGoal`, then the `DailyTask`s, and records `plan_created`.
- It calls `revalidatePath('/')` and `revalidatePath('/objectives')`, then `redirect('/')`.
- If validation fails it throws, and the client shows "Não foi possível criar o plano. Tente de novo.".

### Pages and entry points

- **`/quiz`** (`src/app/quiz/page.tsx`, a Server Component) renders `<OnboardingQuiz onTrack={trackFunnelEvent} onCreate={createPlanFromQuiz} />`. Its metadata title is "Montar plano".
- **First use:** in `src/app/page.tsx`, the S1 branch (`countObjectives() === 0`) calls `redirect('/quiz')` instead of rendering `HomeEmptyState variant="no-objective"`. This is a read-only redirect, so it is safe under prefetch. The `no-objective` copy can be removed from `HomeEmptyState`.
- **Objetivos:** next to "Novo objetivo" there is a secondary button "Montar plano com o quiz" linking to `/quiz`. The objectives empty state ("Você ainda não tem objetivos.") also offers it as the primary call to action.
- **Discreet links to `/funil`:** "Ver métricas do quiz" appears as a muted text link at the bottom of `/quiz` and at the bottom of `/objectives`.

### `OnboardingQuiz` (`src/components/onboarding-quiz.tsx`, client)

- **State:** step index, answers, sessionId and status (`answering` | `result` | `creating` | `error`).
- **Layout:** `max-w-md` and centered.
  - **Header:** "Etapa N de 5" and a 4px progress bar with a `from-support to-primary` gradient fill whose width animates.
  - **Question:** an `h1` with the title.
  - **Options:** a `role="radiogroup"` of large option buttons (`role="radio"`, `aria-checked`, emoji `aria-hidden`, at least 44px tall). The `dias` step uses `role="group"` with checkbox buttons (`role="checkbox"`). The selected option uses `border-primary bg-accent text-accent-foreground`.
  - **Footer:** "← Voltar" (hidden on step 1) and a primary "Continuar".
- **Keyboard:**
  - Arrow keys move the selection within the group (roving tabindex).
  - Space or Enter toggles a day.
  - Enter on a single-choice option selects it and continues.
  - Changing step moves focus to the new question heading (`tabIndex={-1}`).
- **Motion:** steps cross-fade and slide by 8px (CSS transition on opacity and transform). There is no transition under `prefers-reduced-motion`.
- **Result screen:**
  - **Header:** "Seu plano está pronto", the objective title as `h1`, and "Meta para dd/MM/aaaa · N meses".
  - **Plan card:** a card styled like the app's cards with the weekly goal title and the "repete toda semana" support badge. It lists every task as "{Seg} · {title}", using the first full week. When there is a partial current week, a muted line reads "Começa nesta semana com {n} tarefa(s)".
  - **Tip:** the tip line.
  - **Actions:** a "Refazer" ghost button that starts a new session and returns to step 1, and a primary "Criar meu plano" that shows a spinner while creating and calls `onCreate`.
- **Events:**
  - `quiz_started` fires on mount and on Refazer.
  - `step_viewed` fires whenever a step is shown, including after Voltar.
  - `step_answered` fires on Continuar, with the value.
  - `result_viewed` fires when the result is shown.
  - `plan_created` is recorded server-side by `createPlanFromQuiz`.

### Funnel page `/funil` (`src/app/funil/page.tsx`)

Data comes from `getFunnelStats()` in `src/lib/actions/funnel.ts`. It aggregates in the database where practical and in memory otherwise, which is fine at portfolio scale. The page has a `max-w-5xl` layout and the title "Funil do quiz":

- **Tiles:**
  - passagens: distinct sessions with `quiz_started`;
  - criaram o plano: sessions with `plan_created` ÷ passagens, as a percentage;
  - tempo médio até o plano: median minutes from `quiz_started` to `plan_created`, shown as "m:ss";
  - abandono maior: the step with the largest drop.
- **Funnel chart:** a horizontal bar per stage: Área, Foco, Prazo, Dias, Obstáculo, Resultado and Plano criado.
  - **Count:** the number of distinct sessions that **viewed** that step. Resultado counts `result_viewed`, and Plano criado counts `plan_created`.
  - **Labels:** each bar shows the count and the percentage of the first stage.
  - **Drop:** the drop versus the previous stage shows as "−N%". The largest drop is highlighted with `text-destructive`, and a muted caption reads "Maior abandono: {stage} (−N%)".
  - **Implementation:** Recharts `BarChart` with `layout="vertical"`, colors from CSS variables, and accessible through a visually hidden data table.
- **Answers:** for each step, the top answers as small horizontal proportion bars with labels from the definition, counting `step_answered` values. `dias` counts each weekday separately.
- **Recent runs:** the last 10 sessions, showing start time (relative, pt-BR), the furthest stage reached, and "plano criado" or "parou em {stage}".
- **Empty state:** with zero sessions, "Ninguém passou pelo quiz ainda." plus a button "Fazer o quiz".

## Non-goals

- Editing questions in the UI, A/B tests, external analytics, cookies for tracking, and personal data.
- Showing `/funil` in the main navigation. Authentication is also out of scope; the app has none.

## Testing

- **`src/lib/quiz/definition.test.ts`:**
  - Every focus has a template.
  - The `foco` options branch per area.
  - `validateAnswers` rejects a missing step, a focus from another area, no days and unknown values.
- **`src/lib/quiz/build-plan.test.ts`:**
  - `targetDate` is today plus the prazo months.
  - All chosen days ahead gives one recurring week.
  - Some days passed gives a partial non-recurring current week plus a full recurring next week.
  - No days left gives only next week.
  - The `tempo` obstacle uses the short task variant.
  - The weekly goal title includes the day count, and the tip matches the obstacle.
- **`src/lib/actions/funnel.test.ts`** (real test DB):
  - `trackFunnelEvent` stores valid events and drops invalid ones without throwing.
  - `getFunnelStats` computes stage counts, conversion, the largest drop, top answers (days split), the median time and recent runs from seeded events.
- **`src/lib/actions/quiz.test.ts`** (real test DB; mock `next/navigation` `redirect` and `next/cache`):
  - It creates the objective, the weeks with the right `recurring` flags, and the tasks on the right dates.
  - It records `plan_created`.
  - It rejects invalid answers without writing anything.
- **`src/components/onboarding-quiz.test.tsx`:**
  - Walks all five steps by mouse and by keyboard.
  - The `foco` options change with the area.
  - Voltar keeps previous answers.
  - Continuar is blocked on `dias` with no day chosen.
  - The result shows the plan.
  - Refazer starts a new session id.
  - "Criar meu plano" calls `onCreate` with the answers.
  - `onTrack` receives the expected event sequence in order.
  - An `onTrack` rejection does not break the flow.
- **`src/app/page` redirect:** covered by a small test of the S1 branch, or by the browser check if page tests are impractical.
- **Manual browser check:**
  - First use with an empty database (a separate test database or a temporary DB, never the user's data) redirects to `/quiz`.
  - The quiz creates the plan and Hoje shows the tasks.
  - `/funil` shows the run.
  - Both themes, 375px, keyboard only, and reduced motion.

## Files

**New:**
- `src/lib/quiz/definition.ts`
- `src/lib/quiz/build-plan.ts`
- `src/lib/actions/funnel.ts`
- `src/lib/actions/quiz.ts`
- `src/components/onboarding-quiz.tsx`
- `src/components/funnel-chart.tsx`
- `src/app/quiz/page.tsx`
- `src/app/funil/page.tsx`
- `prisma/migrations/<timestamp>_quiz_funnel_events/`
- the tests above

**Changed:**
- `prisma/schema.prisma`
- `src/app/page.tsx`
- `src/app/objectives/page.tsx`
- `src/components/home-empty-state.tsx`
- `src/test/setup.ts` (truncate `FunnelEvent` after each test)
