# A calmer look in both themes: no glow, a soft accent, grouped panels

Issue #86.

## Goal

The app reads as generated. In the dark theme: neon green on borders, numbers, buttons and dots, a glow around cards, a green stain in the background. In the light theme: layered bluish shadows, a white-to-ice gradient on every card and an electric blue as the accent. In both: a stack of separate bordered cards floating on the screen, and a coloured strip on the left of the goal cards. The user (2026-10-22) is bothered most by the glow, then by the cards feeling "loose". They approved, from a prototype, option A ("Verde sóbrio") for the dark theme and a matching proposal for the light theme: no glow, almost no shadow, a calmer accent kept only for what matters (a day done, a ticked task, progress bars), a flat background, and related cards gathered into one panel per subject. Both themes are done together.

## What the user sees

- **Dark palette** (starting values; the builder may nudge them if a contrast test or a screenshot asks, and says so):
  - `--background #111214`, `--card` and `--popover #17191c`, `--border` and `--input #24272b`, `--secondary` and `--muted #26292e`, `--foreground #e7e8ea`, `--muted-foreground #8e939c`;
  - `--primary #7fd18f` (soft green), `--primary-foreground #0f1a12`, `--ring` the same;
  - `--accent` a faint tint of the primary over `--card` (about 12%), `--accent-foreground` the soft green;
  - `--chart-1`..`--chart-5` a ramp from `--muted` to the soft green.
- **Light palette** (same rule for nudging):
  - `--background #f4f6f9` (a light cool grey instead of the ice blue), `--card` and `--popover #ffffff`, `--border` and `--input #e1e5ec`, `--secondary` and `--muted #eceff4`, `--foreground #161a22`, `--muted-foreground #667085`;
  - `--primary #2563c9` (a calmer blue), `--primary-foreground #ffffff`, `--ring` the same;
  - `--accent #e6eefb`, `--accent-foreground #1d4fa0`;
  - `--chart-1`..`--chart-5` a ramp from `--muted` to the blue.
- **No glow in either theme:** `--glow` is transparent in `:root` and in `.dark`, so every `shadow-[…var(--glow)]` becomes no shadow without editing the components.
- **Flat cards in the light theme:** the light `.card-surface` gradient and its layered bluish shadows are removed; a card is white with a hairline border. The extra padding of `.card-roomy` in light stays. The floating header and phone bar (`--island-shadow`) keep their glass look but with one soft neutral shadow in each theme.
- **Background:** the interactive Aurora stays selectable. Dark: a barely-there tint (alpha about 0.05 instead of 0.18) with neutral blobs instead of the violet ones. Light: the blue wash and the white spots are much fainter (about a third of today's strength). "Grade de pontos" and "Nenhum" are unchanged. The default stays Aurora.
- **No coloured rail:** the 3 px strip on the left of goal cards (today's task groups and the week progress cards) is gone, in both themes.
- **Done badge:** "✓ feito" is a soft pill (primary at about 15% behind accent-coloured text), not a solid pill with a glow.
- **Lifetime banner** ("75 tarefas concluídas…"): no coloured frame or tinted fill; the number is in the normal text colour.
- **One panel per subject on Today** (both themes):
  - the left column ("Hoje"): the day's goal groups become rows of one bordered, rounded panel separated by hairlines;
  - the right column ("Progresso da semana" and "Outras metas da semana"): the week progress cards become rows of one panel in the same way;
  - the "Seus pequenos passos" section: the compound effect and the year card become two rows of one panel.
  Spacing between panels stays as the cards had.
- **Everything else** that reads the tokens (header, menus, dialogs, buttons, the Objectives screens, the landing and quiz pages) takes the new palette, loses the glow and the heavy light shadows, and changes no layout.

## Design

- `src/app/globals.css`: new token values in `:root` and `.dark`; `--glow: transparent` in both; the light `.card-surface` rule reduced to a flat surface (no gradient, no layered shadows) or removed together with its uses; one soft neutral `--island-shadow` per theme.
- `src/components/interactive-background.tsx`: the dark alpha constant lowered and the dark blobs neutral; the light wash and spot constants lowered. Its tests keep passing with the new constants.
- Rail and badge: `src/components/today-task-group.tsx` and `src/components/week-goal-progress-card.tsx` lose the 3 px strip; the done badge takes the soft classes.
- Panels: the lists that render the task groups, the week progress cards and the small steps get a wrapper that draws the panel (border, radius, `overflow-hidden`, card background) while each child card drops its own border, radius, background and shadow, and a hairline (`[&>*+*]:border-t`) separates rows. Builder's call: whether the wrapper lives in `fluid-day-week.tsx` or in a small `PanelList` helper, and how the week column's two lists group.
- `src/components/lifetime-progress-banner.tsx`: plain, no frame or tint.
- `src/components/small-steps-section.tsx` (from #81): one panel with two rows.
- The tests that assert the old look move with it: `globals.cards.test.ts` (the gradient and layered shadow rule), `theme-contrast.test.ts` (new values), the components whose tests check the glow or strip classes.

### Untouched

Routes, data, server actions, the tour, search, the structure of the landing page, the Objectives list as a list of cards (it keeps separate cards, only flatter).

## Accessibility

- Every foreground/background pair of both palettes stays at WCAG AA (4.5:1), checked by `theme-contrast.test.ts`. The pairs to watch: the soft green and the calm blue on `--card`, muted text on `--card` and on `--background`, and the done badge text on its tint.
- The done state keeps its text ("✓ feito") so it is not told by colour alone.
- The focus ring uses the new primary; reduced motion is unchanged.

## Edge cases

- A user who chose "Nenhum" or the dot grid sees no change from the background work.
- A single group in a column is a panel with one row (no divider).
- Empty weeks and the guest banner: no panel is drawn around things that are not task or week cards.
- Browser-reported dark mode before the theme class applies: tokens are on `.dark`, so there is no extra flash beyond today's.

## Testing

- `theme-contrast.test.ts` for both palettes.
- A CSS test that `:root` and `.dark` set `--glow` to transparent and the new `--primary`, that the light card surface has no gradient and no layered shadows, and that the island shadow is defined per theme.
- Component tests: no rail element, the done badge soft classes, the panel wrapper classes and the cards inside without their own border.
- `interactive-background.test.tsx` for the lowered constants.
- `npm run test:tz`; manual check of Today, Objectives, an objective page and a week page, in both themes at 1280 and 1600 px, with a screenshot for the user.

## Out of scope

Turning the Objectives list into panels, a new default background, new animations, the landing page layout, renaming theme tokens.
