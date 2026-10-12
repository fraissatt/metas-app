# Guest Becomes an Account Design

Status: design approved in chat (2026-10-12); this is the written spec. Next step: review it, then write the implementation plan. Tracked in issue #46.

## Problem

A guest can try the app with demo data and whatever they add. When they decide to create an account, the app signs them out first (`leaveGuestToSignUp`) and warns that their guest data will be lost. The moment someone has just invested effort and wants to keep it is the moment the app throws it away.

## Goal

Creating an account from a guest session keeps everything the guest built. Signing in to an account that already exists does not touch that account's data: the guest data is discarded, and the screen says so.

## Behaviour

| Situation | Result |
| --- | --- |
| Guest signs up with a new e-mail | The guest's objectives (with their weekly goals and daily tasks) become the new account's. The guest account is gone. |
| Sign-up fails (e-mail taken, password too short) | Nothing changes: the guest keeps the session and every object. |
| Guest signs in to an existing account | The guest data is discarded (the guest account is deleted by Better Auth, as today). The existing account keeps only what it had. |
| Guest signs in with a wrong password | Nothing changes. |
| Guest chooses "Sair" | Unchanged: still asks for confirmation, because here the data really is lost. |

### Mechanics

- Better Auth's `anonymous` plugin already handles the link. In its `after` hook for the `/sign-in` and `/sign-up` routes, when the request had an anonymous session and produced a new session, it calls `onLinkAccount({ anonymousUser, newUser, ctx })` and then deletes the anonymous user (`node_modules/better-auth/dist/plugins/anonymous/index.mjs`).
- We pass an `onLinkAccount` that, **only** for `ctx.path === '/sign-up/email'` and a non-anonymous new user, moves the guest's data: `prisma.objective.updateMany({ where: { userId: anonymousUser.user.id }, data: { userId: newUser.user.id } })`. Weekly goals and daily tasks hang off the objectives, so they follow. For any other path it does nothing and the plugin's deletion discards the guest data.
- The move runs before the plugin deletes the guest, and the guest's rows are already gone from the guest by then, so the cascade delete removes nothing.
- No schema change. `FunnelEvent` is keyed by an anonymous session id, not by user, so it needs no move.

## Screens

- **Banner and menu:** "Criar conta" no longer signs out and no longer asks for confirmation. It goes straight to `/cadastro`. The banner copy becomes "Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los."
- **`/cadastro`:** accepts a guest (today `getCurrentUser()` bounces any session to `/`; it must only bounce non-guests). A guest sees the note "Seus dados de visitante vão para a nova conta." above the form.
- **`/entrar`:** same rule. A guest sees "Entrar numa conta existente descarta os dados de visitante."
- **After a successful sign-up** the existing code navigates to `/`, now with the carried data.
- **Removed:** the `leaveGuestToSignUp` Server Action and the `toSignUp` mode of `LeaveGuestDialog`, both unused afterwards. `LeaveGuestDialog` stays for "Sair".

## Components and files

- `src/lib/guest/link.ts` (new): `moveGuestDataOnSignUp({ anonymousUser, newUser, ctx })`, the pure decision plus the `updateMany`, used as the plugin's `onLinkAccount`.
- `src/lib/auth.ts`: passes it as `anonymous({ onLinkAccount: moveGuestDataOnSignUp, ... })`.
- `src/components/guest-banner.tsx`, `src/components/user-menu.tsx`: link to `/cadastro` instead of opening the dialog.
- `src/app/cadastro/page.tsx`, `src/app/entrar/page.tsx`: allow guests and show the notes.
- `src/lib/actions/auth.ts`: drop `leaveGuestToSignUp`. `src/components/leave-guest-dialog.tsx`: drop `toSignUp`.
- `src/components/app-header.tsx`: stops passing `onCreateAccount`; `UserMenu` loses that prop.

## Error handling

- If moving the data throws, the sign-up request fails with the server error the plugin already surfaces; the guest keeps their data because the guest is deleted only after the hook succeeds. The form shows its generic error.
- The note texts are static; nothing reads guest data on the auth pages.

## Testing

- `moveGuestDataOnSignUp` against the real test database: moves the objectives, weekly goals and tasks to the new user on `/sign-up/email`; moves nothing on `/sign-in/email`; moves nothing when the new user is anonymous; leaves other users' data alone; moves several objectives.
- An end-to-end test through `auth.handler`: sign in anonymously, create an objective for that user, sign up with the same cookie, then assert the objective belongs to the new user and the anonymous user no longer exists. A second case: sign in to an existing account from a guest cookie and assert the existing account's objectives are unchanged and the guest's are gone.
- Component tests: the banner and the menu item link to `/cadastro` and no longer render the confirmation dialog; `/cadastro` and `/entrar` render for a guest with their note, still redirect a real account, and show no note without a session.
- `leave-guest-dialog` tests lose the `toSignUp` case; the "Sair" confirmation tests stay.
- Checked in the browser: enter as guest, create something, sign up, and confirm it is still there.

## Docs and release

- README: the guest bullet says the data can be kept by creating an account.
- Ships as release v1.4.0 (a new capability), after a small PR that bumps the package version.

## Out of scope

- Merging guest data into an existing account.
- A "Sair" that offers to keep the data, e-mail verification, password reset and social sign-in.
