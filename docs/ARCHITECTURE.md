# Architecture

> This document describes the architecture **as currently implemented**. The intended target architecture is called out explicitly in §9 so the two are not confused.

## 1. Stack

| Concern | Technology |
| --- | --- |
| Framework | Nuxt 4 (Vue 3, Vite, Nitro server engine) |
| Language | TypeScript |
| UI | Bootstrap 5, Bootstrap markup, Nuxt pages (`app/`) |
| Database | SQLite via `better-sqlite3` |
| Data access | Drizzle ORM (schema-first) |
| Validation | Zod |
| Auth | HTTP-only cookie session + Argon2id password hashing |
| Authorization | Custom ABAC policy engine |
| Tests | Vitest (unit) |

Runtime config (`nuxt.config.ts`): `sessionSecret` (currently unused), `databasePath` (default `.data/simple-shop.sqlite`), `appName`, `defaultAdminEmail`, `defaultAdminPassword`.

## 2. Repository layout

```
app/                         Nuxt app (client)
  app.vue                    Root layout wrapper
  layouts/default.vue        Nav shell + client-side session probe
  pages/                     Routed pages: index, login, products, inventory,
                             customers, sales, sales/[id], reports, policies
  assets/css/main.css        Bootstrap import + theme
server/                      Nitro server (backend)
  api/                       HTTP route handlers
  auth/index.ts              Session, password, CSRF, subject builder
  abac/index.ts              Pure policy engine (no I/O)
  utils/abac.ts              DB-backed policy loading + authorizeAction()
  utils/sales-payment.ts     Balance/status helpers
  utils/sales-report.ts      Report aggregation
  database/                  Drizzle schema, SQL migration, seed, connection
  plugins/init.ts            Nitro startup plugin: migrate + seed
tests/                       Vitest unit tests
docs/                        This documentation
```

There are **no** `middleware/`, `components/`, or `composables/` directories; pages are self-contained and the layout contains all shared shell logic.

## 3. Frontend responsibilities

- Rendering Bootstrap pages and forms.
- Fetching data **client-side only**: every page uses `useFetch(..., { server: false })`, so no page data is server-rendered.
- Holding the CSRF token in a readable cookie (`useCookie('shop_csrf')`) and sending it as the `x-csrf-token` header on mutations.
- Client-side navigation guard: `app/layouts/default.vue:16-39` calls `/api/me` on mount and on route change, redirecting to `/login` on failure. This is a UX guard only — it is **not** a security control (all data authorization is server-side).

## 4. API request flow

```
Browser page
  └─ $fetch / useFetch  ──►  Nitro route (server/api/**)
        route handler
          ├─ requireAuth(event)        (throws 401 if no valid session)
          ├─ validateCsrf(event)       (mutations only; throws 403)
          ├─ schema.parse(body)        (Zod validation)
          ├─ authorizeAction({...})    (ABAC; throws 403 on deny)
          ├─ db.transaction(...)       (Drizzle/better-sqlite3, sync)
          └─ JSON response { ok: true, ... }
```

## 5. Route inventory

| Method & path | Auth | CSRF | ABAC action | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/auth/login` | public | no | none | Creates session + cookies |
| `POST /api/auth/logout` | yes | no | none | Deletes session row, clears cookies |
| `GET /api/csrf` | optional | n/a | none | Echoes CSRF cookie + session flag |
| `GET /api/me` | yes | n/a | none | Returns current user attributes |
| `GET /api/dashboard` | yes | n/a | **none** | Cross-branch, ABAC bypass |
| `GET /api/products` | yes | n/a | `product.read` | Branch-scoped query |
| `POST /api/products` | yes | yes | `product.create` | Writes product + initial stock movement |
| `GET /api/inventory` | yes | n/a | `product.read` | Branch-scoped stock movements |
| `POST /api/inventory/adjust` | yes | yes | `inventory.adjust` | Optimistic stock guard + audit log |
| `GET /api/customers` | yes | n/a | `customer.read` | Returns all customers |
| `POST /api/customers` | yes | yes | `customer.read` **(wrong action)** | Creates customer |
| `GET /api/sales` | yes | n/a | `sale.read` (per row) | Filters rows by decision |
| `POST /api/sales` | yes | yes | `sale.create` | Creates sale, items, movements, payment |
| `GET /api/sales/:id` | yes | n/a | `sale.read` | Receipt data |
| `POST /api/sales/:id/payments` | yes | yes | `payment.record` | Balance-checked, audited |
| `GET /api/reports/sales` | yes | n/a | `report.read` | Branch/date-scoped aggregation |
| `GET /api/policies` | yes | n/a | `policy.manage` | Lists policies |
| `POST /api/policies` | yes | yes | `policy.manage` | Creates policy |

## 6. Service / module layers

The codebase does **not** use a formal controller/service/repository split. The layering is:

1. **Route handlers** (`server/api/**`) contain transport concerns plus business logic inline.
2. **Shared pure helpers**: `server/abac/index.ts` (engine), `server/utils/sales-payment.ts`, `server/utils/sales-report.ts`. These are unit-tested and I/O-free.
3. **Cross-cutting server utils**: `server/utils/abac.ts` (DB policy loading + `authorizeAction`), `server/auth/index.ts` (session/CSRF/password).
4. **Database layer**: `server/database/index.ts` exports a singleton `db` and `sqlite` connection; `schema.ts` defines tables.

Business rules such as stock checks, discount limits, and balance checks live inline in route handlers.

## 7. Database access and transactions

- A single module-level `better-sqlite3` connection is created in `server/database/index.ts`, with `PRAGMA foreign_keys = ON` and `journal_mode = WAL`.
- Drizzle is initialized over that connection. All operations are **synchronous** (`better-sqlite3` API).
- Transactions use `db.transaction(() => { ... })` with synchronous callbacks. Used by: product creation, inventory adjustment, sale creation, payment recording.
- The startup plugin `server/plugins/init.ts` runs `migrateDatabase()` then `seedPrimaryData()` on every Nitro boot.
- Migrations are applied by reading `server/database/migrations/001_init.sql` and executing it idempotently (`CREATE TABLE IF NOT EXISTS`). There is no migration-tracking table and only one migration file is read.

## 8. Authentication and session lifecycle

```
login → verify email exists & account_status = 'active'
      → argon2.verify(password, passwordHash)
      → createUserSession(): random 32-byte hex token
            insert sessions(id = token, token_hash = argon2(token), expires_at = now+8h)
      → setAuthCookies(): shop_session (httpOnly), shop_csrf (readable), both SameSite=Lax,
                          Secure only when NODE_ENV=production, path=/
```

- **Authentication check**: `getCurrentSession` reads `shop_session`, looks up `sessions.id === token`, deletes expired rows, then loads the `users` row. `requireAuth` throws 401 when absent.
- **Note:** `token_hash` is written but never used for verification; the raw token is the primary key (see `PROJECT_STATUS.md` §5.1).
- **Logout**: deletes the `sessions` row for the cookie value and clears cookies.
- **CSRF**: double-submit. `validateCsrf` (mutations only) compares the `shop_csrf` cookie with the `x-csrf-token` header. Not applied to `login`/`logout`.
- **Subject construction**: `buildSubjectFromUser` (`server/auth/index.ts:113`) maps the user row into ABAC subject attributes.

## 9. ABAC enforcement architecture

```
route handler
  → authorizeAction({ user, action, resource, environment? })     server/utils/abac.ts
       → buildSubjectFromUser(user)                                server/auth/index.ts
       → getPolicyList()  — SELECT * FROM abac_policies → PolicyDefinition[]
       → new AbacPolicyEngine().decide({ subject, resource, action, environment, policies })
       → if decision.effect !== 'Permit' throw createError(403)
```

- The engine (`server/abac/index.ts`) is pure: it filters policies by action, evaluates conditions against `{ subject, resource, environment }`, applies **explicit-Deny-wins**, then Permit, then **default deny**.
- Policies are stored as JSON condition trees in `abac_policies.condition_json`; `target_action` selects the action; `effect` is `Permit`/`Deny`.
- `environment` always includes `currentTime` and any caller-supplied fields.
- See `docs/ABAC_AUTHORIZATION.md` for the full model and its deviations.

## 10. Error handling and validation

- Handlers throw `createError({ statusCode, statusMessage })` for auth (401), CSRF (403), authorization (403), not-found (404), and conflict (409) cases.
- Request bodies/queries are validated with Zod. `login` uses `safeParse` (returns 400); other handlers call `.parse()` directly, so malformed input surfaces as an unhandled `ZodError` (HTTP 500) rather than 400.
- There is no global Nitro error handler, no structured logging, and no request-correlation id.
- Audit logs are written only by `inventory.adjust` and `payment.record`.

## 11. Current architectural limitations

- No service/repository abstraction; business logic and SQL are inline in route handlers, which makes reuse and testing harder.
- Client-side-only data fetching means the layout's auth redirect is purely cosmetic; there is no SSR data protection.
- Single shared DB connection; no connection pool abstraction (acceptable for SQLite but couples test and runtime to one path).
- Authorization is inconsistent: dashboard bypasses ABAC, customer creation mislabels its action, discount checks are hard-coded, field-level policy is not enforced.
- Policy conditions are not editable through the UI (the create form posts a fixed default condition), and policies cannot be updated or deactivated.
- No application settings usage, no user/attribute management, no branch/category management.

## 12. Intended vs. actual

| Intended (requirements) | Actual today |
| --- | --- |
| Pure ABAC on every protected operation | ABAC on most read/write routes; dashboard bypasses it; customer-create uses the read action; discount is a hard-coded attribute check |
| Server-enforced authorization | Yes on APIs (except dashboard); pages rely on client redirect only |
| Record- and field-level restrictions | Record-level branch scoping on most routes; field-level not enforced; dashboard not branch-scoped |
| User attributes + policy administration | Policy create/list exists; conditions not editable; no attribute/user administration |
| Audit logging | Only inventory + payment writes |
| Automated business/integration/security tests | Unit tests for helpers/engine only |
| Migration management | Single idempotent SQL file, no tracking table |
