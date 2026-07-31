# Sidebar + Visual Identity Redesign (Phase 1)

## Context

The app currently uses a horizontal top navbar (`nav-bar.tsx`) with three links (Hoje / Semana / Objetivos) and the default shadcn light theme. This is phase 1 of a larger frontend restructuring: introducing a vertical left sidebar and a dark gray + neon green visual identity across the whole app. A later phase (separate spec) will address merging the "Hoje" and "Semana" pages into a single fluid macro/micro view — out of scope here.

## Goals

- Replace the horizontal top navbar with a vertical sidebar, collapsed to icons by default and expanding to icons+labels on hover (desktop), overlaying content rather than reflowing it.
- On small screens (<768px), the same navigation renders as a fixed icon-only bottom bar instead (hover doesn't exist on touch).
- Replace the light theme with a single dark theme (dark gray background, neon green primary accent) applied globally via the existing shadcn CSS variables, so all existing components (Button, Card, Progress, Dialog, etc.) inherit it automatically.
- Fix the progress chart's hardcoded colors, which would be invisible against the new dark background.

## Non-goals

- No merged Hoje/Semana fluid view (phase 2, separate spec).
- No light/dark theme toggle — dark is the only theme.
- No changes to page-level data fetching, business logic, or routes.

## Visual identity

Single dark theme, replacing both the `:root` and `.dark` blocks in `globals.css` with one set of values (the `.dark` class selector is removed — there is no other theme to switch away from):

| Token | Value | Notes |
|---|---|---|
| `background` | `#121214` | |
| `foreground` | `#e4e4e7` | |
| `card` / `popover` | `#1a1a1d` | |
| `card-foreground` / `popover-foreground` | `#e4e4e7` | |
| `primary` | `#39FF14` | neon green |
| `primary-foreground` | `#0a0a0a` | dark text on green buttons |
| `secondary` / `muted` | `#232326` / `#1c1c1f` | |
| `secondary-foreground` / `muted-foreground` | `#e4e4e7` / `#a1a1aa` | |
| `accent` | `#1c2b18` | active nav item background |
| `accent-foreground` | `#39FF14` | active nav item icon/text |
| `border` / `input` | `#26262a` | |
| `ring` | `#39FF14` | focus ring |
| `destructive` | keep current dark-mode value (`oklch(0.704 0.191 22.216)`) | already calibrated for dark backgrounds |
| `chart-1..5` | grayscale-to-green ramp (e.g. `#3f3f46` → `#39FF14`) | used by the progress chart |

Primary buttons get a subtle glow (`box-shadow: 0 0 12px oklch(from var(--primary) l c h / 0.4)` or equivalent) per the approved mockup. Secondary/outline/ghost/destructive button variants are unaffected — they already derive from the variables above via `buttonVariants` in `button.tsx`.

Because every existing shadcn component consumes these variables (not hardcoded colors), no component files need direct edits for the theme itself — only `globals.css` changes.

**Exception:** `src/components/objective-progress-chart.tsx` hardcodes `fill="#2563eb"` on the `Bar`, and Recharts' `CartesianGrid`/`XAxis`/`YAxis` default to black-ish strokes, which would be unreadable on the new dark background. This file gets updated to use the theme's `--primary` for the bar fill and `--border` / `--muted-foreground` (via `stroke`) for the grid and axes.

## Sidebar component

New `src/components/sidebar.tsx`, replacing `nav-bar.tsx` (and its usage in `layout.tsx`). Client component (`usePathname` to highlight the active route).

**Desktop (≥768px):**
- `position: fixed; left:0; top:0; height:100vh`, collapsed width `56px` by default.
- Three nav items, each an icon from `lucide-react`: Hoje → `Sun`, Semana → `CalendarDays`, Objetivos → `Target`.
- On `:hover`, expands to `~208px` and reveals text labels next to the icons. This is an overlay (higher `z-index`, `position: fixed`) — it does not push page content, so hovering causes no layout reflow. Width transitions with `transition: width 180ms ease`.
- Active route: `background: var(--accent)`, icon/label color `var(--accent-foreground)`.
- Wordmark ("Metas") at the top of the rail, visible only when expanded.

**Mobile (<768px):**
- Same component renders as a fixed bottom bar (`position: fixed; bottom:0; left:0; width:100%`), icon-only, no hover/expand behavior (pure CSS media query, not JS — hover is simply unreachable on touch so the expanded state never triggers, but bottom-bar layout needs its own responsive styles).

**Layout integration:** `src/app/layout.tsx` renders `<Sidebar />` plus a content wrapper with `padding-left: 56px` on desktop and `padding-bottom` (sidebar bar height) on mobile, via Tailwind responsive classes. Because the offset is handled once in the root layout, no individual page (`page.tsx`, `week/page.tsx`, `objectives/page.tsx`, `objectives/[id]/page.tsx`, `objectives/[id]/weeks/[weekId]/page.tsx`, `objectives/new/page.tsx`) needs to change.

## Testing

- Existing component tests (`daily-task-form.test.tsx`, `delete-button.test.tsx`, etc.) are unaffected — they test behavior, not theme colors.
- No new test coverage is warranted for CSS variable values or hover-driven CSS (not meaningfully unit-testable); manual verification in the browser is the check for this phase, per the frontend UI verification step in `AGENTS.md`/project conventions.

## Files touched

- `src/app/globals.css` — theme variables overhaul
- `src/components/sidebar.tsx` — new, replaces `nav-bar.tsx`
- `src/components/nav-bar.tsx` — removed
- `src/app/layout.tsx` — use `Sidebar`, add content offset wrapper
- `src/components/objective-progress-chart.tsx` — theme-aware colors
