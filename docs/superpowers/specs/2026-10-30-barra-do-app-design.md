# Header in the title bar of the installed app

Issue #120. Prototype approved by the user on 2026-10-30: https://claude.ai/artifact/BR1E4E99AjYB2SwoYtKThP

## Goal

On desktop Chrome and Edge the installed app shows a browser title bar that repeats the app's name ("Metas - Hoje · Metas"), with the floating header in a second strip right below it. The user asked to change the whole bar. With the window-controls overlay the header takes the title bar itself and the system keeps only its buttons.

## What the user sees

- **Installed app on desktop, Chrome or Edge:** one strip at the top. The header (Metas, Hoje, Objetivos, search, help, the day summary, the account menu) sits in the title bar, flat and flush with the top, over an opaque background of the page's colour (the same as `theme_color`, so it joins the system buttons' area), with a hairline at the bottom. The extension and menu icons and the minimise, maximise and close buttons stay on the right: they belong to the browser.
- **Dragging:** the empty space between the controls drags the window; links, buttons, the search and the account menu stay clickable. Double-click on the empty space maximises, as on any title bar.
- **No hiding:** the bar does not slide away on scroll in this mode (it is the window's title bar).
- **Narrow windows:** the same flat bar, with the phone-width arrangement of the header (summary, search, account), and the page below it.
- **Everywhere else** (a browser tab, the phone, the installed app on Android or iOS): nothing changes.

## Design

- `src/app/manifest.ts`: `display_override: ['window-controls-overlay']`, with `display: 'standalone'` as the fallback where it is not supported.
- `src/components/app-header.tsx`: hooks `data-app-bar` (the bar), `data-app-bar-inner` (its content) and `data-app-bar-spacer` (the gap that keeps the page below the bar). Scroll-hide gets a second query, `unless`: the bar hides on scroll when `(min-width: 768px)` matches and `(display-mode: window-controls-overlay)` does not. They are two queries on purpose: a browser that does not know the overlay feature treats a lone unknown query as not matching, which is right, while the same feature inside `not (...)` would make the whole query fail and the bar would never hide in Safari or Firefox. The hook also listens for `change` on both queries, so a hidden bar returns when the display mode flips, without waiting for a scroll.
- `src/app/globals.css`: one unlayered `@media (display-mode: window-controls-overlay)` block (unlayered so it beats the utilities of the floating island). The bar is `position: fixed` at the top with `height: env(titlebar-area-height)`, and its horizontal padding keeps the content inside `titlebar-area-x`/`titlebar-area-width`, so the system buttons never cover it. `app-region: drag` on the bar and `no-drag` on the interactive elements inside it. The spacer is the bar's height plus 0.5rem, at every width.
- No change to the data or to the other screens.

## Calls I made

- The bar is opaque `var(--background)`, not glass: it must match the system area on its right, which Chrome paints with `theme_color`.
- The 2.5rem fallback height is only used by browsers that do not report `titlebar-area-height`; inside the overlay the system value wins.
- The title text is not drawn at all in this mode, so the page title no longer needs a workaround.

## Limits

- The account menu, search and day summary were built for a 56px bar and the system's title bar is about 40px; they fit in the emulation, but the real height is the system's.
- While the search dialog is open, the strip over the bar still drags the window (drag regions ignore stacking), so a click there does not close the dialog.

- It cannot be installed or driven in the development environment: the layout was checked in the browser by applying the same rules without the media query and with a fake 150px control area on the right; the real overlay needs the installed app. Chrome and Edge may need the app uninstalled and installed again, or the "window controls overlay" toggle in the title bar, to pick up the new manifest.
- A native Windows title bar cannot be removed: the extension and menu icons on the right stay.
