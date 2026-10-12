# Welcome Tour Design

Status: design approved in chat (2026-10-12); this is the written spec. Next step: review it, then write the implementation plan. Tracked in issue #41.

## Goal

Someone who has just signed in (or entered as a guest) should learn, in under a minute, what the parts of the app are for. The tour is a short stepped dialog that reuses the colours and icons of the presentation page, so the two read as one product.

It is the second cycle of the presentation work: the public page (v1.2.0) explains the app to people without a session; this explains it to people with one.

## Behaviour

- **Opens by itself on the first visit** of a person with a session, on any page except the quiz (`/quiz`), so it does not compete with onboarding. After the quiz creates the plan and lands on Hoje, it opens there. Guests see it too, since they land on Hoje.
- **Remembered by a cookie**, `tour=visto`, set when the dialog closes in any way (Concluir, Pular, Esc, click outside). It does not open by itself again in that browser. It is per browser, like the theme and background cookies: another device opens it once more.
- **"Ver tour"** is an item in the user menu, shown only with a session. It reopens the dialog on the first step whenever the person wants, and does not need the cookie.
- Signed-out visitors never see the tour or the menu item.
- No database, no migration, no new table.

## The dialog

Five steps, one per part of the app. Each step has a coloured icon in the same style as the presentation cards, a title and one or two sentences.

| # | Step | Colour | Message |
| --- | --- | --- | --- |
| 1 | Objetivos | green | Tudo começa com um objetivo: o destino, com prazo e progresso. |
| 2 | Metas semanais | blue | Cada objetivo se divide em metas por semana. As metas podem se repetir toda semana. |
| 3 | Tarefas diárias | amber | As tarefas de cada meta aparecem no Hoje, no dia em que você vai fazê-las. |
| 4 | Busca | violet | Aperte `Ctrl K` para achar objetivos e metas de qualquer semana. |
| 5 | Aparência | cyan | No menu da sua conta você troca o tema e o fundo, e pode rever este tour. |

- Controls: "Voltar" (hidden on the first step), "Próximo" (on the last step it reads "Começar" and closes), and "Pular" (closes). A progress indicator shows dots and "2 de 5".
- The message text lives in one data file, so wording changes do not touch the component.
- Steps change with a short fade, disabled under `prefers-reduced-motion`.
- Phone: the dialog takes the full width with side margins; desktop: a card about 24 rem wide. Both themes use the existing tokens, plus the six presentation colour variables (`--lp-*`) already defined in `globals.css`.

## Architecture

- `src/lib/tour.ts`: `TOUR_COOKIE = 'tour'`, `TOUR_SEEN_VALUE = 'visto'`, `parseTourSeen(value)` (true only for the exact value) and `getTourSeen()` reading the cookie, in the shape of `src/lib/background.ts`.
- `src/lib/actions/tour.ts`: Server Action `setTourSeen()` writing the cookie (path `/`, `sameSite: 'lax'`, one year, not httpOnly), in the shape of `setTheme` and `setBackground`.
- `src/components/tour-steps.ts`: the five steps as data (id, title, text, icon, colour).
- `src/components/tour-dialog.tsx`: the stepped dialog, built on the existing `Dialog` (Base UI), controlled by `open` and `onOpenChange`, with the step state inside.
- `src/components/tour-provider.tsx`: client provider that mounts the dialog and exposes `useTour(): { openTour: () => void }` (it throws outside the provider, like `useBackground`). Props: `initialSeen`, `canOpen` (there is a session) and `onSeen`. It opens automatically when `canOpen && !seen` and the path is not `/quiz`, using the initial state for the first render and an effect for later navigations (quiz to Hoje). Closing marks it seen locally and calls `onSeen`.
- `src/app/layout.tsx`: reads `getTourSeen()` and wraps the header and the page in `TourProvider`, inside `BackgroundProvider`.
- `src/components/user-menu.tsx`: for a signed-in user, a "Ver tour" item calls `openTour()`.

## Error handling

- If saving the cookie fails, the dialog still closes; the worst case is that it opens once more on the next visit.
- A cookie with any value other than `visto` counts as not seen.

## Accessibility

- A real dialog: focus moves in, stays inside while open, Esc closes, and focus returns to what had it (the menu item, or the page when it opened by itself).
- The title is the dialog's accessible name; the step text is its description; the "2 de 5" indicator is announced when it changes (`aria-live="polite"`).
- Colour is decoration: every step has an icon and a title. Contrast checked in both themes.
- Buttons are reachable by keyboard in reading order, with visible focus.

## Testing

- `tour.ts` and the action: the parse rule, and that the action writes the cookie with the expected options.
- `TourDialog`: it starts on step 1, "Próximo" and "Voltar" move between steps, "Voltar" is hidden on step 1, the last step offers "Começar", "Pular" and "Começar" close, and the indicator text follows the step.
- `TourProvider`: opens on the first visit with a session; does not open without a session, when already seen, or on `/quiz`; opens after navigating from `/quiz` to `/`; calls `onSeen` once when closed; `openTour()` reopens it on step 1 without calling `onSeen` again.
- `UserMenu`: "Ver tour" appears for a signed-in user, not for the signed-out menu, and calls `openTour`. Existing menu and header tests wrap their renders in the provider.
- Checked in the browser in both themes and at phone width before the PR.

## Docs and release

- README: a feature bullet and a screenshot of the dialog.
- Ships as release v1.3.0 (a new feature), after a small PR that bumps the package version.

## Out of scope

- A tour that points at elements on the screen (too tied to the layout).
- A first-steps checklist, per-account memory in the database, analytics on the tour, and translations.
