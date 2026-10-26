# Daily reminder through the PWA

Issue #110.

## Goal

A soft evening nudge, sent only when there is still a day to make. It fits the app's "pequenos passos" idea and is what keeps a habit going. The user (2026-10-26) asked for item 6 of their list ("Lembrete suave pelo PWA, faltam tarefas hoje") and wants it shipped in the same deploy as the weekly review and the Open Graph image. They delegated the decisions, so the ones below are mine and are the ones to check.

## What the user sees

- **Turning it on:** the user menu gets a "Lembrete diário às 19h" checkbox item with a bell icon and the line "Só nos dias que ainda não estão feitos.". The browser asks for permission only after this click. Clicking it again turns the reminder off for this browser.
- **When it can't be turned on here,** the item is disabled and says why:
  - an iPhone or iPad browser tab: "No iPhone, instale o app na tela de início para receber." (Apple only delivers web push to installed apps);
  - notifications denied: "Notificações bloqueadas nas configurações do navegador.".
  Browsers without push, and deployments without keys, show no item at all.
- **The notification:** once a day at 19:00 in Brasília, title "Metas", body "Mais 1 tarefa e hoje vira seu 46º dia feito." (the count of tasks missing to reach the 60% done-day threshold, and the ordinal of the done day it would be). Tapping it opens or focuses the app on Hoje. A newer reminder replaces an older one (same tag).
- **Silence** when today has no tasks, or today already counts as a done day. No streak guilt, no "you missed".

## Why these choices

- **19:00, fixed:** Vercel's free plan runs a cron at most once a day, and only within the hour, so a per-person time is not possible without a paid plan or an external scheduler. 19:00 leaves the evening to act. Vercel's Hobby crons may fire any time between 19:00 and 19:59.
- **Ordinal of the done day instead of the compound factor:** one day moves the factor by 1%, which rounds away at one decimal ("1,4× → 1,4×"); "seu 46º dia feito" is a visible, true number.
- **Per browser, not per account:** a push subscription belongs to one browser. Each device turns it on separately; signing in to another account on the same device moves the row to that account.

## Design

- `PushSubscription` table (`endpoint` unique, `p256dh`, `auth`, `userId` → `user` with cascade). Migration `20261026150000_push_subscription` only creates it. Guests who sign up keep it (`moveGuestDataOnSignUp`).
- `public/sw.js`: only `push` (show the notification) and `notificationclick` (focus or open). No caching or offline mode. Served with `no-cache` headers (`next.config.ts`).
- `src/components/use-daily-reminder.ts`: registers the worker, reads the current state, subscribes with the VAPID public key and saves through `saveReminderSubscription`, or unsubscribes and calls `removeReminderSubscription` (`src/lib/actions/reminders.ts`, which validate the payload and only touch the user's own rows).
- `src/lib/reminder.ts`: the pure message logic. `src/lib/push.ts`: loads subscriptions and the users' tasks up to today, builds each message, sends with `web-push`, deletes subscriptions the push service reports as gone (404/410).
- `src/app/api/cron/lembrete/route.ts`: GET, requires `Authorization: Bearer $CRON_SECRET` (Vercel sends it), does nothing without VAPID keys. Scheduled in `vercel.json` at `0 22 * * *` (22:00 UTC = 19:00 in Brasília, no DST since 2019). Excluded from the session proxy.
- Environment: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:`), `CRON_SECRET`. Documented in `.env.example`. Without them, the feature is invisible and the cron is a no-op.

## Edge cases

- Several devices for one person: each gets the reminder.
- Expired or revoked subscriptions are removed on the next run.
- The cron route called by anyone else: 401.
- A guest whose data expires: the cascade removes the subscription with the user.
