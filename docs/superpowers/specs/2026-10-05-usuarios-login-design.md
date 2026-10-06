# User Accounts and Login Design

## Context

Today the app has no login. Every objective, weekly goal and task is shared by anyone who opens the deployed site (https://metas-app-flax.vercel.app), so the demo can be edited by anyone. Brainstorming on 2026-10-05 settled the following:

| Question | Decision |
|---|---|
| What a recruiter sees from the README link | **Login screen with "Entrar como visitante"** next to the normal login and sign-up. |
| Guest data | Each guest gets **their own temporary account**, pre-filled with fictitious data. |
| Guest lifetime | Deleted after **24 h without use**, with a cap of **200 active guests**. |
| How real accounts sign in | **E-mail and password.** Google is a possible later addition. Password recovery is out of scope. |
| Library | **Better Auth** (1.7.x; it declares support for Next 16, React 19 and Prisma 6). |
| Existing objectives/goals/tasks | **Deleted** by the migration that adds ownership. Funnel events are kept. |
| `/funil` | **Public for now**, behind a setting that can close it later without a code change. |
| Guest → real account conversion | **Out of scope** (second stage). |

## Goals

### Data model

- **Better Auth tables:** `User`, `Session`, `Account` (holds the password hash for the credential provider) and `Verification`. Use the shapes Better Auth's Prisma schema generator produces for this version, not hand-written guesses.
- **User fields** added through Better Auth's config:
  - `isAnonymous` (from the anonymous plugin), which marks guests.
  - `lastSeenAt DateTime`, the last time a guest used the app. It is set at creation.
- **Ownership:** `Objective` gets `userId String` with a relation to `User` and `onDelete: Cascade`, plus `@@index([userId])`. `WeeklyGoal` and `DailyTask` already cascade from `Objective`, so they inherit the owner and get no new column.
- **One migration, three steps:**
  1. Create the auth tables.
  2. Delete every existing `DailyTask`, `WeeklyGoal` and `Objective`.
  3. Add the required `Objective.userId`.

  `FunnelEvent` is untouched. Applying this migration to the deployed database is irreversible, so that deploy waits for the user's explicit go-ahead.

### Auth setup

- **Server config** (`src/lib/auth.ts`):
  - Better Auth with the Prisma adapter (`postgresql`) and `emailAndPassword` enabled, with a minimum password length of 8.
  - Sign-up signs the user in right away.
  - Plugins: the anonymous plugin, for guests, and the `nextCookies` plugin, so Server Actions can set the session cookie.
  - Better Auth's built-in rate limiting, on in production.
- **Route handler:** `src/app/api/auth/[...all]/route.ts` exposes Better Auth's handler.
- **Client:** `src/lib/auth-client.ts` with `createAuthClient` and the anonymous client plugin, used only by the login, sign-up and guest forms.
- **Session helpers** (`src/lib/session.ts`, server only):
  - `getCurrentUser()` reads the session with `auth.api.getSession({ headers: await headers() })` and returns the user or `null`.
  - `requireUser()` returns the user or calls `redirect('/entrar')`.
- **Environment:**
  - `BETTER_AUTH_SECRET`;
  - `BETTER_AUTH_URL` (the site origin);
  - `FUNNEL_PUBLIC`: `/funil` is public when it is `"true"`. When it is anything else, `/funil` requires login.
  - All three are added to `.env.example`, and `.env.test` gets a test secret.

### Isolation

- **Every data function** in `src/lib/actions/*` and `src/lib/*` that reads or writes objectives, weekly goals or tasks gets the current user from `requireUser()` and scopes its query by owner:
  - **Objectives:** `where: { userId }`.
  - **Weekly goals:** `where: { objective: { userId } }`.
  - **Daily tasks:** `where: { weeklyGoal: { objective: { userId } } }`.
- **Functions that take an id** (get, update, delete, toggle, complete, reopen, create under a parent) look the record up with the owner filter.
  - A record that belongs to someone else behaves exactly like a missing one: `get*` returns `null` and the page shows "não encontrado".
  - Mutations do nothing to it and raise the same error as for a missing id.
- **Creation** sets `userId` from the session, never from input.
- **Covered by this rule:**
  - search (`Ctrl K`);
  - stats and summary;
  - progress series;
  - recurring materialization (`materializePendingWeek`, `repeatMissingGoals`, `countPendingRecurrences`, `getMissingGoalsPreview`);
  - the quiz's `createPlanFromQuiz`.
- **Funnel events** stay anonymous and global.

### Page protection

- **Proxy:** `src/proxy.ts` (Next 16's renamed middleware) does an optimistic check. A request without Better Auth's session cookie, to any route other than the public ones, is redirected to `/entrar`. Excluded from the check:
  - static assets;
  - `/api/auth`;
  - the manifest and icons.
- **Public routes:** `/entrar` and `/cadastro`, plus `/funil` while `FUNNEL_PUBLIC === "true"`.
- **Real authorization** happens in `requireUser()` on the server, because the proxy only sees the cookie, not whether the session is valid.
- **Logged-in users** who open `/entrar` or `/cadastro` are redirected to `/`.

### Screens

- **`/entrar`:**
  - **Form:** e-mail and password fields, an "Entrar" button and a "Criar conta" link to `/cadastro`.
  - **Guest:** below it, a prominent "Entrar como visitante" button with the line "Conta de demonstração com dados prontos".
  - **Expired guest:** when the URL has `?expirado=1`, a notice says "Sua sessão de visitante expirou".
- **`/cadastro`:** name, e-mail and password, with a minimum of 8 and a show/hide toggle. Success lands on `/`. A new user has no objectives, so `/` already redirects to `/quiz`.
- **Both pages:**
  - They use the existing tokens, `Input`, `Button` and the theme/background.
  - Their header has no breadcrumbs, search or day summary, because there is no user; it keeps the logo plus the theme and background controls.
- **Errors:**
  - **Wrong credentials:** "E-mail ou senha incorretos". The message does not say which field is wrong.
  - **E-mail taken:** "Esse e-mail já tem conta", with a link to `/entrar`.
  - **Rate limited:** "Muitas tentativas. Tente de novo em alguns minutos."
  - **Network or server failure:** a generic retry message.
  - Errors are announced in an `aria-live` region.
- **User menu in `AppHeader`:**
  - It sits next to the background and theme buttons, on desktop and mobile.
  - It shows the user's name, or "Visitante" for guests, and a "Sair" item that signs out and goes to `/entrar`.
- **Guest banner:**
  - Shown at the top of every app page for guests.
  - It reads: "Você está como visitante. Os dados somem após 24 h sem uso."
  - Its "Criar conta" button signs the guest out and opens `/cadastro`; the guest's data is left for cleanup.

### Guests

- **Creation:** a Server Action (`src/lib/actions/guest.ts`) runs these steps:
  1. Run cleanup (below).
  2. Create the anonymous user through Better Auth.
  3. Seed their demo data.
  4. Redirect to `/`.
- **Demo data:** generated by a pure function (`src/lib/guest/demo-data.ts`) relative to "now", so the demo never looks stale. It produces:
  - **3 objectives:** one active mid-way, one active near its target date, and one completed with `completedAt` set.
  - **8 weeks of history:** weekly goals with tasks and varied completion rates, so the dashboard averages, weekly bars and streak all have content.
  - **The current week:** recurring goals and their tasks, some already done today.

  The data is written in one transaction, owned by the guest.
- **Last seen:** for guests, `getCurrentUser()` bumps `lastSeenAt` when it is older than 1 hour, with a single update and no awaiting in the render path beyond that update.
- **Cleanup:** a single function (`src/lib/guest/cleanup.ts`) deletes, as anonymous users:
  - those whose `lastSeenAt` is older than 24 h;
  - then the oldest beyond the newest 199. That leaves room for the guest being created, so at most 200 are active.

  Their objectives, goals, tasks, sessions and accounts cascade. A cleanup failure is logged and does not block guest creation.
- **Expired session:** when a guest whose account was deleted comes back, the session lookup fails. The cookie is still there, so the proxy lets the request through; then `requireUser()` redirects to `/entrar?expirado=1` if the request carried a session cookie, and to `/entrar` otherwise.

## Non-goals

- Password recovery, e-mail verification and changing the password or e-mail.
- Google or other social logins.
- Converting a guest into a real account.
- Admin pages or roles. Closing `/funil` is the `FUNNEL_PUBLIC` setting.
- A scheduled cleanup job.

## Testing

All tests run against the real test Postgres, as today.

- **Test setup:**
  - `src/test/setup.ts` also truncates the auth tables.
  - A helper creates a user and mocks the session for the test, by mocking `@/lib/session`'s `getCurrentUser`/`requireUser`.
  - Existing data tests run as that user.
- **Isolation:** for each data module, a second user's objectives, goals and tasks are invisible to the first user. Covered: lists, get by id, search, stats, summary, progress and recurrences. Updating, deleting or toggling another user's record fails like a missing id and leaves it unchanged.
- **Ownership on create:** created objectives (including from the quiz) belong to the session user.
- **Demo data generator:** 3 objectives, 8 past weeks plus the current one, one completed objective with `completedAt`, and dates relative to the given "now".
- **Cleanup:** guests idle for more than 24 h are deleted with their data, active guests are kept, real users are never deleted, and the 200 cap removes the oldest.
- **Guest action:** creates an anonymous user with demo data and runs cleanup first. A cleanup failure still creates the guest.
- **Forms** (Testing Library, with the auth client mocked):
  - The login and sign-up error messages.
  - Password show/hide.
  - The 8-character minimum.
  - Guest button pending state.
- **Proxy:** redirects without a session cookie; lets public routes, `/api/auth` and assets through; `/funil` follows `FUNNEL_PUBLIC`.
- **Header:** the user menu shows the name or "Visitante" and signs out; the guest banner shows only for guests.
- **Manual check (dev server):**
  - Sign up, log out and log in.
  - Guest flow, with the banner and the demo charts filled.
  - Two browsers with two users see different data.
  - A protected URL while logged out redirects.
  - `/funil` stays public.
  - Mobile at 375px.

## Files

**New:**
- `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`
- `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`
- `src/app/entrar/page.tsx`, `src/app/cadastro/page.tsx` and their form components
- `src/components/user-menu.tsx`, `src/components/guest-banner.tsx`
- `src/lib/actions/guest.ts`, `src/lib/guest/demo-data.ts`, `src/lib/guest/cleanup.ts`
- The migration and the tests above

**Changed:**
- `prisma/schema.prisma`
- Every data module in `src/lib/actions/*`, plus the `src/lib/*` helpers they use, which become owner-scoped
- `src/app/layout.tsx`, `src/components/app-header.tsx`
- `src/app/funil/page.tsx`, for `FUNNEL_PUBLIC`
- `src/test/setup.ts`, `.env.example`, `package.json` (`better-auth`)
- `README.md`: login, guest mode and the new env vars, after the release

**Deploy:** the Vercel env vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FUNNEL_PUBLIC=true`), set by the user with step-by-step guidance. The migration deploy waits for the user's go-ahead because it deletes the current data.
