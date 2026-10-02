# Header and Navigation Design

## Context

Navigation today is a 56px icon rail (`src/components/sidebar.tsx`) with two destinations, Hoje and Objetivos, plus the theme toggle the themes work parked there. On mobile, the same component becomes a bottom bar. Labels only show while the rail is hovered, so the app does not suggest what it can do. Internal pages (objective, weekly goal, edit forms) show neither where the user is nor a way back, apart from the browser's back button. There is no search, and the only place that shows how today is going is the Hoje page itself.

The user asked for a header and better navigation. Brainstorming on 2026-10-02 settled the scope:

| Question | Decision |
|---|---|
| What the header must offer | **Day summary always visible**, **breadcrumbs to know where I am and go back**, **search** for objectives and weekly goals. |
| Layout | **Option B: navigation moves to the top.** The sidebar rail is removed. The header carries the brand, labeled tabs, search, the day summary and the theme toggle. Breadcrumbs sit on a line below the header, on internal pages only. |
| Search interaction | **Quick search window.** A dialog opened from the header or with Ctrl+K / ⌘K, with live results grouped by type and keyboard navigation. |
| Day summary format | "3 de 5 hoje · semana de 28/09" with a progress ring. Clicking it goes to Hoje. |

## Goals

### App shell

`src/app/layout.tsx` renders, in order: the skip link (unchanged), `AppHeader`, the content wrapper `#conteudo` and `BottomNav`. The `Sidebar` component and its test are deleted. The content wrapper drops `md:pl-14` and keeps the bottom padding for the mobile bar only (`pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] md:pb-0`).

### Header (`src/components/app-header.tsx`)

This is a Server Component. It receives `theme` and `onThemeChange` from the layout and loads the day summary itself (see below). It is `sticky top-0 z-40`, full width, `h-14`, with `border-b border-border`, `bg-background/80` and `backdrop-blur`, so the page-top neon wash shows through.

**Desktop (`md` and up), left to right:**
1. **Brand:** "Metas", a link to `/`, bold, `text-accent-foreground`.
2. **Tabs (`HeaderNav`, client):** links "Hoje" (`/`) and "Objetivos" (`/objectives`) inside `<nav aria-label="Navegação principal">`. The active tab gets `aria-current="page"` and `bg-accent text-accent-foreground`. The others are `text-muted-foreground hover:text-foreground`. The active rule stays as it is now: `/` is active only on `/`; `/objectives` is active on it and on any path under `/objectives/`, but not on `/objectives-archive`.
3. A flexible spacer.
4. **Search trigger:** a button showing a magnifier icon, "Buscar…" and a `<kbd>` hint ("Ctrl K", or "⌘K" when `navigator.platform` reports a Mac, decided after mount to keep hydration stable). It opens the search dialog.
5. **Day summary** (`DaySummary`).
6. **Theme toggle:** the existing `ThemeToggle`, icon-only here. Its label stays visually hidden but present, and `aria-label` is unchanged.

**Mobile (below `md`):** the brand, a spacer, the compact day summary, a magnifier icon button (`aria-label="Buscar"`) that opens the same dialog, and the theme toggle. The tabs are hidden, because the bottom bar carries them.

### Bottom bar (`src/components/bottom-nav.tsx`, client)

This is the mobile-only (`md:hidden`) `<nav aria-label="Navegação principal">`, fixed at the bottom. It has the same safe-area padding and look as today's bar. It holds two items, Hoje (CalendarCheck icon) and Objetivos (Target icon), each with its **label always visible** under the icon. Each item has at least a 44px tap target. The theme toggle is no longer here.

Desktop and mobile each render exactly one "Navegação principal" landmark, because the other one is hidden with `display: none`.

The active-link rule lives in `src/lib/navigation.ts` as `isLinkActive(pathname: string, href: string): boolean`, shared by `HeaderNav` and `BottomNav`. Its current tests move with it.

### Day summary

**Data:** a Server Action `getTodaySummary(now = new Date()): Promise<TodaySummary>` in `src/lib/actions/summary.ts` returns `{ completed: number; total: number; weekStart: Date }`:
- It counts `DailyTask` rows whose `date` falls within the same `startOfDay`/`endOfDay` bounds `listDailyTasksByDate` uses.
- It counts how many of them are `completed`.
- It returns `getWeekBounds(now).weekStart`.

It uses two `count` queries. It does not load the tasks.

**`DaySummary` component:** a Server Component that takes the summary as props. The whole thing is a link to `/`.
- **When `total > 0`:**
  - **Ring:** a 20px SVG ring, with the track in `var(--muted)` and progress in `var(--primary)`. When `completed === total`, it gets the existing glow treatment (`drop-shadow-[0_0_4px_var(--primary)]`).
  - **Desktop text:** "3 de 5 hoje", then a muted " · semana de 28/09" built with `formatDayMonth`.
  - **Mobile text:** "3/5".
  - **Accessible name:** `aria-label="3 de 5 tarefas de hoje concluídas, semana de 28/09"`. The numbers use `tabular-nums`.
- **When `total === 0`:**
  - **Visible text:** "Nenhuma tarefa hoje" on desktop and "0" on mobile.
  - **No ring.**
  - **Accessible name:** "Nenhuma tarefa hoje, semana de 28/09".

**Freshness:** task changes (`toggleDailyTask`, create, update, delete) already call `revalidatePath`. A Server Action that revalidates refreshes the current route's whole tree, layouts included, so the header updates on the same screen. The Hoje page's optimistic toggle updates its own list first, and the header follows when the action completes. This has to be checked in the browser. If the layout does not refresh, the task actions must also call `revalidatePath('/', 'layout')`.

### Breadcrumbs (`src/components/breadcrumbs.tsx`)

`Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> })` renders `<nav aria-label="Trilha">` with an `<ol>`:
- Separators are a decorative `ChevronRight` (`aria-hidden`).
- Every item except the last is a `Link` (`text-muted-foreground hover:text-foreground`).
- The last item is plain text with `aria-current="page"` (`text-foreground font-medium`), and it gets no link even when it has an `href`.
- Each label is truncated with `max-w-[16rem] truncate` and has `title={label}`, so the full name stays available.
- The list may wrap on small screens. It never scrolls horizontally.

It is rendered **by each internal page**, as the first child of `<main>`, with `mb-4`. A layout cannot see the page's data (the objective and goal titles), and the pages already load it.

| Route | Items |
|---|---|
| `/objectives/new` | Objetivos › Novo objetivo |
| `/objectives/[id]` | Objetivos › {objective} |
| `/objectives/[id]/edit` | Objetivos › {objective} › Editar |
| `/objectives/[id]/weeks/[weekId]` | Objetivos › {objective} › {weekly goal} |
| `/objectives/[id]/weeks/[weekId]/edit` | Objetivos › {objective} › {weekly goal} › Editar |
| `/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit` | Objetivos › {objective} › {weekly goal} › {task} › Editar |

`/` and `/objectives` show no breadcrumbs, because the header tab already says where the user is. Pages that only have a weekly goal fetch its objective with `getObjective(id)` from the route param. If that returns null, the page calls `notFound()`, as the existing lookups do.

### Search

**Data:** a Server Action `search(query: string): Promise<SearchResults>` in `src/lib/actions/search.ts`:
- **Short queries:** it trims the query. Fewer than 2 characters returns `{ objectives: [], weeklyGoals: [] }` without querying.
- **Objectives:** up to **5**, matching `title` with `contains` and `mode: 'insensitive'`. Active ones come first, then completed, each ordered by `title`. The shape is `{ id, title, completed: boolean }`.
- **Weekly goals:** up to **5**, matching `title` the same way, ordered by `weekStart` descending, so the most recent come first. The shape is `{ id, title, objectiveId, objectiveTitle, weekStart }`.
- Matching ignores case but not accents. Postgres `ILIKE` is accent-sensitive, and adding `unaccent` is out of scope.
- The query is passed as a Prisma value, never interpolated, so it is injection-safe. The length is capped at 100 characters.

**`SearchDialog` component (client)**, built on `src/components/ui/dialog.tsx`:
- **Props:** `onSearch: (query: string) => Promise<SearchResults>`, the Server Action passed down from `AppHeader`, the same pattern as `onThemeChange`.
- **Triggers:** it owns the trigger buttons, the desktop "Buscar…" and the mobile magnifier, and a global `keydown` listener. Ctrl+K and ⌘K toggle the dialog and `preventDefault` the browser's own shortcut. The listener is removed on unmount.
- **Layout:** the dialog content is wider than the default (`sm:max-w-lg`). It has a visually hidden `DialogTitle` ("Buscar"), an input that is focused on open, and a results area.
- **Input:** `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the listbox, `aria-activedescendant` pointing at the highlighted option, `autoComplete="off"`, and placeholder "Buscar objetivos e metas…".
- **Results:** a `role="listbox"` with two groups, "Objetivos" and "Metas da semana". Each group has a heading, and a group with no hits is omitted.
  - **Objective option:** the title, plus a muted "concluído" badge when `completed`.
  - **Weekly goal option:** the title, plus a muted line with "{objective} · semana de {dd/MM}".
- **Fetching:** it calls `onSearch` 150ms after the last keystroke. A response is applied only if it belongs to the latest query, so a slow earlier response can't overwrite a newer one.
- **Messages:**
  - With 0–1 characters typed, it shows the hint "Digite pelo menos 2 letras".
  - With no hits, it shows `Nada encontrado para “{query}”`.
  - An `aria-live="polite"` region announces "{n} resultados", or the no-hits message.
- **Keyboard:**
  - ↓ and ↑ move the highlight across both groups and wrap around.
  - Enter opens the highlighted result: `/objectives/{id}` for objectives, `/objectives/{objectiveId}/weeks/{id}` for weekly goals. It navigates with `router.push`, then closes the dialog and clears the query.
  - Esc closes, which the dialog already handles.
  - Clicking a result does the same as Enter.
- **Errors:** if `onSearch` rejects, it shows "Não foi possível buscar agora." and keeps the dialog usable.

## Non-goals

- Searching daily tasks, accent-insensitive matching, recent searches and shortcuts beyond Ctrl/⌘+K.
- Changing the theme toggle's behavior. Only its placement and label visibility change.
- Redesigning page content below the header.

## Testing

- `src/lib/navigation.test.ts`: the current active-link cases, moved from `sidebar.test.tsx`.
- `src/lib/actions/summary.test.ts` (real test DB, like the other action tests):
  - It counts only today's tasks.
  - It counts completed ones correctly.
  - It returns `{0, 0}` on an empty day.
  - `weekStart` is the Monday of `now`.
- `src/lib/actions/search.test.ts`:
  - Matching is case-insensitive.
  - It returns at most 5 per group.
  - Active objectives come before completed ones.
  - Goals come newest week first.
  - It includes the objective's title.
  - Queries under 2 characters return empty.
  - A query is trimmed and capped.
- `src/components/breadcrumbs.test.tsx`:
  - Links for every item except the last.
  - The last item has `aria-current="page"` and no link.
  - The full label is in `title`.
- `src/components/header-nav.test.tsx`: the right tab gets `aria-current` on `/`, `/objectives` and a nested objective route.
- `src/components/bottom-nav.test.tsx`: two links with visible labels, and the active state.
- `src/components/day-summary.test.tsx`:
  - "3 de 5 hoje" and the week label.
  - "Nenhuma tarefa hoje" when the total is 0.
  - The accessible name.
  - The link to `/`.
- `src/components/search-dialog.test.tsx` (fake timers for the debounce, mocked `next/navigation` router):
  - Ctrl+K opens and closes the dialog.
  - Typing calls `onSearch` once after the debounce.
  - Results render in both groups.
  - The hint shows under 2 characters.
  - The no-hits message shows.
  - ↓ then Enter pushes the right URL and closes.
  - A stale response is ignored.
  - A rejected search shows the error message.
- Manual browser check:
  - Desktop and 375px, in both themes.
  - The header summary updates after toggling a task on Hoje and on a weekly goal page.
  - Breadcrumbs on all six routes.
  - The search keyboard flow.

## Files

New: `src/lib/navigation.ts`, `src/lib/actions/summary.ts`, `src/lib/actions/search.ts`, `src/components/app-header.tsx`, `src/components/header-nav.tsx`, `src/components/bottom-nav.tsx`, `src/components/day-summary.tsx`, `src/components/breadcrumbs.tsx`, `src/components/search-dialog.tsx`, plus the tests listed above.

Changed: `src/app/layout.tsx`, and the six internal pages listed in the breadcrumbs table.

Deleted: `src/components/sidebar.tsx` and `src/components/sidebar.test.tsx`.
