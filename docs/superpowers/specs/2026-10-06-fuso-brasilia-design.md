# Fixed Brasília Time Zone Design (draft, planning only)

Status: decision taken, not implemented. Next step: review this draft, then write the implementation plan.

## Problem

On the live site, dates move by a day. Locally the server and the browser both run on Brasília time (UTC−3), so the bug never shows in development. On Vercel the server runs on UTC.

**Reproduced (2026-10-06):**
1. A weekly goal created for the week of 05/10 is saved with `weekStart` = `2026-10-05T00:00Z`. The server parses `yyyy-MM-dd` and takes `startOfWeek` in UTC.
2. The browser in Brasília reads that instant as 04/10 at 21:00. `getWeekDays(weekStart)` therefore builds the day chips from Sunday 04/10. The first chip is labelled "SEG" but shows the number 4.
3. A chip submits `2026-10-04`, the server stores `2026-10-04T00:00Z`, and the browser displays it as 03/10. The user saw tasks on 03/10 and 04/10 and deleted them by hand.

**Same root cause elsewhere:**
- **Hoje after 21:00:** "today" on the server is `startOfDay(new Date())` in UTC, so after 21:00 in Brasília, Hoje already shows the next day's tasks.
- **Day-based logic:** current week, streaks, the day summary and recurrence materialization can all be off by a day around midnight UTC.

## Decision

**Option A: one fixed app time zone, `America/Sao_Paulo`, for every calendar computation**, on the server and in the browser, whatever the machine's time zone.

The user's choice follows the app's audience (pt-BR). Per-visitor time zones (option B) were considered and deferred.

## Approach

### Date model

- **Calendar dates** (task date, `weekStart`/`weekEnd`, objective start/target/completed day) stay stored as `DateTime`. They mean "a day in Brasília".
- **One module** (`src/lib/dates.ts`) owns every conversion. It is built on `@date-fns/tz` (`TZDate`, `tz('America/Sao_Paulo')`) and exposes:
  - `APP_TIME_ZONE = 'America/Sao_Paulo'`;
  - `today()`: the current day in Brasília;
  - `parseDay(yyyyMmDd)`: the start of that day in Brasília;
  - `formatDayKey(date)`: `yyyy-MM-dd` in Brasília;
  - `getWeekBounds(date)` and `getWeekDays(weekStart)`, computed in Brasília;
  - `isSameAppDay(a, b)`;
  - display helpers that format with `timeZone: APP_TIME_ZONE` (the `Intl` formatters already used in `dates.ts`).
- **No direct date math elsewhere:** nothing outside that module calls `startOfDay`, `endOfDay`, `isSameDay`, `parseISO`, `format(date, 'yyyy-MM-dd')` or `new Date()` "as today" for calendar purposes.
- **Timestamps stay true instants:** `completedAt`, `createdAt`, `lastSeenAt`, sessions and funnel events are unchanged.

### Files to migrate

These files do date math today; each call moves to the module:
- `src/lib/dates.ts`, `src/lib/stats.ts`, `src/lib/objective-dashboard.ts`, `src/lib/quiz/build-plan.ts`;
- `src/lib/guest/demo-data.ts`, `src/lib/guest/seed.ts`;
- `src/lib/actions/{dailyTasks,weeklyGoals,objectives,progress,quiz,stats,summary,validation}.ts`;
- `src/components/{weekly-goal-tasks,task-item,past-week-row,weekly-goal-day-chart,week-goal-progress-card,onboarding-quiz}.tsx`;
- `src/app/page.tsx` and `src/app/objectives/page.tsx`, plus the edit pages under `src/app/objectives/[id]/…`.

These use dates only as timestamps; they get a quick check and probably no change: `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/guest/cleanup.ts`, `src/lib/guest/throttle.ts`.

### Testing

- **Run the suite twice:** under `TZ=UTC` (Vercel) and `TZ=America/Sao_Paulo` (local), for example with two `vitest` scripts or a matrix. Every test must pass in both; that is what would have caught this bug.
- **Regression tests for the reproduced case:**
  - a goal for the week of 05/10 yields chips "SEG 5 … DOM 11";
  - choosing "SEG 5" stores and displays 05/10;
  - at 22:00 in Brasília on 06/10, "today" is still 06/10 when the process runs on UTC.

### Existing data on the live site

Tasks created through the day chips before the fix were saved one day early, on the day the shifted chip showed. After the fix they display as the day they were stored, so they still sit one day before what the user meant.

**Plan:**
1. Run a read-only check to list, per user, tasks whose date falls outside their goal's week or on the day before the intended weekday.
2. Show the count to the user.
3. Only with the user's go-ahead, run a one-off script that moves those tasks forward by one day.

Guest data expires on its own and is excluded.

### README

Add a "Fuso horário" note under "Decisões de projeto": every date is a calendar day in Brasília (`America/Sao_Paulo`) wherever the code runs. Explain why: Vercel runs on UTC, a fixed zone keeps server and browser in agreement, and the trade-off is that visitors abroad see Brasília's "today".

## Non-goals

- Per-user time zones (option B).
- A schema change. If the migration shows that a dedicated `@db.Date` column is simpler, raise it in the plan before doing it.
