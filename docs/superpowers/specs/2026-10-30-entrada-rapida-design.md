# Quick entry of tasks on Hoje

Issue #115. Prototype approved by the user on 2026-10-30: https://claude.ai/artifact/Bv7bKNGZuNHFT5mHWceXDm

## Goal

Adding a task today takes several steps (open the objective, the week's goal, the form). People who use the app every day want to write it down on the spot. A field at the top of the "Hoje" column creates the task in the day, in one of this week's goals, with Enter.

## What the user sees

- **Where:** between the "Hoje" heading and the day's list, shown only when the week has at least one goal (an empty week keeps the existing empty state).
- **Resting:** a bordered row like the panels: a plus icon, the placeholder "O que você vai fazer hoje?" and, from the `sm` breakpoint up, a muted chip with the goal that will receive the task ("Treinar 3x na semana"). On a phone the chip is left out to keep one line.
- **Focused or typing:** the row gets the focus ring and an "Adicionar" button (desktop: with an "Enter" hint; phone: a round arrow button beside the text, above the keyboard). Under the text, "Em qual meta" and the week's goals as chips (a group of toggle buttons); the chosen one is highlighted. With a single goal there is nothing to choose, so the chips are left out. On a phone the chips stay on one line and scroll sideways.
- **Adding:** Enter or the button creates the task for today, in the chosen goal. The field empties at once and keeps focus, so the next task can be typed while this one is saved; the list and the goal counters update from the server.
- **The default goal:** the last one chosen on this browser, which holds for the current week only because weekly goals get new ids every week (kept in localStorage; nothing breaks if it is unavailable), otherwise the first goal that already has tasks today, otherwise the first of the week.
- **Errors:** if the task can't be created, the text comes back (unless another is already being typed) and a line under the field says "Não deu para adicionar. Tente de novo."

## Design

- `createTodayTask(weeklyGoalId, title)` in `src/lib/actions/dailyTasks.ts`: requires the user, accepts only the user's own goal of the **current week**, trims the title (required, at most 200 characters), creates the task dated today in Brasília (`appToday`), revalidates the goal's pages and `/`. The date is decided on the server, never sent by the client.
- `src/components/quick-add-task.tsx`: the field. Receives the goals in the order to offer them (the ones with tasks today first) and the action.
- `src/components/fluid-day-week.tsx` renders it under the heading; `src/app/page.tsx` passes the action.
- No schema change.

## Calls I made

- The default goal is remembered per browser instead of from the last task created: tasks have no creation date, and a per-viewer convenience does not deserve a column.
- No optimistic insert: the action revalidates `/` and the new task arrives with the next render; the field itself clears at once.
- The "Entra em hoje, sex 30/10." line of the prototype is dropped: the date would be formatted on the client and could differ from the server's. The placeholder already says "hoje".

## Untouched

The objective and weekly-goal pages and their forms, the existing `createDailyTask` and `createDailyTasks`.

## Hardening after the independent review

- Tapping a goal or the button keeps focus on the field (`mousedown` is prevented), because Safari and iOS Safari do not focus buttons and the options would close before the tap landed.
- Enter that confirms an IME composition does not submit.
- A page left open across Monday 00:00 in Brasília gets an error on submit (the goals shown belong to last week); the page refreshes itself when the window regains focus, and the next try uses the new week's goals.
