# Pace chart on each objective

Issue #133. Prototype approved by the user on 2026-11-05 (option B): https://claude.ai/artifact/Ami9CbmCrQr8MzLG5k9soW

## Goal

The objective page shows weekly bars, which say what happened but not whether the pace is near the ideal or where it is heading. A continuous line chart answers that at a glance: real progress against an ideal line and a dotted projection at the current pace.

## Principle

The chart never punishes. The real line only rises or stays flat; a stopped week is "neutral", never a drop. Falling behind shows as the distance to the ideal line, written in a welcoming tone ("faltam 12 pontos para o ritmo ideal"), with no red and no minus sign. This follows the app's existing rule of not showing a user who did nothing wrong something that reads as failure.

## What the user sees

- **Where:** a card on `/objectives/[id]`, replacing the weekly bar chart's place in the page (the bars component stays in the code until the user decides to drop it; this change adds, it does not remove).
- **Three lines**, 0–100 % of the objective's planned tasks on the vertical axis, days on the horizontal:
  1. **Ideal** (dashed, gray): rises evenly through the plan and ends at **93 %** (the middle of the 90–95 % the user asked for).
  2. **Real** (solid): completed tasks accumulated, up to today.
  3. **Projection** (dotted): from today at the current pace, to the end of the range.
- **Summary line above the chart**, in plain words: done %, ideal % for today, projected % at the end. When behind: "Faltam N pontos para o ritmo ideal." When ahead or level: "Você está no ritmo ou à frente." Optionally a concrete nudge from the projection ("com N tarefas a mais por semana você chega aos 93 %"), shown only when behind.
- **Period selector:** 30 dias, 60 dias and "Prazo todo" as a row of toggle buttons. Options longer than the objective's own span are not offered; the range never goes past the objective's end.
- **Hover:** a crosshair and tooltip with the day, done % and ideal % (and "projeção" on the dotted part).
- **Legend** with the three lines, sober colors, both themes, no glow. Colors come from the existing tokens (`--primary` for the real line, `--muted-foreground` for the ideal).
- **Empty states:** no tasks at all → "Sem tarefas planejadas ainda para gerar o gráfico." Objective already completed → no projection, the real line runs to the completion day.

## Design

- `src/lib/pace.ts`, pure and independent of the screen (so the later "all objectives" view can call it with several objectives): `buildPaceSeries({ tasks, startDate, endDate, today, goal })` where `tasks` are `{ date, completedAt }` of the objective. Returns the daily points `{ day, ideal, real | null, projection | null }` plus the summary numbers. All day math through `src/lib/dates.ts` (the only module allowed to do it).
- **Ideal:** the share of planned tasks dated up to each day, scaled to 93 % at the end. It follows the real shape of the plan (a week with more tasks lifts the line more), not a straight diagonal.
- **Real:** tasks completed up to each day, as a share of all planned tasks, using `completedAt` (the day it was actually done, not the day it was scheduled).
- **Projection:** pace = tasks completed in the last 14 days of the range up to today divided by 14 (fewer days if the objective is younger), extended linearly and capped at 100 %.
- **End of the range:** the objective's `targetDate`; with none, the date of its last planned task.
- `src/lib/actions/progress.ts` gets `getObjectivePaceInput(objectiveId)` (requires the user, owned objective only) returning the tasks and dates; the page passes them to a client component `src/components/objective-pace-chart.tsx` (recharts, already a dependency) that owns the period selector and calls `buildPaceSeries`.
- No schema change.

## Calls I made

- **93 %** as the ideal ceiling, the middle of the user's 90–95 %. One constant in `pace.ts`, easy to change.
- **The plan is the tasks that exist.** Weeks are materialized over time, so the denominator grows as new weeks are added; the real and ideal lines are recomputed against the current total each time. Noted here so it does not read as a bug.
- **14-day window** for the pace, so one idle week does not flatten the projection forever and one great week does not inflate it.
- The existing bar chart is kept for now.

## Out of scope

The combined view across all objectives (a later delivery, which reuses `buildPaceSeries`), changes to how tasks are created or completed, notifications about pace.

## Tests

`pace.test.ts` for the series (ideal ends at 93 %, real never decreases, idle weeks are flat, projection capped at 100 %, objective without `targetDate`, completed objective, empty objective, run in UTC and America/Sao_Paulo like the rest of the suite); a render test for the card (selector options limited to the objective's span, summary wording when behind and when ahead, empty state).
