# metas-app

Objectives -> Weekly Goals -> Daily Tasks tracker, built with Next.js (App Router),
Prisma, and Postgres.

## Prerequisites

- [Node.js](https://nodejs.org/) 20.9 or later
- [Docker](https://www.docker.com/) (for running Postgres locally via Docker Compose)
- npm (this project is npm-only — do not use yarn, pnpm, or bun)

## Setup

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

   This starts a Postgres 16 container on `localhost:5433` (remapped from the default
   `5432` to avoid clashing with a Postgres instance you might already have running
   locally) and creates both the app database (`metas_app`) and the test database
   (`metas_app_test`).

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

   The default `DATABASE_URL` already matches the Docker Compose setup above, so no
   further editing is needed for local development.

3. Install dependencies:

   ```bash
   npm install
   ```

   This also runs `prisma generate` automatically via the `postinstall` script.

4. Apply database migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Running tests

Tests run against a real Postgres database (`metas_app_test`, from the Docker Compose
setup above) rather than a mocked Prisma client — there are no unit tests with mocked
data access in this project, only DB-integration tests.

1. Make sure Postgres is running (`docker compose up -d`) and `.env.test` exists (it's
   already present in this repo, pointing at `metas_app_test` on port 5433).

2. Apply migrations to the test database:

   ```bash
   npm run test:migrate
   ```

3. Run the test suite:

   ```bash
   npm run test
   ```

   Or in watch mode:

   ```bash
   npm run test:watch
   ```

## Other scripts

- `npm run build` — production build.
- `npm run start` — run the production build.
- `npm run lint` — lint the codebase.
- `npm run db:migrate` — apply pending migrations to the database pointed at by
  `DATABASE_URL` (non-interactive; use `npx prisma migrate dev` instead when actively
  developing new migrations).

## Tech stack

- [Next.js](https://nextjs.org) (App Router, Server Actions)
- [Prisma](https://www.prisma.io/) + Postgres
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (on
  [Base UI](https://base-ui.com/), not Radix)
- [Vitest](https://vitest.dev/) + Testing Library
