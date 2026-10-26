# Weekly review: what I did and what to repeat

Issue #106.

## Goal

When a week turns, the app only offers "Trazer para esta semana", which brings every one-off goal of the last planned week at once. There is no moment to look at how the week went, and no way to keep some goals and drop others. The user (2026-10-26) asked for a short screen at the end of the week, built on the existing repeat button, and left every decision to me. The brief: keep the person going with real and potential results, no motivational clichés, and respect the app's identity (sober palette, panels, "dias feitos" and the 1% compound effect).

All choices below are mine, made without a design round, and are the ones to check.

## What the user sees

### The `/revisao` page

A short, single-column page (`max-w-2xl`), in the order a person reads a week:

1. **Header.** A small uppercase label "Revisão da semana" and the week as the title, e.g. "19 a 25 de out." ("27 de out. a 2 de nov." across months). If the week was already reviewed, a muted line "Revisada em 26/10".
2. **"Resultado" panel** (one `PanelList`, four rows):
   - **Days done:** the seven day dots of the week (Monday → Sunday, the same `Dot` as the year calendar, size `md`, with S T Q Q S S D under them) and "4 de 7 dias feitos". Future days of the week (reviewing on Saturday) stay empty, as in the calendar.
   - **Tasks:** a large number and "de 24 tarefas cumpridas", then a comparison with the calendar week just before: "5 a mais que na semana anterior", "2 a menos que na semana anterior" or "O mesmo que na semana anterior". No comparison when that week had no tasks.
   - **Compound effect:** "+5% no seu efeito composto" (what the week's days added, as a whole percentage, because a one-decimal factor hides a single day's 1%), with "De 1,4× para 1,5×. Cada dia feito soma 1% ao anterior." under it (all-time days done before the week → through the week). When the week added no day: "Seu efeito composto segue em 1,3×".
   - **Projection:** "Mantendo 4 dias feitos por semana, em 3 meses: 1,5× → 2,5×" (factors with the app's usual one decimal), under it "Projeção a partir desta semana.". When the week had no day done, the projection uses 3 days a week and says so: "Com 3 dias feitos por semana, em 3 meses: …", under it "Uma projeção para um ritmo leve.". The horizon is 13 weeks.
   These are numbers, not praise: the week's result, the change it caused and where the same pace leads.
3. **"Metas da semana" panel**, one row per goal of the week (ordered by objective, then title): goal title, objective title, a thin progress bar, "4/5", and the soft "✓ cumprida" pill when every task was done (`isGoalFulfilled`). On the right, what happens next:
   - a one-off goal of an active objective: a checkbox "Repetir", ticked by default (today's button repeats everything, so ticking off is the deliberate act);
   - a recurring goal: "Volta sozinha" with the repeat icon, no checkbox;
   - a goal already present in the target week (same objective and title): "Já planejada";
   - a goal of a completed objective: "Objetivo concluído".
4. **Action.** One primary button that says exactly what it will do: "Repetir 2 metas na próxima semana" (reviewing the current week) or "Repetir 1 meta nesta semana" (reviewing an earlier week); "Concluir revisão" when nothing is ticked. It repeats the ticked goals, marks the week reviewed and returns to Hoje. A muted note under it when the week has recurring goals: "Metas que se repetem sozinhas não precisam ser marcadas."

When there is no week to review (a new account, or nothing planned before), the page says "Ainda não há uma semana para revisar." with a link back to Hoje.

### Which week

- **Saturday and Sunday:** the current week, if it has goals; otherwise the last planned week. Ticked goals go to **next** week (the days left in the current one are too few to plan).
- **Monday to Friday:** the most recent week before the current one that had goals (the same "last planned week" the existing repeat uses, so someone back after three weeks away still reviews their last real week). Ticked goals go to the **current** week.

### The invitation on Hoje

A one-row card at the top of Hoje (after the lifetime banner): "Revisão da semana" label, the week ("19 a 25 de out."), seven small dots, "4 de 7 dias feitos · 18 tarefas", and a "Revisar" link button. It shows only when the review is due and not done:

- Saturday and Sunday, for the current week (when it has goals);
- Monday to Wednesday, for the previous calendar week (when it had goals).

Outside those windows the page still works by URL, but nothing nags.

### Interplay with "Ficou para trás"

While the invitation shows, the existing "Ficou para trás" card (and the empty-week state built on it) is hidden, so Hoje never offers two competing ways to bring the same goals. Once a week is reviewed, the card no longer offers that week's goals either: the person already decided. An empty current week in either case shows the normal empty state under the invitation.

## Design

- **Data:** a new `WeekReview` table (`id`, `userId` → `user` with cascade delete, `weekStart`, `reviewedAt` default now, unique `userId + weekStart`). Migration `week_review` only creates the table; nothing is deleted or rewritten. A guest who signs up keeps their reviews (`moveGuestDataOnSignUp` moves them with the objectives).
- **Pure logic** in `src/lib/week-review.ts` (no I/O, no date-fns outside `dates.ts`): picking the week to review, whether the invitation is due, and building the review (dots, totals, comparison, compound before/after, projection, goal rows).
- **Goal copying** (`goalKey`, `cloneGoalsInto`, `findMissingGoals`) moves from `weeklyGoals.ts` into a plain server module `src/lib/goal-copy.ts` so both the existing repeat and the review use the same code. Behaviour of the existing actions is unchanged except for the "reviewed week" rule above.
- **Server actions** in `src/lib/actions/weekReview.ts`: `getWeekReview()` (the page), `getWeekReviewInvite()` (Hoje) and `finishWeekReview(weekStartKey, goalIds)`. The write recomputes everything inside one transaction: it accepts only the week the page would show right now (a stale page gets an error and an inline message), upserts the review first (its row lock makes a concurrent second submit wait and then see the copies), accepts only the user's own one-off goals of that week from active objectives, skips any already in the target week and clones them with their weekday positions.
- **UI:** `src/app/revisao/page.tsx` (dynamic, title "Revisão da semana · Metas"), `src/components/week-review.tsx` (client: the checkboxes and the button), `src/components/week-review-invite.tsx` (the Hoje card). Existing pieces are reused: `PanelList`, `Dot`, `Checkbox`, `Button`, the `RotateCcw` icon of the repeat button, `compoundFactor`/`formatFactor`.
- `/revisao` requires a session like the other app pages.

### Untouched

The landing page, the tour, the recurring goals' automatic materialisation, the objective pages, the "Trazer para esta semana" button itself.

## Accessibility

- The dot row has an `aria-label` with the same sentence as the text ("4 de 7 dias feitos"); the dots stay decorative.
- Each checkbox is labelled with the goal title ("Repetir Correr 3x").
- The progress bars have `role="progressbar"` with values; the done state keeps its text.
- The primary button's label changes with the selection, so the outcome is announced before the click.

## Edge cases

- A week with goals but no tasks: 0 of 0 tasks, no comparison, projection on the assumed 3 days.
- Reviewing again an already reviewed week: allowed; repeats skip goals already planned, the review date updates.
- Goals whose objective was completed meanwhile cannot be repeated.
- A crafted request with another user's goal ids or a future week changes nothing.
- Daylight saving and the server's UTC clock: all day math goes through `dates.ts`.
