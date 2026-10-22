# A calmer dark theme: no glow, a soft green, grouped panels

Issue #86. The light theme does not change.

## Goal

The dark theme reads as generated: neon green on borders, numbers, buttons and dots, a glow around cards, a green stain in the background, and a stack of separate bordered cards floating on the screen. The user (2026-10-22) is bothered most by the glow, then by the cards feeling "loose". They approved option A ("Verde sóbrio") from a prototype: no glow, a flat dark background, a calmer green kept only for what matters (a day done, a ticked task, progress bars), and related cards gathered into one panel per subject.

## What the user sees (dark theme only)

- **Palette:** flat near-black page, slightly lighter surfaces, hairline borders. Values to start from (the builder may nudge them if a contrast test or a screenshot asks, and says so):
  - `--background #111214`, `--card` and `--popover #17191c`, `--border` and `--input #24272b`, `--secondary` and `--muted #26292e`, `--foreground #e7e8ea`, `--muted-foreground #8e939c`;
  - `--primary #7fd18f` (soft green), `--primary-foreground #0f1a12`, `--ring` the same soft green;
  - `--accent` a faint green tint of the surface (about 12% of the primary over `--card`), `--accent-foreground` the soft green;
  - `--chart-1`..`--chart-5` a ramp from `--muted` to the soft green.
- **No glow:** the `--glow` shadow is gone in the dark theme (every `shadow-[…var(--glow)]` already reads that token, so it becomes transparent there). The light theme keeps its own soft glow.
- **Background:** the interactive Aurora stays selectable. In the dark theme its blobs are a barely-there tint (alpha about 0.05 instead of 0.18) and the violet ("support") blobs are neutral, so the page reads flat. The other two choices ("Grade de pontos", "Nenhum") are unchanged. The default stays Aurora.
- **No coloured rail:** the 3 px green strip on the left of goal cards (today's task groups and the week progress cards) is not shown in the dark theme.
- **Done badge:** "✓ feito" is a soft pill (primary at about 15% behind soft green text), not a solid neon pill.
- **Lifetime banner** ("75 tarefas concluídas…"): no green frame or tinted fill; the number is in the normal text colour.
- **One panel per subject on Today:**
  - the left column ("Hoje"): the day's goal groups become rows of one bordered, rounded panel, separated by hairlines;
  - the right column ("Progresso da semana", and "Outras metas da semana"): the week progress cards become rows of one panel in the same way;
  - the "Seus pequenos passos" section: the compound effect and the year card become two rows of one panel.
  Spacing between panels stays as the cards had.
- **Everything else** that reads the tokens (header island, menus, dialogs, buttons, Objectives screens, landing and quiz pages) takes the new palette and loses the glow with no further layout change.

## Design

- `src/app/globals.css`: replace the `.dark` token values above; set `--glow: transparent` in `.dark`.
- `src/components/interactive-background.tsx`: dark alpha constant lowered, dark blobs use the neutral tone; light drawing untouched. Its tests keep passing with the new constants.
- Rail and badge: `src/components/today-task-group.tsx` and `src/components/week-goal-progress-card.tsx` get dark-only classes (`dark:hidden` on the rail, `dark:bg-primary/15 dark:text-primary` on the done badge). The same grouping idea as below applies to the border, background and radius of each card inside a panel.
- Panels: the lists that render these cards get a wrapper whose dark classes draw the panel (border, radius, `overflow-hidden`, surface background), while each child card drops its own border, radius, background and shadow in dark and a `dark:[&>*+*]:border-t` hairline separates rows. Builder's call: whether the wrapper lives in `fluid-day-week.tsx` or in small `PanelList` helpers, and how the week column's two lists (this goal's and the other goals') group, as long as the light theme markup renders exactly as today.
- `src/components/lifetime-progress-banner.tsx`: dark classes remove the frame and the tint and use the foreground colour for the number.
- `src/components/small-steps-section.tsx` (from #81): wraps the compound card and the year card in one panel in dark; each keeps its own look in light.
- `src/lib/theme-contrast.test.ts` already checks the dark pairs against WCAG AA; its dark expectations follow the new values.

### Untouched

The light theme (palette, shadows, gradients, layout), routes, data, server actions, the tour, search, the landing page structure.

## Accessibility

- Every foreground/background pair of the dark palette stays at WCAG AA (4.5:1), checked by `theme-contrast.test.ts`. The soft green on `--card`, the muted text on `--card` and the done badge text on its tint are the pairs to watch.
- The done state keeps its text ("✓ feito") so it is not told by colour alone.
- Reduced motion and the focus ring keep working: the ring is the soft green on the dark surface.

## Edge cases

- A user who chose "Nenhum" or the dot grid sees no change from the background work.
- A single group in a column is a panel with one row (no divider).
- Empty weeks and the guest banner: no panel is drawn around components that are not task or week cards.
- The first paint before the theme class applies: tokens are on `.dark`, so there is no extra flash beyond today's.

## Testing

- `theme-contrast.test.ts` (dark pairs pass AA with the new palette).
- A CSS test (like `globals.cards.test.ts`) that `.dark` sets `--glow` to transparent and the new `--primary`, and that `:root` still has its own glow.
- Component tests: the done badge and the rail carry the dark classes; the panel wrapper carries the panel classes and the cards inside carry the "no own border" classes; the light markup is unchanged (class snapshots of the light classes).
- `interactive-background.test.tsx` for the lower dark alpha and neutral tone.
- `npm run test:tz`; manual check of Today, Objectives, an objective and a week page in dark and light at 1280 and 1600 px, comparing the light theme against `develop` to confirm nothing moved.

## Out of scope

Reworking the Objectives list into panels, the light theme, a new default background, new animations, the landing page layout.
