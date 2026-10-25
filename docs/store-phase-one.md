# Store — phase 1

This catalog belongs to Kodia. It does not connect to student sessions, learning maps, XP, validation, the final defense, payments, or file delivery.

## Public pages

- `/store`: public catalog and client-side technology/difficulty filters.
- `/store/:slug`: public project detail and interest registration.
- Two clearly labeled `coming_soon` placeholder listings are seeded idempotently on the first catalog request: Flutter and Django. Slug conflicts never overwrite existing editorial changes.
- Titles, descriptions, whole-dollar prices, and included-pack descriptions are provisional editorial defaults. No pack files are delivered in phase 1.
- `draft` projects are excluded from public list, detail, and interest endpoints.

## Storage

Existing PostgreSQL/Drizzle database; new `store_projects` and `store_interest` tables only. Apply schema using the existing `pnpm --filter @workspace/db run push` workflow. Never force schema changes or replace the database.

An atomic unique index prevents duplicate interest for the same project and normalized contact, including differently cased emails or formatted phone numbers. HTML tags/control characters are rejected, database values are parameterized, and UI text is rendered through React rather than HTML interpolation. Public APIs never return interest entries or contacts.

## Admin access

There is no existing admin role. Configure a strong, random `ADMIN_KEY` (16–512 characters) through workspace Secrets. Missing/short configuration fails closed.

Open `/admin/store-interest?key=YOUR_ADMIN_KEY` on a trusted device. The page immediately removes the query string from the visible address/history and keeps the key only in component memory; reloading requires reopening the keyed URL. Do not share or bookmark a keyed URL, put it in chat, or use a real secret in documentation.

The protected API is `GET /api/admin/store-interest?key=...`. Application request logs omit query strings. Responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. No contacts are sent until the server authenticates the key. No password/login flow or account privileges are added.

## Assumptions

- Both coming-soon and future available listings use interest capture only; there is no Buy or Download action in phase 1.
- The three purchase/explanation/defense steps describe the planned pack experience, not a currently working checkout or automatic understanding-card integration.
- Institute prices are starting prices; contact capture does not constitute a purchase, paid reservation, or guaranteed availability.
