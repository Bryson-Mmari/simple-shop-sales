# Simple Shop Sales

A Nuxt 4 sales and inventory management system with a SQLite-backed server, Drizzle ORM, Bootstrap 5 UI, and a custom ABAC policy engine.

## Features

- Secure HTTP-only session authentication with Argon2id password hashing
- SQLite schema with Drizzle migrations and seed bootstrap support
- Central ABAC policy engine with permit/deny decisions and fail-closed behavior
- Dashboard, products, customers, inventory, sales, reports, and policy pages
- Audited stock adjustments with branch-scoped movement history
- Partial and follow-up payments with outstanding balances and printable receipts
- Branch-filtered sales reports for collections, daily sales, and top products
- Bootstrap 5 responsive UI with Nuxt pages and server APIs

## Getting started

1. Install dependencies:
   `pnpm install`
2. Start the development server:
   `pnpm dev --host 0.0.0.0`
3. For the first admin account, set bootstrap environment variables before starting:
   `NUXT_BOOTSTRAP_EMAIL=admin@example.com NUXT_BOOTSTRAP_PASSWORD='StrongPass123!' pnpm dev --host 0.0.0.0`
4. Log in at the app root with the bootstrap credentials.

## Environment variables

- `NUXT_SESSION_SECRET`: session signing secret
- `NUXT_DATABASE_PATH`: SQLite file path; default `.data/simple-shop.sqlite`
- `NUXT_APP_NAME`: display app name
- `NUXT_BOOTSTRAP_EMAIL`: first-user bootstrap email
- `NUXT_BOOTSTRAP_PASSWORD`: first-user bootstrap password

## Useful commands

- `pnpm test` - run the ABAC policy tests
- `pnpm typecheck` - run the Nuxt TypeScript checker
- `pnpm build` - production build
- `pnpm dev --host 0.0.0.0` - local development server
- `pnpm db:generate` - generate Drizzle migrations

## ABAC implementation notes

- Policies are stored as validated definitions and evaluated centrally in the policy engine.
- Explicit Deny wins over Permit when applicable policies overlap.
- If no applicable policy permits an action, the decision fails closed with a deny response.
- Protected server operations enforce authorization on the server before reading or changing records.

## Data and backup

- SQLite data is stored in `.data/simple-shop.sqlite` by default.
- Back up the database file regularly.
- Restore by copying the SQLite file back into the same path or updating `NUXT_DATABASE_PATH`.

## Security notes

- Never expose database paths, session secrets, or runtime configuration to the browser.
- Session IDs are opaque random tokens stored in HTTP-only cookies.
- CSRF validation is enforced for state-changing requests.
- Generic login failures are returned to avoid user enumeration.

## Documentation

- [Project status](docs/PROJECT_STATUS.md) - audit findings, verification evidence, bugs, and security concerns.
- [Architecture](docs/ARCHITECTURE.md) - implemented layers, request flow, and limitations.
- [Database](docs/DATABASE.md) - schema, migrations, transactions, and integrity risks.
- [ABAC authorization](docs/ABAC_AUTHORIZATION.md) - attributes, policies, evaluation, and deviations.
- [Requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md) - requirement-by-requirement status.
- [Implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md) - prioritized, phased tasks.
- [Development guide](docs/DEVELOPMENT_GUIDE.md) - setup, commands, and backup/restore.
