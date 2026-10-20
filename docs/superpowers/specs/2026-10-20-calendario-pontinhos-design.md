# Dot calendar and compound effect on the Today screen

Issue #74. Desktop only for now; the phone version is out of scope and will be designed later.

## Goal

The Today screen should remind the user, every time they open it, why the small daily steps matter. Two pieces sit in the side margins of the page on wide screens: on the left, the **compound effect** of the days they have kept ("1% better each day done"); on the right, a **dot calendar** of the current month, one dot per day, lit by how much of that day was done. A link opens the whole **year** as a grid of dots, as a "plus" to their dedication.

Approved by the user on 2026-10-20: option B (compound effect) plus their own idea (dot calendar with a year view), the three-tone dots with a 60% threshold, the year opening from a link, and the compound effect counted per day done, not per task.

## What the user sees

- **Where:** only on wide screens, in a narrow column on each side of the Today content. Below that width nothing changes: no rail, no reflow of the tasks and week progress.
- **Left rail, compound effect:** a small card, "1% melhor a cada dia feito", with "Seus N dias feitos já valem X×" where X = 1.01^N. With N = 0 it reads "Cada dia feito soma 1%." A small rising curve under the text is decorative.
- **Right rail, month:** the current month's name and year, weekday initials (S T Q Q S S D, Monday first, as the app's weeks), and one dot per day in a 7-column grid with blank leading cells. Below it: "X de Y dias feitos", where Y is the days of the month up to and including today.
- **Dot tones (three):**
  - *empty*: no task done that day, a day with no tasks, or a day still in the future (muted colour);
  - *partial*: at least one task done, but under 60% of that day's tasks (primary colour at reduced opacity);
  - *done*: 60% or more of that day's tasks done (full primary colour).
  Today has an outline ring in the primary colour, whatever its tone. Dark theme uses the neon green, light theme the blue, through `--primary`.
- **"Ver o ano":** a link under the month opens a dialog with the current calendar year as a grid: one column per week (Monday first), one row per weekday, the same three tones, month labels above the columns and the same legend as the month. A line under it: "N dias feitos em 2026".

## Rules

- **Which tasks count for a day:** the `DailyTask` rows whose `date` falls on that app day (`America/Sao_Paulo`, the existing `startOfAppDay`/`isSameAppDay` helpers), owned by the user through `weeklyGoal.objective.userId`. A day's ratio is completed tasks / tasks planned for that day. `completedAt` is not used for the calendar: a task done late still lights the day it was planned for.
- **Threshold:** `ratio >= 0.6` is done; `0 < ratio < 0.6` is partial; otherwise empty. 60% is a named constant.
- **Days done (N) for the compound effect:** all-time count of days with tone *done*, not limited to the year.
- **X formatting:** pt-BR, one decimal under 100 (`5,6×`), whole number from 100 up (`144×`).

## Design

### Units

- `src/lib/day-dots.ts` (pure): `dayTone(completed, total)` returns `'empty' | 'partial' | 'done'`; `buildDayDots(tasks, from, to, today)` turns `{ date, completed }[]` into one entry per app day in the range with its tone (future days empty); `countDaysDone(tasks)`; `compoundFactor(daysDone)` and `formatFactor(x)`. No DB, no DOM.
- `src/lib/actions/stats.ts`: a new server action `getDayDots()` returning the current year's day entries (Jan 1 to Dec 31, future days empty) and the all-time `daysDone`. One query for the year's tasks (`date` within the year, selecting only `date` and `completed`) and one grouped read for all-time days done. Reads only, safe under prefetch.
- `src/components/compound-effect-card.tsx` (server): the left rail card from `daysDone`.
- `src/components/month-dots.tsx` (server): the right rail month grid from the year's entries filtered to the current month, the "X de Y" line and the "Ver o ano" trigger.
- `src/components/year-dots-dialog.tsx` (client): the dialog with the year grid, built on the existing `src/components/ui/dialog.tsx`.

### Changed

- `src/app/page.tsx`: in the planned-week branch (S3), wrap the current `<main>` content with the two rails on wide screens. The rails are hidden below the breakpoint with CSS (`hidden` + breakpoint `block`), so the narrow layout is untouched. Builder's call: the breakpoint (the screenshot at 1536 px leaves about 190 px per side next to `lg:max-w-6xl`, so `2xl` with rails of about 170 px is the starting point) and whether the rails are grid columns or positioned outside the content box, as long as the content column keeps its current width.
- The empty-week branches (S2/S2b) do not get the rails in this issue.

### Untouched

The lifetime progress banner, the header day summary, tasks, week progress, routes, auth, schema (no migration).

## Accessibility

- Each grid is one labelled image for screen readers (`role="img"` with an `aria-label` like "Outubro de 2026: 14 de 20 dias feitos"); individual dots are `aria-hidden` and carry a `title` with the date and its tone for mouse users.
- Tones are not told by colour alone in the legend: the legend names them in text.
- "Ver o ano" is a real button that opens the dialog; focus returns to it on close.

## Edge cases

- New user with no tasks: every dot empty, "0 de Y dias feitos", compound card in its N = 0 form.
- A day whose tasks were all deleted has no tasks, so it is empty.
- Today before any task is done: empty with the ring.
- Month or year boundaries and DST: day keys come from the app-timezone helpers, never from UTC dates.
- Large N: X grows fast (365 days ≈ 37,8×, 730 ≈ 1.427×); formatting keeps it short with a thousands separator.

## Testing

- `day-dots.test.ts`: tone thresholds (0, 59%, 60%, 100%, no tasks), future days empty, day bucketing across the São Paulo midnight, `countDaysDone`, `compoundFactor`/`formatFactor` (0, 70, 365, 1000).
- Action test for `getDayDots`: only the user's tasks, the year range, all-time days done.
- `month-dots.test.tsx`: leading blanks for a month starting on Thursday, today's ring, "X de Y" text, the labelled image.
- `year-dots-dialog.test.tsx`: opens from "Ver o ano", shows 7 rows and the year's weeks, closes and returns focus.
- `compound-effect-card.test.tsx`: N = 0 copy and a formatted factor.
- `page.test.tsx`: the rails render in the planned-week branch and not in the empty branches.
- Manual: 1536 px and wider, a narrower desktop, light and dark themes.

## Out of scope

Phone layout, rails on the empty-week screens, browsing previous years, changing the 60% threshold from the UI, streaks.
