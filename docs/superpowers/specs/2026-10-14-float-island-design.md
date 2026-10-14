# Float island: floating navigation that hides on scroll

Issue #69. Visual change only: no routes, data, auth or server logic change.

## Goal

The header on desktop and the bottom bar on phones become "islands": rounded bars that float with a margin from the screen edges, in glass, with the same layered shadows as the light-theme cards. They hide while the reader scrolls down and come back when they scroll up, so the content gets the whole screen. Approved by the user: option B of the scroll behaviour (hide on scroll down, return on scroll up) and the desktop-top / phone-bottom split.

## What changes for the user

- **md and up:** `AppHeader` is a floating pill at the top, centred, with a margin from the top and the sides (max width of the page content). Same content as today: Metas, Hoje, Objetivos, search, help, day summary, user menu. The guest notice leaves the bar and becomes a slim in-flow strip under it.
- **Below md:** the top bar stays the simple sticky bar it is today (logo, summary, search, menu). `BottomNav` becomes a floating pill with a margin from the bottom and the sides.
- **On scroll (both islands):** after scrolling down past 80 px the island slides out (up for the top one, down for the bottom one) and fades; scrolling up by a small amount, or being back at the top, brings it back.
- **Never hidden while in use:** while focus is inside the island, or one of its menus or dialogs is open (user menu, search), it stays. While hidden it is `inert`, so Tab never lands on an invisible bar.
- **Reduced motion:** it hides and shows with no slide or fade.

## Design

### Units

- `src/lib/scroll-hide.ts` (pure): `nextHidden({ hidden, y, lastY, pinned })` returns the new hidden state. Rules: never hidden when `pinned` or `y <= 80`; hide when moving down by more than 6 px since the last decision; show when moving up by more than 6 px. No DOM, easy to test.
- `src/components/use-scroll-hide.ts` (client hook): `useScrollHide(ref)` listens to `scroll` (passive, rAF-scheduled with a `scheduled` flag, as in `LandingFlow`), computes `pinned` from the island (`:focus-within`, or a descendant with `aria-expanded="true"`), and returns `hidden`. Cleans up listeners and the frame.
- `src/components/floating-bar.tsx` (client): `FloatingBar({ edge: 'top' | 'bottom', className, children, ...props })`. Renders the island container with `data-hidden`, `inert` when hidden, and the transform and opacity classes for its edge. Both bars use it, so the behaviour lives in one place.
- `src/app/globals.css`: a `.island` class: translucent card colour with `backdrop-blur`, a fine border, rounded corners and the shadows. Light uses the card shadows; dark uses a ring and a soft dark shadow, and keeps the neon only on the active link. Hide and show transitions sit under `motion-safe`.

### Changed

- `app-header.tsx` (server): the header wraps its content in `FloatingBar edge="top"` from md up and stays a sticky bar below md; an in-flow spacer of the island's height (md and up) keeps the page from sliding under it; `GuestBanner` moves out of the header, in flow below the spacer on desktop and below the sticky bar on phones. The header is still safe against a failing summary.
- `guest-banner.tsx`: a rounded slim strip instead of a full-width bar attached to the header.
- `bottom-nav.tsx`: uses `FloatingBar edge="bottom"`, floating with margin and `safe-area-inset-bottom`; the bottom padding of `#conteudo` in `layout.tsx` grows to match.

### Untouched

Routes, `NAV_LINKS`, tour, search, user menu, day summary and the landing's own header content (the landing already renders `AppHeader`, so it gets the island too, with only the logo and the user menu).

## Edge cases

- No scroll (short page): never hidden.
- Fast flick down then up: hysteresis of 6 px avoids flicker.
- Anchor jump (skip link, `#conteudo`): the island may hide; the skip link stays reachable because it is outside the island.
- Window resize across md: the top island and the bottom island are each CSS-hidden at the other size; the hook is cheap and idempotent.
- Safe areas on iOS: the bottom island adds `env(safe-area-inset-bottom)` to its margin.

## Testing

- `scroll-hide.test.ts`: not hidden at the top; hides after moving down past 80 px; shows when moving up; ignores moves under 6 px; never hides while pinned.
- `floating-bar.test.tsx`: hides on scroll down, returns on scroll up, stays with focus inside and with a menu open (`aria-expanded`), is `inert` while hidden, cleans up its listeners.
- `app-header.test.tsx` and `bottom-nav.test.tsx`: still render the same links and labels; the header uses the top island from md up; the guest notice is outside the bar.
- CSS test: the `.island` rule exists with blur and shadows, and the hide transition is guarded by `motion-safe`.
- Manual: desktop and 375 px, light and dark, with the user menu and search open.

## Out of scope

Changing what the island contains, new routes, a different mobile top bar, and any server or data work.
