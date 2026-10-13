# Project Status

> Audit date: 2026-10-13
> Scope: read-only inspection of the existing codebase. No implementation code was modified while producing this document.

## 1. Project overview

Simple Shop Sales is a Nuxt 4 + TypeScript sales and inventory management application backed by SQLite (via `better-sqlite3` + Drizzle ORM) with a Bootstrap 5 UI and a custom attribute-based access control (ABAC) policy engine.

At the time of this audit the project is a functional single-branch MVP: authentication, products, inventory adjustments, customers, sales, payments, receipts, reports, and policy management are wired from the UI through Nitro server routes to SQLite. Several requirements are only partially implemented, and a number of correctness and security gaps exist (see sections 5 and 6).

## 2. Verification performed

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `pnpm test` | **PASS** — 7 files, 28 tests passed, running against isolated temp DBs (T0.1 + T0.2) |
| Type checking | `pnpm typecheck` | **PASS** — exit code 0, no diagnostics |
| Production build | `pnpm build` | **PASS** — exit code 0, `.output/` produced in ~12s |
| Live DB inspection | read-only `better-sqlite3` query against `.data/simple-shop.sqlite` | 14 tables present, foreign keys enabled, 1 user, 1 branch, 2 products, 1 customer, 9 policies |

Test files executed: `tests/abac.spec.ts`, `tests/sales-payment.spec.ts`, `tests/sales-report.spec.ts`, `tests/test-isolation.spec.ts`.

Tests are isolated from the developer database: `tests/setup.ts` forces `NUXT_DATABASE_PATH` to a per-worker file under `<tmp>/simple-shop-sales-tests/` before the app DB module is imported, and `tests/global-setup.ts` removes the temp directory before and after the run. Verified byte-for-byte (unchanged SHA-256) that `.data/simple-shop.sqlite` is not modified, including when a misleading `NUXT_DATABASE_PATH` is set in the shell. Re-verified 2026-10-13 under `strace`: the test process tree opened only `/tmp/simple-shop-sales-tests/worker-{1..4}.sqlite` and never `.data/simple-shop.sqlite`. See "Verified progress" below.

No HTTP/integration/end-to-end tests were found or executed. The application was **not** started for manual end-to-end verification during this audit; frontend behavior is assessed by code inspection only.

## 3. Feature status classification

Legend: **Complete & verified** · **Implemented, unverified** · **Partial** · **Not implemented** · **Broken** · **Blocked**

| Area | Status | Evidence / files |
| --- | --- | --- |
| Nuxt 4 + TypeScript project | Complete & verified | `package.json`, `nuxt.config.ts`, `tsconfig.json`; `pnpm typecheck` + `pnpm build` pass |
| Bootstrap 5 UI | Complete & verified | `app/assets/css/main.css:1` imports Bootstrap; responsive grid used across pages; build passes |
| SQLite + Drizzle schema & migration | Complete & verified (engine caveats) | `server/database/schema.ts`, `server/database/migrations/001_init.sql`; 14 tables confirmed in live DB |
| Seed/bootstrap data | Complete & verified | `server/database/seed.ts`; live DB has branch `branch-main`, admin user, 9 policies |
| Password hashing (Argon2id) | Complete & verified | `server/auth/index.ts:11`; argon2 used in `login.post.ts` |
| Session authentication | **Partial** | `server/auth/index.ts:27-65`; works, but token is stored plaintext as primary key and `tokenHash` is never verified (see §5) |
| CSRF protection | Partial | `server/auth/index.ts:99`; enforced on most state-changing routes, **not** on login/logout |
| ABAC policy engine (evaluate/decide/fail-closed) | Complete & verified | `server/abac/index.ts`; unit tests pass |
| ABAC enforcement on APIs | **Partial** | `server/utils/abac.ts`; `dashboard.get.ts` bypasses ABAC; `customers.post.ts` reuses `customer.read` |
| Products (create/read) | Implemented, unverified | `server/api/products.get.ts`, `products.post.ts`; `app/pages/products.vue`. No update/archive |
| Product update/archive | Not implemented | `product.update`/`product.archive` actions exist but no route/UI |
| Categories | Not implemented | `categories` table exists; no API/UI (`server/database/schema.ts:34`) |
| Inventory adjustments + movement history | Complete & verified (logic) | `server/api/inventory/adjust.post.ts`, `inventory.get.ts`; audited, optimistic `WHERE stock = ?` guard |
| Customers (create/read) | Implemented, unverified | `server/api/customers.get.ts`, `customers.post.ts`. No update/delete |
| Sales creation | **Broken (integrity)** | `server/api/sales.post.ts:93-96`; stock decrement is not concurrency-safe inside the transaction (see §5) |
| Sales listing / receipt | Implemented, unverified | `sales.get.ts`, `sales/[id].get.ts`, `app/pages/sales.vue`, `app/pages/sales/[id].vue` |
| Sale void / update | Not implemented | `sale.void`/`sale.update` actions exist; no endpoints or UI |
| Payments + outstanding balance | Implemented, unverified | `sales/[id]/payments.post.ts`; balance math unit-tested (`tests/sales-payment.spec.ts`); route itself untested |
| Printable receipt | Implemented, unverified | `app/pages/sales/[id].vue` with `@media print`; no automated test |
| Dashboard | **Partial** | `server/api/dashboard.get.ts`; no ABAC check and **not branch-scoped** (cross-branch aggregation) |
| Reports (collections/daily/top products) | Implemented, unverified | `reports/sales.get.ts`, `utils/sales-report.ts`; aggregation unit-tested; route untested |
| ABAC policy management (create/list) | Partial | `policies.get.ts`, `policies.post.ts`, `app/pages/policies.vue`; conditions not editable in UI, no update/delete/deactivate |
| User & attribute management | Not implemented | `user_attributes` table unused; no user CRUD/API/UI |
| Audit logs (writes) | Partial | Only `inventory.adjust` and `payment.record` write audit rows; sale/product/customer/policy/auth events not audited |
| Automated business-logic tests | Partial | Payment + report util tests exist |
| Automated integration tests | Not implemented | No test hits an HTTP route |
| Automated security tests | Not implemented | No auth/ABAC/CSRF integration tests |
| Documentation | Provided by this audit | `docs/*` |

## 4. Functionality that must be preserved

These behave correctly and should not be rewritten:

- ABAC engine semantics: `Permit`/`Deny`/default-deny, explicit-deny precedence, operators, nested conditions (`server/abac/index.ts`).
- Inventory adjustment flow, including the in-transaction optimistic `WHERE products.stock = <old>` guard and audit log write (`server/api/inventory/adjust.post.ts`).
- Payment recording flow, including in-transaction balance re-check, sale status update, and audit log (`server/api/sales/[id]/payments.post.ts`).
- Payment balance/status helpers (`server/utils/sales-payment.ts`) and report aggregation (`server/utils/sales-report.ts`) — covered by passing tests.
- Argon2id password hashing, HTTP-only session cookie, CSRF double-submit on protected mutations.
- Bootstrap 5 responsive layout and printable receipt styling.

## 5. Known bugs, technical debt, and security concerns

Severity is relative to a production deployment.

### Critical

1. **Session token stored in plaintext as the primary key; `tokenHash` is dead code.**
   `createUserSession` inserts `id = <raw token>` and `tokenHash = argon2.hash(<raw token>)` (`server/auth/index.ts:32-38`), but `getCurrentSession` looks the session up by `eq(sessions.id, sessionId)` (`server/auth/index.ts:49`) and never verifies `tokenHash`. Anyone with read access to the `sessions` table can authenticate as any user by replaying the stored `id`. The Argon2 hashing provides no protection here.

2. **Concurrent-sale stock corruption (oversell / lost update).**
   `sales.post.ts` reads products **before** the transaction (`:45-59`), then inside the transaction writes `stock: entry.product.stock - entry.item.quantity` with `WHERE id = ?` only (`:93-96`). There is no re-read and no compare-and-swap inside the transaction, so two concurrent sales can both subtract from the same stale value, producing lost updates and negative/incorrect stock. Contrast with `inventory/adjust.post.ts`, which correctly re-reads and guards on the old stock value.

3. **Dashboard leaks cross-branch data and bypasses ABAC.**
   `server/api/dashboard.get.ts` only calls `requireAuth` and aggregates **all** sales, payments, and products with no `branchId` filter and no `authorizeAction`. A user scoped to one branch sees global totals and every branch's low-stock products.

### High

4. **`customers.post` authorized as `customer.read`.**
   Creating a customer is gated by the read action (`server/api/customers.post.ts:18`). There is no `customer.create` action in `SupportedAction`, so any user who can read customers can create them. This is a policy-model gap, not a pure-ABAC decision.

5. **`abac_policies.active` is ignored at evaluation time.**
   `getPolicyList()` (`server/utils/abac.ts:7-22`) selects all policies with no `active` filter, and the engine never checks `active`. Deactivating a policy (were an endpoint to exist) would have no effect.

6. **Field-level ABAC is not enforced.**
   Only the engine unit test exercises a field-level `Deny`. No API filters fields: `products.get.ts` returns full rows including `costPrice` to every user permitted `product.read`, whose default policy checks only `accountStatus`.

7. ~~**Tests mutate the developer's real database.**~~ **RESOLVED (T0.1, verified 2026-10-13).**
   Previously `tests/abac.spec.ts:212` called `db.delete(abacPolicies)` against the default `.data/simple-shop.sqlite` because `vitest.config.ts` configured no test database. Tests now run against a per-worker temp DB (`tests/setup.ts` + `tests/global-setup.ts` + `vitest.config.ts`), and the developer DB was confirmed unchanged byte-for-byte after a test run.

### Medium

8. **Inconsistent `discountLimit` semantics.** `sale.create` compares an absolute currency discount against `user.discountLimit` (`sales.post.ts:36-38`), while `tests/abac.spec.ts:150-174` treats `discountLimit` as a percentage cap. The `sale.discount` action is defined but never invoked, so discount authorization is a hard-coded attribute check rather than a policy decision.

9. **`getPolicyList` silently coerces a null action to `product.read`** (`server/utils/abac.ts:15`). A policy stored without `target_action` applies to product reads, which can produce unintended permits/denies.

10. **Unvalidated-request → HTTP 500.** Route handlers call `schema.parse(...)` directly (e.g. `products.post.ts:26`, `sales.post.ts:26`, `policies.post.ts:21`). A `ZodError` is not converted to a 400, so malformed input yields a 500.

11. **Null-branch users are silently scoped to `branch-main`.** Every route uses `user.branchId ?? 'branch-main'`. A user with no assigned branch is granted main-branch scope instead of being denied, undermining the branch attribute as an authorization control.

12. **No rate limiting or lockout on login; no auth audit logging.** `login.post.ts` has no throttling and writes no audit row for success/failure.

13. **Unused `sessionSecret` config with committed default.** `nuxt.config.ts` defines `sessionSecret` defaulting to `development-secret-change-me`, but nothing reads it. Dead configuration with a committed weak default.

### Low

14. `sales.post.ts:41` uses `SALE-${Date.now()}` as the reference — collision risk under same-millisecond concurrency (unique constraint would throw).
15. `csrf.get.ts:1` imports `getCurrentSession` twice (one aliased, unused).
16. No pagination on products/sales/customers; `sales.get.ts` performs N engine evaluations plus multiple full-table loads.
17. `logout.post.ts` does not call `validateCsrf`; `application_settings` and `user_attributes` tables are unused.
18. No shared `docs/` existed prior to this audit; no `.env.example` and no in-app error boundary.

## 6. Areas that could not be verified

- No running-server, HTTP-level, or browser verification was performed; all API behavior claims come from code inspection plus unit tests.
- Concurrency bugs (#2) are reasoned from code, not reproduced with a concurrency test.
- Real deployment behavior behind TLS/proxy (secure-cookie flag, proxy `remoteAddress` for audit IP) was not exercised.
- No confirmation of expected money/precision conventions (values are stored as integer minor/whole units; `discountLimit` semantics are ambiguous as noted).

## 7. Regression risks to watch

- The defaults `user.branchId ?? 'branch-main'` are load-bearing; tightening them to deny unassigned users (#11) changes behavior and needs test coverage.
- Any change to `getPolicyList` (#5, #9) alters live authorization for existing seeded policies.
- The `active`-flag fix (#5) will start filtering policies that may already be inactive in production data.
- Sale-stock concurrency fixes (#2) must preserve the current `stock_movements`/`audit_logs` writes.

## 8. Verified progress since the audit

### T0.1 — Isolate automated tests from the developer database — COMPLETE (verified 2026-10-13)

**Change (test-only; no production code modified):**

| File | Change |
| --- | --- |
| `tests/support/test-database.ts` | New. Computes the per-worker temp DB path under `<tmp>/simple-shop-sales-tests/`. |
| `tests/setup.ts` | New. Sets `NUXT_DATABASE_PATH` to the temp path **before** importing the app DB, then runs `migrateDatabase()` to create the schema. |
| `tests/global-setup.ts` | New. Removes the temp directory before and after the run. |
| `tests/test-isolation.spec.ts` | New. Guard tests asserting the DB path is the temp path and the schema exists. |
| `vitest.config.ts` | Registered `globalSetup` and `setupFiles`. |

The app already supported `NUXT_DATABASE_PATH`; the only server-side element involved is the read-only `getDatabasePath()` accessor in `server/database/index.ts` used by the isolation guard. No runtime or application behavior was changed.

**Verification:**

- `pnpm test` → 4 files, 19 tests passed (16 existing + 3 new isolation guards).
- `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0.
- Developer DB `.data/simple-shop.sqlite` **unchanged**: identical SHA-256 (`d50186b5…`) and identical row counts/policy IDs before and after the run.
- Re-ran the suite with `NUXT_DATABASE_PATH` deliberately set to the developer DB path; tests still used the temp DB and the developer DB hash remained unchanged.
- Temp directory was removed after the run.

**Independent re-verification (2026-10-13, second pass):**

- Wrapped `pnpm test` in `strace -f`; the test process tree opened only `/tmp/simple-shop-sales-tests/worker-{1..4}.sqlite` (plus `-wal`/`-shm`/`-journal`) and **never** `.data/simple-shop.sqlite`.
- Repeated the run with `NUXT_DATABASE_PATH="$PWD/.data/simple-shop.sqlite"` exported in the shell; the override still resolved to the temp path and no developer-DB open appeared in the trace.
- Before/after the full sequence (`pnpm test`, `pnpm typecheck`, `pnpm build`), `.data/simple-shop.sqlite`, `.data/simple-shop.sqlite-wal`, and `.data/simple-shop.sqlite-shm` all had identical SHA-256 values and unchanged mtimes.
- Two `nuxt dev` servers were running against the default `.data/simple-shop.sqlite` during verification, and the files remained byte-identical nonetheless.
- Temp directory `/tmp/simple-shop-sales-tests/` was absent after each run.

**Limitations:** Each worker (and each test file in the same worker) shares one temp DB file; the suite does not currently reset/reseed between files, which is sufficient for today's tests but should be revisited if cross-file state assumptions are added (roadmap T0.2).
