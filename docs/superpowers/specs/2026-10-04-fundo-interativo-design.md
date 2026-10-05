# Interactive Background Design

## Context

The page background today is flat `--background` plus a static radial neon wash at the top (`body` in `src/app/globals.css`). The user wants a background that reacts to the mouse while keeping each theme's identity (neon green + violet in dark, neon blue + coral in light). Brainstorming on 2026-10-04 (thread previews A/B/C) settled the following:

| Question | Decision |
|---|---|
| Which effect | **Aurora** (drifting color blobs pulled toward the cursor) is the default. The user can also choose **Grade de pontos** (a dot grid that lights up and pushes away near the cursor) or **Nenhum** (today's flat background). |
| Where | Every page, behind the header and the content. |
| How the choice is stored | A cookie, like the theme, so the server renders the right choice and nothing flashes. |
| Where to choose | A button in the header next to the theme toggle, opening a small menu with the three options. Mobile uses the same place. |

## Goals

### Storage

- **Module:** `src/lib/background.ts` holds the pure parts plus the server read.
  - `type BackgroundStyle = 'aurora' | 'pontos' | 'nenhum'`
  - `DEFAULT_BACKGROUND = 'aurora'`
  - `BACKGROUND_COOKIE = 'fundo'`
  - `BACKGROUND_LABELS: Record<BackgroundStyle, string>`, with the values `{ aurora: 'Aurora', pontos: 'Grade de pontos', nenhum: 'Nenhum' }`.
  - `parseBackground(value)` does an exact match. Anything else returns the default.
  - `getBackground()` reads `cookies()`.
- **Pure split:** client code needs the labels and the type. `parseBackground`, `BACKGROUND_LABELS` and the type therefore live in a second file, `src/lib/background-options.ts`, which has no `next/headers` import. `src/lib/background.ts` re-exports them and adds `getBackground`. This avoids the `import type`-only constraint that `@/lib/theme` has.
- **Write:** Server Action `setBackground(style)` in `src/lib/actions/background.ts` re-validates with `parseBackground`. The cookie options are the same as the theme's: `path: '/'`, `sameSite: 'lax'`, `maxAge` of one year, not `httpOnly`.

### Shell

- **Layout:** `layout.tsx` reads `getBackground()` and wraps the header, `#conteudo` and `BottomNav` in `BackgroundProvider` (client), passing `initial={background}` and `onChange={setBackground}`. The skip link stays first in `<body>`, outside the provider.
- **`BackgroundProvider`:**
  - **State:** it holds the current style in state and exposes `{ style, setStyle }` through React context, via `useBackground()`.
  - **Rendering:** it renders `<InteractiveBackground style={style} />` before its children.
  - **Changing the style:** `setStyle(next)` applies `next` immediately, then calls `onChange(next)`. If that rejects, it reverts to the last confirmed style.
  - **Saves:** they are serialized through a promise chain, the same pattern as `ThemeToggle`, so rapid changes land in click order.
- **Page wash:** the static top wash in `globals.css` stays. With `nenhum` the page looks exactly like today.

### `InteractiveBackground` (`src/components/interactive-background.tsx`, client)

- **Element:** renders nothing when `style === 'nenhum'`. Otherwise it renders a single `<canvas aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 h-full w-full">`.
- **Stacking:** the canvas sits above the body background and below all content. Content keeps its own opaque surfaces (cards, header `bg-background/80`), so legibility does not depend on the effect.
- **Colors:** read at runtime from CSS variables on `document.documentElement`: `--primary`, `--support` and `--chart-1` (the neutral dot color). They are parsed from `#rrggbb`. They are re-read when `<html>`'s `class` or `data-theme` changes (MutationObserver), so toggling the theme recolors without a reload.
- **Sizing:** the canvas covers the viewport, with the device pixel ratio capped at 2. It is resized on `resize`.
- **Pointer:** a `window` `pointermove` listener (passive) updates a target. The drawn position eases toward it (factor 0.12 per frame). `pointerleave` on `document` (or the pointer leaving the window) clears the target.
- **Effects** (constants live at the top of the file):
  - **Aurora:** 4 radial blobs at fixed base positions (`{x:.25,y:.35,primary}`, `{x:.75,y:.65,support}`, `{x:.55,y:.15,primary}`, `{x:.15,y:.85,support}`, as fractions of the viewport).
    - **Radius:** `max(width, height) * 0.35`.
    - **Opacity:** 0.18 in dark and 0.14 in light, fading to 0.
    - **Drift:** the blobs drift slowly with `sin/cos` of time (amplitude 8% and 10%).
    - **Cursor pull:** when a pointer target exists, each blob moves 20% of the way toward the cursor.
  - **Grade de pontos:** dots every 24px, radius 1.2px, in `--chart-1` at 0.6 opacity.
    - **Influence:** within 140px of the cursor a dot's strength is `f = 1 - d/140`.
    - **Near the cursor:** the dot takes `--primary` at `0.25 + 0.75f`, grows by `1.6f` px and moves `8f` px away from the cursor.
- **Loop:**
  - **Aurora** animates continuously while visible. It drifts even without the mouse; that is the effect.
  - **Grade de pontos** only animates while the eased position is still moving toward the target. Otherwise it draws once and stops the loop, restarting on `pointermove`.
  - **Pause:** when `document.hidden`, no frames are drawn. The loop resumes on `visibilitychange`.
- **Static mode:** under `prefers-reduced-motion: reduce`, or on devices with `(hover: none)` (touch), the component draws **one static frame**. Aurora blobs sit at their base positions, the dots are neutral, and nothing reacts to the pointer. The media queries are re-evaluated on change.
- **Cleanup:** every listener, observer and `requestAnimationFrame` is removed on unmount or when the style changes.

### `BackgroundPicker` (`src/components/background-picker.tsx`, client)

- **Placement:** in `AppHeader`, just before the `ThemeToggle`. On mobile it sits in the same order position as the toggle's group, before it.
- **Trigger:** an icon button (Lucide `Sparkles`, `size-5`) with `aria-label="Fundo: {label}"` (for example "Fundo: Aurora"). Its styling matches the theme toggle: `px-2 text-muted-foreground hover:text-foreground`, rounded, with a focus-visible ring.
- **Menu:** Base UI Menu with a radio group of three items (`Menu.RadioGroup` / `Menu.RadioItem`): "Aurora", "Grade de pontos", "Nenhum". The current option shows a check indicator. Choosing an item calls `setStyle` from `useBackground()` and closes the menu.
- **Popup styling:** the popup uses the popover tokens, as in `ObjectiveActionsMenu`.

## Non-goals

- Per-page background choices.
- Additional effects beyond the three options.
- Any new dependency, since everything is Canvas 2D.

## Testing

- **`src/lib/background-options.test.ts`:** `parseBackground` maps `undefined`, garbage and near misses (`'Aurora'`, `' pontos'`) to `'aurora'`, and accepts the three exact values.
- **`src/lib/actions/background.test.ts`:** cookie name, value and options, and re-validation of invalid input (mock `next/headers`, as `actions/theme.test.ts` does).
- **`src/components/background-provider.test.tsx`:**
  - `setStyle` applies immediately and calls `onChange`.
  - A rejected `onChange` reverts to the last confirmed style.
  - The canvas is absent for `nenhum` and present otherwise.
- **`src/components/background-picker.test.tsx`:**
  - The trigger label names the current option.
  - The menu lists the three options, with the current one checked.
  - Choosing one changes the style and the trigger label.
  - The menu closes on Escape.
- **`src/components/interactive-background.test.tsx`:**
  - Renders an `aria-hidden` canvas with `pointer-events-none` for aurora and pontos, and nothing for nenhum.
  - Under a mocked `matchMedia('(prefers-reduced-motion: reduce)')` it does not start a continuous `requestAnimationFrame` loop: it draws once.
  - Unmounting cancels the animation frame and removes the listeners.
  - jsdom has no canvas 2D context, so tests stub `HTMLCanvasElement.prototype.getContext` with a minimal fake.
- **Manual browser check (dev server):**
  - Aurora and Grade de pontos in both themes on Hoje, Objetivos and a form.
  - Switching options in the header applies instantly and persists after reload.
  - Nenhum looks like today.
  - Content stays legible.
  - No horizontal scroll at 375px.
  - The animation stops when the tab is hidden.

## Files

New: `src/lib/background-options.ts`, `src/lib/background.ts`, `src/lib/actions/background.ts`, `src/components/background-provider.tsx`, `src/components/interactive-background.tsx`, `src/components/background-picker.tsx`, plus the tests above.

Changed: `src/app/layout.tsx` (read the cookie, wrap in the provider) and `src/components/app-header.tsx` (render the picker).
