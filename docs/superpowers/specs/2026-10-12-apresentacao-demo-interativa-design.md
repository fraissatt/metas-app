# Interactive Presentation Demo Design

Status: design approved in chat (2026-10-12); this is the written spec. Next step: review it, then write the implementation plan. Tracked in issue #53. It supersedes the screenshot-based layout first drafted in that issue: screenshots were rejected as looking amateur.

## Goal

The presentation page at `/` should show the app working, not a picture of it. A live demo, built from the app's own components with made-up data, sits next to a three-step explanation and follows the reader's scroll: as each step reaches the middle of the window, the demo switches to the matching view. The demo is also clickable.

## Page layout (one column, top to bottom)

1. **Start (unchanged):** title, tagline, the three entry actions and the guest note.
2. **"Como funciona" with the demo (new):** three steps on one side and a sticky demo on the other (below).
3. **"E também" (kept):** three cards (Modo visitante, Quiz de plano, App instalável).
4. **Closing (kept):** "Pronto para começar?" with the entry actions again, then the footer.

The static screenshot figure and the two images in `public/landing` are removed.

## The scroll-driven demo

- **Desktop (from `lg`):** two columns. The steps scroll on the left; the demo is `sticky` on the right (`top` below the header) and stays in view while the steps pass.
- **Phone:** a single column. The demo is `sticky` just under the header, compact (up to about half the window height, its content scrolls inside it), and the steps scroll beneath it.
- **Active step:** an `IntersectionObserver` on the three step items (root margin that keeps only a band around the middle of the window) sets `active` to 0, 1 or 2. The active step is highlighted in its colour and has `aria-current="step"`. The first step is active on load. Where `IntersectionObserver` does not exist, step 1 stays active and the steps are still readable.
- **Views, one per step:**

  | Step | Colour | Demo view |
  | --- | --- | --- |
  | 1 Objetivo | green | An objective card: title, target date, time elapsed and weeks fulfilled. A small view in the app's visual style. |
  | 2 Meta da semana | blue | The week's goals as the real `WeekGoalProgressCard`s (progress ring, day bars). |
  | 3 Tarefa do dia | amber | Hoje as the real `TodayTaskGroup`s, with clickable tasks. |

- Switching views fades the new one in (`tour-step-in` keyframes, same as the tour), instantly under `prefers-reduced-motion`.
- **Shared state:** the tasks live in the demo component's memory. Ticking a task in step 3 updates the rings and bars in step 2 and the objective's weeks in step 1, so the three views tell one story.
- **Interactions in the demo:** ticking and unticking tasks; a "Recomeçar" button restoring the initial data; a small hint, "Experimente: marque uma tarefa", that disappears after the first tick.
- **The "⋯" menu is hidden:** `TodayTaskGroup` already hides it when no update or delete handler is passed, so the demo passes none.
- **Links are disabled in the demo:** the real cards link to `/objectives/...`, which a visitor cannot open. A capture handler on the demo container cancels clicks on anchors, and the anchors are taken out of the tab order, so nothing in the demo navigates.

## Data

- `src/lib/landing-demo.ts` builds the demo objects for the current Brasília week with the date helpers in `src/lib/dates.ts` (no raw date maths): one objective with two or three weekly goals, each with tasks over the week's days, the earlier days done and today's open. Objects carry every field the real components read (ids, titles, dates, `completed`, the objective on each goal).
- It is built in the server component and passed to the client demo as props (dates serialise through the RSC payload), so server and client render the same.
- No database, no server action, no cookie.

## Other scroll behaviour

- "E também" and the closing section fade up as they enter the window using CSS scroll-driven animation (`animation-timeline: view()`) inside `@supports`, so browsers without it simply show them. No JavaScript for this.

## Components and files

- `src/lib/landing-demo.ts` (new): `buildLandingDemo(now)` returning `{ objective, goals, tasks }`.
- `src/components/landing-flow.tsx` (new, client): the two-column section; owns the active step and renders the steps and `LandingDemo`.
- `src/components/landing-demo.tsx` (new, client): the sticky panel; owns the tasks state, the hint, "Recomeçar", the link guard and the three views.
- `src/components/landing-step.tsx`: gains `active` styling and `aria-current`.
- `src/components/landing.tsx`: drops the figure and the images; renders `LandingFlow` in the "Como funciona" section.
- `src/app/globals.css`: the view fade class, the `@supports` scroll reveal, and the sticky helpers.
- Removed: `public/landing/*`.

## Accessibility

- The demo is a labelled region ("Demonstração interativa") with a polite live message "Passo 2 de 3: Meta da semana" that updates when the step changes.
- Steps stay an ordered list with real headings; colour is never the only signal (numbers and titles carry the meaning).
- Everything clickable in the demo is a real button or checkbox from the app's components, reachable by keyboard; links inside it are inert.
- Reduced motion: no fade, no scroll reveal.

## Error handling

- The demo has no I/O and cannot fail at runtime. If `IntersectionObserver` is missing, the page falls back to step 1.
- The reset button always restores the initial data object, so the demo can be put back after any clicks.

## Testing

- `buildLandingDemo`: the week's goals and tasks match the current Brasília week, today has open tasks, past days are done, ids are unique; run under the three-zone runner.
- `LandingDemo`: ticking a task updates the day badge and the weekly progress; unticking reverts; "Recomeçar" restores; the hint goes away after the first tick; no "⋯" menu; clicking a link inside does not navigate.
- `LandingFlow` with a mocked `IntersectionObserver`: the first step is active at start; reporting step 2 or 3 as intersecting changes the active step, `aria-current` and the demo view; without `IntersectionObserver` step 1 stays active.
- Landing tests updated: the figure and images are gone; sections in order; steps list; extras; closing actions.
- A CSS test pins the reduced-motion guard for the view fade and the `@supports` guard for the scroll reveal.
- Checked in the browser at desktop and phone widths, both themes, by scrolling and clicking.

## Docs and release

- README: the presentation page bullet describes the live demo; the old screenshot entry is replaced by a short description (no image).
- Ships as v1.5.0 together with the "?" button, when the owner decides to release.

## Out of scope

- Screenshots or recorded videos of the app on the page.
- Reusing the real objective card (it carries links and actions that make no sense in a demo).
- A new animation library, and persistence of the demo state.
