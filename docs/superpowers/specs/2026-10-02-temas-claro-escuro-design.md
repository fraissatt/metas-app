# Light and Dark Themes Design

## Context

The app ships one theme. `src/app/globals.css` defines the same dark palette twice (`:root` and `.dark`), and `src/app/layout.tsx` hardcodes `className="dark"` on `<html>`. Every surface sits within a few shades of `#121214`–`#1a1a1d`, so the dark theme reads as a single flat tone; the only identity is the `#39ff14` neon green.

The user asked for two things, settled during brainstorming on 2026-10-02:

1. A light theme: light gray base with **neon blue** in place of neon green.
2. More identity in both themes, not just a second palette.

Header and navigation are a separate, later design. This one only places a theme toggle where it can live until the header exists.

## Decisions already made

| Question | Decision |
|---|---|
| How is the theme chosen? | **Toggle only.** The app opens dark until the user switches. The OS preference is ignored. |
| Visual direction | **"Brilho" (B) plus the support color from C.** Layered surfaces, a restrained neon glow and a second accent color per theme. |
| Where the choice is stored | **A cookie**, read by the server so the first paint is already correct. No new dependency. |

## Goals

### Tokens, not per-component colors

Components already consume semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`, `bg-accent`, `border-border`, `var(--chart-1)`…). The theme is therefore a change to `globals.css`, plus three new tokens, plus a handful of component edits where the new tokens are used. No component gets theme-specific branches.

- `:root` becomes the **light** palette.
- `.dark` stays the **dark** palette, so every existing `dark:` utility (shadcn's `Input`, `Checkbox`, `Button`) keeps working unchanged through `@custom-variant dark (&:is(.dark *))`.

New tokens, registered in `@theme inline` like the existing ones:

| Token | Purpose |
|---|---|
| `--support` / `--support-foreground` | The second accent: a solid color, and a darker shade that is safe for text on the page background. |
| `--support-muted` | A low-opacity tint for badge backgrounds. |
| `--glow` | The neon color at partial opacity, used for halos (`box-shadow`) and the page-top gradient. |

### Palette

Text colors meet WCAG AA (4.5:1) against the surface they sit on; this is checked in tests (see Testing).

| Token | Dark | Light |
|---|---|---|
| `--sidebar` (lowest layer) | `#0a0c10` | `#ffffff` |
| `--background` | `#0d0f13` | `#eceef2` |
| `--card`, `--popover` | `#161a21` | `#ffffff` |
| `--secondary`, `--muted` (raised) | `#1f242e` | `#e2e5eb` |
| `--border`, `--input` | `#262b36` | `#d7dbe3` |
| `--foreground` | `#e6e8ee` | `#14171f` |
| `--muted-foreground` | `#9aa1ae` | `#5b6170` |
| `--primary`, `--ring` | `#39ff14` | `#1f6bff` |
| `--primary-foreground` | `#0a0a0a` | `#ffffff` |
| `--accent` (primary tint) | `#14261a` | `#dce7ff` |
| `--accent-foreground` | `#39ff14` | `#1450cc` |
| `--support` | `#a78bfa` | `#f05a3c` |
| `--support-foreground` | `#c4b5fd` | `#b4380a` |
| `--support-muted` | `#a78bfa26` | `#f05a3c1f` |
| `--glow` | `#39ff1440` | `#1f6bff33` |
| `--destructive` | unchanged | `#dc2626` |
| `--chart-1` (empty/neutral series) | `#2a303c` | `#cfd4dd` |

Sidebar tokens follow the same columns (`--sidebar-accent` = `--accent`, and so on). The dark values move the surfaces a step cooler than today's neutral grays and spread them further apart, which is what removes the "single tone" look.

### Where each color appears

**Neon (`--primary`)** — unchanged roles: primary buttons, checked boxes, the "✓ feito" and "✓ concluída" pills, the lifetime total, the active nav item, the left accent strip on goal cards.

**Glow (`--glow`)** — exactly three places, so it stays a signal rather than decoration:
1. A radial gradient at the top of the page body (`radial-gradient(130% 45% at 60% 0%, <tint> 0%, var(--background) 65%)`), where `<tint>` is `color-mix(in oklab, var(--primary) 18%, var(--background))`.
2. Fulfilled goal cards (`WeekGoalProgressCard` when `fulfilled`) and fully done groups on Hoje (`TodayTaskGroup` when `dayComplete`): `box-shadow: 0 0 18px var(--glow)` and a border in the primary color at partial opacity.
3. Completed progress: the filled part of `ProgressIndicator` at 100%, and the progress ring in `WeekGoalProgressCard` when fulfilled (a `drop-shadow` filter on the ring).

**Support (`--support`)** — anything recurring or week-scoped:
- The "repete toda semana" badge in `WeeklyGoalCard` (`bg-support-muted text-support-foreground`).
- The "Ficou para trás" card (`MissingGoalsCard`): its eyebrow label and a left accent strip.
- Progress fills: a `linear-gradient(90deg, var(--support), var(--primary))` on `ProgressIndicator` (the weekly goal cards on the objective page). The ring and day bars on Hoje stay solid primary, because a gradient on a 40px ring reads as noise.
- The second series in charts: the "remaining" bars in `WeeklyGoalDayChart` use `var(--support)` at reduced opacity instead of `var(--chart-1)`.

### Storage and application

- **Cookie** `theme`, values `dark` | `light`. Missing or invalid means `dark`. Options: `path: '/'`, `sameSite: 'lax'`, `maxAge` of one year. It is not `httpOnly`, so the toggle can read the current value on the client.
- **Read:** `src/lib/theme.ts` exports `type Theme`, `DEFAULT_THEME = 'dark'`, a pure `parseTheme(value: string | undefined): Theme` and `getTheme(): Promise<Theme>` (reads `cookies()`). `layout.tsx` awaits `getTheme()` and sets `className={theme === 'dark' ? 'dark' : undefined}` plus `data-theme={theme}` on `<html>`. Reading cookies makes the layout dynamic, which costs nothing here: the build already reports every route as dynamic (`ƒ`).
- **Viewport:** `generateViewport()` replaces the static `viewport` export and returns `themeColor` and `colorScheme` for the current theme (`#0d0f13`/`dark` or `#eceef2`/`light`).
- **Write:** a Server Action `setTheme(theme: Theme)` in `src/lib/actions/theme.ts` validates the value with `parseTheme` and sets the cookie. No `revalidatePath` is needed, because the client has already applied the change.

### The toggle

`src/components/theme-toggle.tsx` is a client component:

- It is a `<button>` with an `aria-label` that names the target ("Ativar tema claro" / "Ativar tema escuro") and `aria-pressed` reflecting the light state. The icon is a sun in dark mode and a moon in light mode (Lucide, decorative).
- On click it applies the new theme to `document.documentElement` immediately (toggling the `dark` class, `data-theme` and `style.colorScheme`), then calls `setTheme` in a transition. The page never waits on the network to change color.
- If the action throws, it reverts the DOM change. The global `error.tsx` is not involved, because this is a cosmetic failure.
- It gets its initial theme as a prop from the server (`Sidebar` receives it from `layout.tsx`), so there is no hydration mismatch.

**Placement until the header exists:** at the bottom of the desktop sidebar (pushed down with `mt-auto`, with a label shown on hover like the nav links), and as a third item in the mobile bottom bar. The header design will move it.

The theme switch itself is instant (no color cross-fade), which avoids animating every surface at once and needs no reduced-motion handling.

## Non-goals

- Following the OS preference (explicitly rejected).
- Per-user server-side persistence. The app has no accounts.
- Header and navigation changes beyond placing the toggle.
- Restyling layouts, spacing or typography.

## Testing

- `src/lib/theme.test.ts`: `parseTheme` maps `undefined`, garbage and `'dark'` to `'dark'`, and `'light'` to `'light'`.
- `src/components/theme-toggle.test.tsx`: renders the right label and icon for each initial theme; clicking flips the `dark` class and `data-theme` on `document.documentElement` and calls the action with the new value; a rejected action restores the previous theme.
- A contrast test (`src/lib/theme-contrast.test.ts`) parses both palettes out of `globals.css` and asserts ≥ 4.5:1 for `foreground`/`background`, `foreground`/`card`, `muted-foreground`/`background`, `muted-foreground`/`card`, `accent-foreground`/`accent`, `support-foreground`/`background`, `support-foreground`/`card` and `primary-foreground`/`primary`. This keeps future palette tweaks honest.
- Existing component tests keep passing. They do not assert colors.
- Manual check in the browser for both themes: Hoje, Objetivos, an objective detail page with charts, a weekly goal page, a form and the delete dialog.

## Files

New: `src/lib/theme.ts`, `src/lib/actions/theme.ts`, `src/components/theme-toggle.tsx`, plus the three tests above.

Changed: `src/app/globals.css` (palettes, new tokens, body gradient), `src/app/layout.tsx` (theme class, `generateViewport`, passes the theme to `Sidebar`), `src/components/sidebar.tsx` (toggle slot), `src/components/ui/progress.tsx` (gradient fill), `src/components/week-goal-progress-card.tsx`, `src/components/today-task-group.tsx`, `src/components/weekly-goal-card.tsx`, `src/components/missing-goals-card.tsx`, `src/components/weekly-goal-day-chart.tsx`.
