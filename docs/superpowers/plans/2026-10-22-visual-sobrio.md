# Calmer Look in Both Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the glow and heavy shadows, calm the accent colour in both themes, drop the coloured rail, and gather the Today cards into one panel per subject.

**Architecture:** Almost all of it is design tokens and a few surface rules in `src/app/globals.css` (so every screen follows). The Aurora canvas gets fainter constants. Four Today components gain a `flat` prop (no own border, radius, background or shadow) and a small `PanelList` wrapper draws the shared panel with hairline dividers.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching page code), Tailwind v4, React 19, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-visual-sobrio-design.md`

## Global Constraints

- Both themes change together; structure (panels, no rail, soft badge, plain banner) is the same in both, only colours and shadows differ per theme.
- Palette starting values (copy verbatim, nudge only if `theme-contrast.test.ts` or a screenshot demands it, and ledger the change):
  - Dark: `--background #111214`, `--card` and `--popover #17191c`, `--border` and `--input #24272b`, `--secondary` and `--muted #26292e`, `--foreground` and `--card-foreground` and `--popover-foreground #e7e8ea`, `--muted-foreground #8e939c`, `--primary` and `--ring #7fd18f`, `--primary-foreground #0f1a12`, `--accent` about 12% of `--primary` over `--card` (a hex, since the contrast test parses hex), `--accent-foreground #7fd18f`, `--chart-1..5` a ramp from `--muted` to `--primary`.
  - Light: `--background #f4f6f9`, `--card` and `--popover #ffffff`, `--border` and `--input #e1e5ec`, `--secondary` and `--muted #eceff4`, `--foreground` and `--card-foreground` and `--popover-foreground #161a22`, `--muted-foreground #667085`, `--primary` and `--ring #2563c9`, `--primary-foreground #ffffff`, `--accent #e6eefb`, `--accent-foreground #1d4fa0`, `--chart-1..5` a ramp from `--muted` to `--primary`.
  - The sidebar tokens follow the matching card, border, primary and accent tokens.
- `--glow` is `transparent` in `:root` and in `.dark`. The `shadow-[…var(--glow)]` classes stay in the components; the token makes them invisible.
- Every foreground/background pair in `theme-contrast.test.ts` stays at WCAG AA, in both palettes.
- Copy and behaviour of the components do not change; only classes and a `flat` prop.
- Never run `next build` in the repo (it breaks the user's running `npm run dev`); never kill processes on the user's machine.
- Commits: detailed messages ending `Refs #86`, on `feature/86-visual-sobrio`; no push without the user's go-ahead.

## Review Focus

1. Contrast: the soft green and the calm blue on `--card` and on `--background`, muted text on both, and the done badge text on its tint all reach 4.5:1 — pinned by `theme-contrast.test.ts` in Task 1.
2. Keyboard focus rings of the task rows and links inside a panel are not clipped by the panel's `overflow-hidden` — manual check in Task 5 (switch to inset rings if clipped).
3. A panel with a single row has no stray divider, and the empty states ("Nenhuma tarefa para hoje.", empty week, guest banner) are not wrapped in a panel — tests in Task 4.
4. The light theme still gets `.card-roomy` padding after the surface rule changes — CSS test in Task 1.
5. Other screens stay legible in both themes (Objectives list, an objective, a week page, the landing page, the quiz) — manual screenshots in Task 5.

---

### Task 1: Palettes and flat surfaces

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/app/globals.cards.test.ts`, `src/lib/theme-contrast.test.ts`, `src/app/globals.landing.test.ts` (only where they assert the old look)

**Interfaces:**
- Produces: the new token values; no light `.card-surface` gradient or layered shadows; `--island-shadow` defined per theme as one soft shadow (light `0 1px 2px rgb(16 24 40 / 0.06), 0 4px 12px rgb(16 24 40 / 0.05)`, dark `0 1px 2px rgb(0 0 0 / 0.4), 0 6px 18px rgb(0 0 0 / 0.3)`).

- [ ] **Step 1: Write failing tests.** In `globals.cards.test.ts`: replace the "layered shadows and a pastel gradient" test with one that asserts the light `.card-surface` rule (if it still exists) has no `linear-gradient` and no `rgb(` shadow, and keep the two layer/padding tests. Add `globals.palette.test.ts` (read the css like the other tests) asserting: `:root` and `.dark` both set `--glow: transparent`; `:root` has `--primary: #2563c9` and `--background: #f4f6f9`; `.dark` has `--primary: #7fd18f` and `--background: #111214`; both define `--island-shadow`; `:root:not(.dark) .card-roomy` padding rule still exists.
- [ ] **Step 2: Run** `npx vitest run src/app/globals.cards.test.ts src/app/globals.palette.test.ts src/lib/theme-contrast.test.ts` — expected FAIL (old values).
- [ ] **Step 3: Implement** the token values from Global Constraints in `:root` and `.dark`, `--glow: transparent` in both, the flat light card surface, the per-theme `--island-shadow`. Update the dark expectations of `theme-contrast.test.ts` only if a value was nudged; update `globals.landing.test.ts` only for assertions about the old glow/colours.
- [ ] **Step 4: Run** the same command plus `npx vitest run src/app` — expected PASS.
- [ ] **Step 5: Commit** `feat: calmer palettes and flat card surfaces in both themes`.

### Task 2: A fainter Aurora

**Files:**
- Modify: `src/components/interactive-background.tsx`
- Test: `src/components/interactive-background.test.tsx`

**Interfaces:**
- Produces: `AURORA_ALPHA_DARK` about `0.05`; `AURORA_WASH_LIGHT` about `0.05` and `AURORA_GLOW_LIGHT` about `0.3`; in the dark theme the `'support'` blobs are drawn with `palette.neutral` instead of `palette.support`. The light drawing keeps its structure.

- [ ] **Step 1: Write failing test(s)** in `interactive-background.test.tsx`: the dark aurora's blob colour stops use at most the `0.05` alpha (assert the `addColorStop` alpha of the first stop) and the support blobs use the neutral colour rather than the support colour; the light wash alpha is at most `0.06`. Follow how the file already inspects the fake canvas context.
- [ ] **Step 2: Run** `npx vitest run src/components/interactive-background.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement** the constants and the dark `support` → neutral colour choice in `drawAurora`.
- [ ] **Step 4: Run** the same file — expected PASS.
- [ ] **Step 5: Commit** `feat: make the Aurora background much fainter`.

### Task 3: No rail, a soft done badge, a plain banner

**Files:**
- Modify: `src/components/today-task-group.tsx`, `src/components/week-goal-progress-card.tsx`, `src/components/lifetime-progress-banner.tsx`
- Test: `today-task-group.test.tsx`, `week-goal-progress-card.test.tsx`, `lifetime-progress-banner.test.tsx` (create it if there is none)

**Interfaces:**
- Produces: no `w-[3px] … bg-primary` element in the two goal cards; the done badge of `TodayTaskGroup` is `bg-primary/15 text-accent-foreground` (no solid fill, no glow class); the banner is `mb-6 flex … px-4 py-3` without `border-primary` and `bg-accent`, with the number in the default text colour (`text-foreground`).

- [ ] **Step 1: Write failing tests:** `today-task-group`: `container.querySelector('.w-\\[3px\\]')` is null, the badge of a done group has class `bg-primary/15` and not `bg-primary`; `week-goal-progress-card`: no 3 px strip; banner: the section has no class `border-primary` or `bg-accent`, and the total's element has class `text-foreground`. Keep the existing "flags a fully done group" tests (`data-complete`, `data-fulfilled`) as they are.
- [ ] **Step 2: Run** the three test files — expected FAIL.
- [ ] **Step 3: Implement** the class changes in the three components.
- [ ] **Step 4: Run** the three test files plus `npx vitest run src/components` — expected PASS.
- [ ] **Step 5: Commit** `feat: drop the coloured rail, soften the done badge and plain banner`.

### Task 4: One panel per subject on Today

**Files:**
- Create: `src/components/panel-list.tsx`
- Modify: `src/components/today-task-group.tsx`, `src/components/week-goal-progress-card.tsx`, `src/components/compound-effect-card.tsx`, `src/components/year-dots-card.tsx`, `src/components/fluid-day-week.tsx`, `src/components/small-steps-section.tsx`
- Test: `src/components/panel-list.test.tsx`, plus the existing tests of the five modified components

**Interfaces:**
- Produces: `PanelList({ children, className }: { children: ReactNode; className?: string })` rendering `<div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card …">`; an optional `flat?: boolean` prop (default `false`) on `TodayTaskGroup`, `WeekGoalProgressCard`, `CompoundEffectCard` and `YearDotsCard` that, when true, removes the component's own border, rounding, background and shadow (keeps its padding and `data-complete`/`data-fulfilled`).

- [ ] **Step 1: Write failing tests:** `panel-list.test.tsx`: renders its children inside one element with `divide-y` and `rounded-lg`, and renders nothing when given no children; for each of the four components, `flat` removes the classes `rounded-lg`/`border`/`bg-card` from the root (assert on the root element's classes) and the default render is unchanged; `fluid-day-week.test.tsx`: with two goals, the day's groups are inside one `divide-y` panel and the week cards are inside one panel; with a single group there is one panel and one row; with no tasks today the text "Nenhuma tarefa para hoje." is not inside a panel; `small-steps-section.test.tsx`: the compound card and the year card share one panel.
- [ ] **Step 2: Run** `npx vitest run src/components/panel-list.test.tsx src/components/fluid-day-week.test.tsx src/components/small-steps-section.test.tsx src/components/today-task-group.test.tsx src/components/week-goal-progress-card.test.tsx src/components/compound-effect-card.test.tsx src/components/year-dots-card.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement** `PanelList` and the `flat` prop; in `fluid-day-week.tsx` wrap the day's groups in one `PanelList` (replacing the `gap-3` column), and the week column in two `PanelList`s (goals with tasks today, and "outras metas da semana" under its label) with `flat` children; in `small-steps-section.tsx` wrap `CompoundEffectCard flat` and `YearDotsCard flat` in one `PanelList`. The empty states stay outside any panel.
- [ ] **Step 4: Run** the same command plus `npx vitest run src/components src/app` — expected PASS.
- [ ] **Step 5: Commit** `feat: gather the Today cards into one panel per subject`.

### Task 5: Full verification

- [ ] **Step 1:** `npm run lint` and `npx tsc --noEmit` — no errors.
- [ ] **Step 2:** `npm run test:tz` (run it with nothing else heavy running) — all pass in UTC, America/Sao_Paulo and America/Rio_Branco.
- [ ] **Step 3:** With the user's `npm run dev` (use `preview_start` only if it is not running; no build), as a guest, check in both themes at 1280 and 1600 px: Today (panels, no glow, soft badge, small steps panel), Objectives, an objective page, a week page, the landing page and the quiz. Tab through the task rows inside a panel and confirm the focus ring is not clipped (use inset rings if it is). Compare the light theme against `develop` to see that only the intended things moved. Screenshots for the user.
- [ ] **Step 4:** Commit any fixes; ask the user before pushing and opening the PR to `develop` (`Closes #86`, repo template, attribution block, board #2).
