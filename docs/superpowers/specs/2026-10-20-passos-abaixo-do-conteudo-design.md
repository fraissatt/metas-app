# "Seus pequenos passos" below the Today content

Issue #81. Follows the dot calendar and compound effect of #74 (spec `2026-10-20-calendario-pontinhos-design.md`), which put them in side rails. Desktop and phone share the new layout, but the phone polish is a later issue.

## Goal

The side rails sit against the screen edge and look unfinished. Move the compound effect and the calendar into a section **below the current Today content**, in the same column and width as the rest, so the page always ends with something and never looks empty at the bottom. Approved by the user on 2026-10-20 after a prototype (option C2 with a month button): the compound effect on top, the whole year as dots below it, and a small button that opens the month in a centred window.

## What the user sees

- **Where:** a section under the existing content on every signed-in Today screen that had the rails (planned week, and the empty-week screens). It has the same width as the `<main>` above it, a quiet heading "Seus pequenos passos", and no rails on the sides at any screen width.
- **Compound effect card:** unchanged from #74 (text, singular form, N = 0 invitation, decorative curve).
- **Year card, in the page:** the year as a dot grid, one column per week, Monday first, month labels over the columns, today with a ring. Title row: the year with previous and next arrows (back to the year the user started, as in #74), and at the end of the row a small button **"Ver o mês"**. Under the grid: `{N} dias feitos em {ano}` and the three-tone legend. The grid fills the card width; if the card is too narrow for it, the grid scrolls sideways inside the card, never the page.
- **"Ver o mês":** opens a dialog in the middle of the screen, in the style of today's year dialog, only to check. It shows the month as a Monday-first dot grid with weekday initials, today ringed, `{X} de {Y} dias feitos` and the legend. Its title is the month and year with previous and next arrows; it opens on the current month and goes back as far as January of `firstYear`, where the previous arrow stops. Next is disabled on the current month. The first-dot hint ("Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.") shows in the month dialog and under the year grid while no day is done yet.
- **Removed:** the side rails, and the year dialog (`Ver o ano`). The year is now in the page.

## Rules (unchanged from #74)

Tones (empty, partial, done at 60%), a day's tasks bucketed by the task's planned date in the Brasília time zone, future days empty, days done counted all-time, 1% per day done for the compound effect, formats and copy for the compound card. `getDayDots(year?)` stays as it is.

## Design

### Units

- `src/components/today-rails.tsx` and `src/components/month-dots.tsx` (the rail version) are replaced; `src/components/compound-effect-card.tsx`, `dot.tsx`, `src/lib/day-dots.ts`, `getDayDots` and `dates.ts` helpers stay.
- `src/components/small-steps-section.tsx` (server): the heading, `CompoundEffectCard` and `YearDotsCard`; takes `data: DayDotsYear`, no width prop. Used by both branches of `src/app/page.tsx` right after the `<main>` content, inside the same column.
- `src/components/year-dots-card.tsx` (client): the year card with arrows and the "Ver o mês" button. Holds the shown year in state like today's dialog does and resets to the page's `initial` when the page sends new data (a task was ticked), so the card never shows stale dots; loads other years through `loadYear(year)` (`getDayDots`).
- `src/components/month-dots-dialog.tsx` (client): the month window. Receives the shown year's dots and `loadYear`; moves between months, loading the adjacent year when the arrows cross January or December. Builds its grid from the dots of the chosen month (`getMonthDays` + `appWeekdayIndex` for the leading blanks).
- `src/lib/day-dots.ts` gains `monthFromDots(dots, year, month)` (pure) returning the month's dots by `yyyy-MM`, so the dialog does not repeat the filtering.

### Changed

- `src/app/page.tsx`: drop `TodayRails`; render `SmallStepsSection` after the content in the planned-week and empty-week branches. The `<main>` keeps its current classes and width, and the section lives inside it so it follows the same width on its own (`lg:max-w-6xl` on the planned week, `max-w-2xl` on the empty ones).
- Tests that referred to the rails (`today-rails.test.tsx`, `month-dots.test.tsx`, `year-dots-dialog.test.tsx`, the rails assertions in `page.test.tsx`) are replaced by tests of the new units.

### Untouched

Compound card, dot component, tone and factor math, the server action, routes, auth, schema (no migration), the tasks and week progress above.

## Accessibility

- The year grid and the month grid are each one labelled image (`role="img"`, "2026: N dias feitos", "outubro de 2026: X de Y dias feitos"); the dots stay `aria-hidden` with a `title` for mouse users.
- The year arrows and the month arrows are real buttons with "Ano anterior / Próximo ano" and "Mês anterior / Próximo mês" labels. A disabled end uses `aria-disabled` and ignores the click instead of `disabled`, so keyboard focus does not drop out of the button, and the title of each has `aria-live="polite"` so a change of year or month is announced (both were minor findings of the #74 review).
- "Ver o mês" is a button; the dialog returns focus to it on close and closes with Escape.

## Edge cases

- New user with no tasks: all dots empty, the hint shown, no year arrows (`firstYear` is the current year); the month arrows still go back to January of this year.
- Month arrows across a year boundary load the other year; the year card and the month dialog keep their own shown period, so closing the dialog leaves the year card where it was.
- A page refresh after ticking a task updates both the year card and, on next open, the dialog.
- Narrow screens: the section is full width of the column; the year grid scrolls sideways inside its card. The phone layout is not tuned in this issue.

## Testing

- `day-dots.test.ts`: `monthFromDots` (blank-day months, a 28-day February, a leap February).
- `year-dots-card.test.tsx`: heading, grid label and total, arrows load other years and disable at the ends without losing focus, hidden with a single year, the title is a live region, and the card shows the new data after the page re-renders with a new `initial` (red before the fix).
- `month-dots-dialog.test.tsx`: opens on the current month with the right grid label and blanks, previous and next move the month, crossing January loads the previous year, next is disabled on the current month, Escape closes and focus returns to "Ver o mês".
- `small-steps-section.test.tsx`: heading, compound card and year card render; the first-dot hint shows only with no day done.
- `page.test.tsx`: the section renders after the content on the planned-week and empty-week screens, and no side rails remain.
- `npm run test:tz`; manual check in the browser at 1280, 1600 and 1920 px, light and dark, opening the month window and moving back through months.

## Out of scope

Phone layout tuning, the day-level detail on hover beyond the existing `title`, changing the 60% threshold, streaks.
