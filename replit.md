# Qodia

An Arabic RTL practice app that helps computer science students prepare for graduation-project defenses through short, interactive lessons.

## Run & Operate

- `pnpm --filter @workspace/qodia run dev` — frontend (normally started by the managed Qodia workflow)
- `pnpm --filter @workspace/api-server run dev` — Express API (normally started by its managed workflow)
- `pnpm run typecheck` — check all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate client hooks and server validators after OpenAPI changes
- `pnpm --filter @workspace/db run push` — apply schema changes to the development database
- Authentication requires a secret named `JWT_SECRET` or the already-provisioned `SESSION_SECRET`. Set secrets through Replit Secrets, never in committed files.
- `GEMINI_API_KEY` is reserved for a later AI lesson-generation feature; the MVP's Django lesson is self-contained and does not call Gemini.

## Stack

- pnpm workspaces, TypeScript, React + Vite + Tailwind for the web app
- Express API with OpenAPI-generated React Query hooks and Zod validators
- Replit's built-in PostgreSQL database with Drizzle; no external database
- bcrypt password hashes and a signed JWT in an HttpOnly, SameSite cookie

## Where things live

- `artifacts/qodia/src/` — pages, learning session, and Arabic dark theme
- `artifacts/api-server/src/routes/` — account and learning endpoints
- `lib/api-spec/openapi.yaml` — API contract
- `lib/db/src/schema/` — users, sessions, and progress tables

## Architecture decisions

- The managed project template supports a React/Vite web artifact plus a shared Express API, rather than Next.js App Router. Keep that structure for this project; the requested URLs and behaviors remain available.
- This project uses Replit's currently managed SQL database, not the older `@replit/database` key-value package named in the supplied brief. This keeps account and progress data in the project's built-in, deployable database.
- The lesson content is intentionally fixed to Django ForeignKey and `on_delete` for the MVP. No AI key is needed to complete it.
- XP is computed on the server from completed touches and mistakes, not trusted from the client.

## Product

- Public landing page, registration, sign-in, onboarding, dashboard, and a five-touch defense practice session.
- Personal XP, level, streak, and recent attempts persist per account.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, run codegen before using changed hooks or validators.
- Workflows already exist for the app and API; restart those rather than creating duplicate services.
- Workspace package installs must target the package, e.g. `pnpm --filter @workspace/api-server add <name>`; a plain root add is rejected in this monorepo.