# Public Presentation Page Design

Status: design approved in chat (2026-10-12); this is the written spec. Next step: review it, then write the implementation plan. Tracked in issue #34.

## Goal

Visitors and recruiters who open the site without a session should see what Metas is and why it is built the way it is, instead of being sent straight to the sign-in form. The page is the portfolio's front door: it explains the product in six colourful cards and offers three ways in.

A second cycle (separate issue, PR and release) adds a guided tour for people who already use the app. It is out of scope here.

## Behaviour

- `/` becomes public. With no session it renders the presentation page; with a session it renders Hoje exactly as today.
- Nothing else changes for signed-out visitors: every other page still redirects to `/entrar`.
- A stale session cookie (expired or deleted session) used to bounce through `/entrar`; it now shows the presentation page, which is the better outcome.
- No new data, tables or server actions. The page is static content plus the existing guest sign-in action.

### Routing and the proxy

- `src/lib/public-routes.ts`: `isPublicPath` also accepts `/`. `src/proxy.ts` needs no other change (it already delegates to `isPublicPath`), but its matcher and tests are extended so `/` is covered both with and without the cookie.
- `src/app/page.tsx` reads the user with `getCurrentUser()` (`src/lib/session.ts`). `null` returns `<Landing />`; otherwise the existing Hoje code runs unchanged. The Hoje code is not moved.

## Page content (pt-BR)

Copy follows the project voice: sentence case, no terminal punctuation on labels, no claims the app cannot back up.

- **Title:** "Metas". **Subtitle:** "Do objetivo à tarefa do dia, sem se perder no meio do caminho."
- **Actions:** "Entrar como visitante" (the one highlighted action), "Criar conta" (link to `/cadastro`) and "Já tenho conta" (link to `/entrar`). A line below explains the guest: "Conta de demonstração com dados prontos. Os dados somem após 24 h sem uso."
- **Six cards**, each with an icon, a title and one line:

  | Card | Colour | Line |
  | --- | --- | --- |
  | Objetivos | green (the app's neon) | O destino, com prazo e progresso |
  | Metas semanais | blue | O que fazer em cada semana |
  | Tarefas diárias | amber | O passo de hoje, na tela Hoje |
  | Modo visitante | violet | Teste com dados prontos |
  | Quiz de plano | pink | Responda e receba um plano |
  | App instalável | cyan | PWA em tela cheia |

- **Footer:** link to the source on GitHub and "Todos os direitos reservados".

## Visual design

- Dark and light themes both work; the page uses the existing tokens (`--background`, `--card`, `--border`, `--foreground`) plus six accent colours defined once as page-local tokens with a light and a dark value each.
- Layout: a centred hero, then the cards in a three-column grid from `md` up, two columns from `sm`, one column on phones. The glass user menu and the header stay as they are.
- The header on this page is the existing one, which for signed-out visitors shows the "Aparência" menu.

### Hover and motion

- **Hover (only where a pointer can hover):** the card rises 4 px, its border and a soft glow take the card's colour, and its icon grows slightly. 150 to 200 ms transitions.
- **Entrance:** cards fade up in sequence.
- Both are disabled under `prefers-reduced-motion`; on touch screens the cards are plain, with no hover state.
- Pointer-following tilt was considered and dropped: it needs JavaScript for little gain.
- Cards are not links and not buttons, so they are not focusable; the actions are the three buttons above.

## Accessibility

- One `h1`; card titles are `h2` or `h3` inside a list so the structure reads as six items.
- Colour is decoration, never the only carrier of meaning: every card has an icon and a title.
- Text and icon contrast checked against the card background in both themes.
- Visible focus on all buttons and links; the actions are reachable by keyboard in reading order.

## Components

- `src/components/landing.tsx` (server component): hero, actions, grid, footer. No client JavaScript of its own.
- `src/components/landing-card.tsx`: one card, taking an icon, a title, a line and a colour key.
- The guest button reuses `GuestButton`; it gains a prop to render as a plain primary button instead of the bordered box used on the sign-in page.
- Styles live in `globals.css` as utilities for the card, the glow and the entrance, all behind `@media (hover: hover)` and `prefers-reduced-motion` guards.

## Error handling

- The guest button keeps its existing behaviour, including the throttle message.
- If reading the session fails, the root route behaves like the current one: the error boundary handles it. The landing page does not catch session errors.

## Testing

- `public-routes` and `proxy` tests: `/` passes without a cookie; other paths still redirect.
- A test for the root page: no user renders the presentation (title, three actions, six cards); a user renders Hoje.
- Component tests for `Landing` and `LandingCard`: copy, link targets, heading structure, and that the cards have no interactive role.
- The existing guest button tests still pass; a new case covers the plain variant.
- Checked in the browser in both themes and at phone width before the PR.

## Docs and release

- README: add the page to the features list and a screenshot in the "Capturas de tela" section.
- Ships as release v1.2.0 (a new feature), after a small PR that bumps the package version.

## Out of scope

- The in-app tour for signed-in users (second cycle).
- Per-card links, a pricing or "about me" section, analytics on the page and localisation.
