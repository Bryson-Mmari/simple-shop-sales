# Implementation Roadmap

Prioritized from the audit in `PROJECT_STATUS.md`. Order is by risk: security defects → data integrity → authorization correctness → missing requirements → hardening. Existing working code is preserved; tasks extend or fix, they do not rewrite modules wholesale.

Priority: **P0** critical/blocking · **P1** high · **P2** medium · **P3** low.

---

## Phase 0 — Test safety net (enables safe change)

### T0.1 — Isolate tests from the developer database — COMPLETE (verified 2026-10-13)
- **Area:** Testing infrastructure
- **Status:** Complete & verified. Tests now force `NUXT_DATABASE_PATH` to a per-worker temp file before the app DB module loads; no `server/` code changed.
- **Implemented work:** `vitest.config.ts` registers `globalSetup` (`tests/global-setup.ts`) and `setupFiles` (`tests/setup.ts`); `tests/support/test-database.ts` computes the temp path; `tests/test-isolation.spec.ts` guards the behavior.
- **Dependencies:** none
- **Priority:** P0
- **Files:** `vitest.config.ts`, `tests/setup.ts`, `tests/global-setup.ts`, `tests/support/test-database.ts`, `tests/test-isolation.spec.ts`
- **Acceptance criteria (met):** `pnpm test` runs against a throwaway DB; developer `.data` file unchanged (identical SHA-256 before/after); all 16 existing tests still pass (now 19 with guards).
- **Tests:** `tests/test-isolation.spec.ts` asserts `getDatabasePath()` is the temp path and the schema exists.
- **Evidence:** 19 tests pass; typecheck exit 0; build exit 0; dev DB SHA-256 `d50186b5…` unchanged; run also passed with a misleading `NUXT_DATABASE_PATH` pointing at the dev DB. Re-verified 2026-10-13 with `strace -f`: only `/tmp/simple-shop-sales-tests/worker-{1..4}.sqlite` was opened; `.data/simple-shop.sqlite` (+`-wal`/`-shm`) hashes and mtimes unchanged across `test`/`typecheck`/`build` even with two `nuxt dev` servers running on the default DB.
- **Follow-up (not T0.1):** per-file reset/reseed of the shared worker temp DB can be added with the T0.2 harness if needed.

### T0.2 — Integration/security test harness — COMPLETE (verified 2026-10-13)
- **Area:** Testing infrastructure
- **Status:** Complete & verified. Added lightweight request harness and helpers to create users/sessions; seeded integration/security tests using direct handler invocation with mocked H3 events.
- **Implemented work:** `tests/helpers/db.ts` (table clearing), `tests/helpers/auth.ts` (users/sessions), `tests/helpers/request.ts` (simple route invoker for API handlers), `tests/helpers/index.ts`; `tests/security/route-auth.spec.ts` (401/200 on /api/me, login cases), `tests/security/csrf-and-abac.spec.ts` (CSRF enforcement, ABAC deny, branch scoping), `tests/security/harness-selftest.spec.ts` (harness sanity).
- **Dependencies:** T0.1
- **Priority:** P1
- **Files:** `tests/helpers/*`, `tests/security/*`
- **Acceptance criteria (met):** Authenticated route returns 200; unauthenticated returns 401; at least 9 security harness tests pass.
- **Tests:** 3 security test files, 9 tests pass; all existing tests still pass (total 7 files, 28 tests).

---

## Phase 1 — Critical security & data integrity

### T1.1 — Stop storing replayable session tokens; verify token hash
- **Area:** Authentication/session
- **Status:** Broken (see `PROJECT_STATUS.md` §5.1)
- **Missing work:** Either (a) store only `hash(token)` and look sessions up by hashing the presented cookie, or (b) store a separate random `id` and the hashed token with a lookup index, verifying `argon2.verify(tokenHash, presentedToken)`. Remove the unused-column ambiguity.
- **Dependencies:** T0.1 (to test safely)
- **Priority:** P0
- **Files:** `server/auth/index.ts`, `server/database/schema.ts` + migration, `server/api/auth/login.post.ts`, `logout.post.ts`, `csrf.get.ts`
- **Acceptance criteria:** A raw session token is never enough to locate a session row without verification; forged/replayed tokens fail; login/logout/me still work.
- **Tests:** unit test for session creation/lookup; test that a tampered cookie returns 401; DB contains no usable raw token as lookup key.

### T1.2 — Fix concurrent stock corruption in sale creation
- **Area:** Sales/inventory integrity
- **Status:** Broken (`server/api/sales.post.ts:93-96`)
- **Missing work:** Move stock reads into the transaction and use a compare-and-swap/re-read with rejection (mirror `inventory/adjust.post.ts`), or aggregate quantities per product to avoid double-spend; write `stock_movements` only after a successful guarded update.
- **Dependencies:** T0.1
- **Priority:** P0
- **Files:** `server/api/sales.post.ts`
- **Acceptance criteria:** Two concurrent sales of the last unit cannot both succeed; stock never goes negative; movement deltas reconcile with `products.stock`.
- **Tests:** concurrency/integration test simulating overlapping sales; DB assertion on final stock and movement total.

### T1.3 — Enforce ABAC + branch scoping on the dashboard
- **Area:** Authorization/dashboard
- **Status:** Broken/bypass (`server/api/dashboard.get.ts`)
- **Missing work:** Add an action (e.g. `report.read` or a new `dashboard.read`) and call `authorizeAction`; scope every query by the caller's branch (or authorized branches); remove or gate global aggregates.
- **Dependencies:** T0.2
- **Priority:** P0
- **Files:** `server/api/dashboard.get.ts`, `server/abac/index.ts` (action set), seed (`server/database/seed.ts`)
- **Acceptance criteria:** A branch-A user sees only branch-A totals/products; user without dashboard permission receives 403.
- **Tests:** integration test with two branches asserting isolation; 403 test.

### T1.4 — Enforce `active` flag and remove null-action coercion
- **Area:** ABAC engine/storage
- **Status:** Broken (`server/utils/abac.ts:7-22`)
- **Missing work:** Filter `active = 1` in `getPolicyList`; represent `active` on `PolicyDefinition`; reject policies with a missing/unsupported action instead of defaulting to `product.read`; validate stored policies on load (log/skip invalid).
- **Dependencies:** T0.1
- **Priority:** P0
- **Files:** `server/utils/abac.ts`, `server/abac/index.ts`
- **Acceptance criteria:** Deactivated policies have no effect; a policy with no action cannot act as a product-read policy; invalid stored policies do not silently broaden access.
- **Tests:** engine/util tests for inactive policy, null action, and invalid stored policy.

### T1.5 — Correct customer creation action
- **Area:** Authorization/customers
- **Status:** Broken (`customers.post.ts:18`)
- **Missing work:** Add `customer.create` (and `customer.update`) to `SupportedAction`; use it in `customers.post.ts`; seed a default `customer.create` policy.
- **Dependencies:** none
- **Priority:** P1
- **Files:** `server/abac/index.ts`, `server/api/customers.post.ts`, `server/database/seed.ts`
- **Acceptance criteria:** Customer creation requires a create-specific policy/attribute; read-only users cannot create.
- **Tests:** integration test: read-permitted but not create-permitted user gets 403.

---

## Phase 2 — Authorization completeness & foundational correctness

### T2.1 — Make discount authorization policy-driven
- **Area:** Sales/ABAC
- **Status:** Partial (`sales.post.ts:36-38`, `sale.discount` unused)
- **Missing work:** Route discount decisions through `sale.discount` (and/or `sale.create` resource attributes); define `discountLimit` semantics (absolute vs percent) and apply consistently; keep a hard safety bound.
- **Dependencies:** T1.4
- **Priority:** P1
- **Files:** `server/api/sales.post.ts`, `server/database/seed.ts`, `docs/ABAC_AUTHORIZATION.md`
- **Acceptance criteria:** Discount over a subject's limit is denied by policy; semantics documented and tested; no route bypasses it.
- **Tests:** unit + integration tests for within-limit, at-limit, over-limit.

### T2.2 — Deny-by-default for unassigned-branch users
- **Area:** Authorization/branch scope
- **Status:** Partial (`user.branchId ?? 'branch-main'` in most routes)
- **Missing work:** Decide and document behavior for users with no `branch_id`; likely require assignment or an explicit "all branches" attribute; stop silently granting `branch-main`.
- **Dependencies:** T2.1
- **Priority:** P1
- **Files:** all `server/api/*` handlers using the `?? 'branch-main'` pattern, `server/auth/index.ts`
- **Acceptance criteria:** An unassigned user cannot read another branch's data by default; behavior covered by tests.
- **Tests:** integration tests for assigned/unassigned users.

### T2.3 — Consistent 400 validation responses
- **Area:** Error handling
- **Status:** Partial (`.parse()` → 500)
- **Missing work:** Convert `ZodError` to 400 (helper or global handler); standardize error shape.
- **Dependencies:** none
- **Priority:** P2
- **Files:** all mutation handlers, new `server/utils/validation.ts` (or Nitro error handler)
- **Acceptance criteria:** Malformed payloads return 400 with a safe message, never 500/stack traces.
- **Tests:** integration tests for invalid bodies on each mutation route.

### T2.4 — Audit sale/product/customer/policy/auth events
- **Area:** Audit logging
- **Status:** Partial
- **Missing work:** Write `audit_logs` rows for sale creation, product creation, customer creation, policy changes, login success/failure, logout; optionally log authorization denials.
- **Dependencies:** T2.1
- **Priority:** P2
- **Files:** `server/api/sales.post.ts`, `products.post.ts`, `customers.post.ts`, `policies.post.ts`, `auth/login.post.ts`, `logout.post.ts`
- **Acceptance criteria:** Every sensitive mutation produces an audit row with actor, action, resource, timestamp, IP.
- **Tests:** integration tests asserting audit rows.

---

## Phase 3 — Missing core requirements

### T3.1 — Product update & archive (+ categories)
- **Area:** Products/categories
- **Status:** Not implemented / Partial
- **Missing work:** `product.update`, `product.archive` endpoints + UI; categories CRUD + UI; wire `categoryId` into product create/update.
- **Dependencies:** T1.4, T2.3
- **Priority:** P2
- **Files:** new `server/api/products/[id].patch.ts`, `server/api/categories*.ts`, `app/pages/products.vue`, new `app/pages/categories.vue`, `server/database/seed.ts`
- **Acceptance criteria:** Products editable/archivable; categories manageable and assignable; all authorized.
- **Tests:** API + integration tests for CRUD and authorization.

### T3.2 — Sale void & update lifecycle
- **Area:** Sales
- **Status:** Not implemented (`sale.void`, `sale.update` unused)
- **Missing work:** Void endpoint that reverses stock via `stock_movements`, sets status `voided`, blocks payment; optional sale update with concurrency guards.
- **Dependencies:** T1.2, T2.1
- **Priority:** P2
- **Files:** `server/api/sales/[id]/void.post.ts`, `sales.post.ts`, `app/pages/sales.vue`
- **Acceptance criteria:** Voiding restores stock, preserves audit trail, prevents further payments.
- **Tests:** integration tests for void + stock restoration + payment rejection.

### T3.3 — Customer update/delete
- **Area:** Customers
- **Status:** Partial
- **Missing work:** `customer.update`, `customer.delete` (soft delete or FK-safe) + UI.
- **Dependencies:** T1.5
- **Priority:** P2
- **Files:** `server/api/customers/[id].patch.ts`, `.delete.ts`, `app/pages/customers.vue`
- **Acceptance criteria:** Customer records manageable with authorization and audit.
- **Tests:** API tests.

### T3.4 — User & ABAC attribute management
- **Area:** Users/attributes
- **Status:** Not implemented
- **Missing work:** User CRUD for admins; `user_attributes` management; merge `user_attributes` into `buildSubjectFromUser`; `user.update_attributes` action enforcement.
- **Dependencies:** T1.1, T1.4
- **Priority:** P2
- **Files:** new `server/api/users*.ts`, `server/api/users/[id]/attributes*.ts`, `server/auth/index.ts`, new UI pages, seed
- **Acceptance criteria:** Admins can manage users/attributes; policies can reference those attributes; unauthorized users blocked.
- **Tests:** integration + authorization tests.

### T3.5 — Full policy administration
- **Area:** ABAC administration
- **Status:** Partial
- **Missing work:** Editable condition editor UI (JSON or builder), policy update, activate/deactivate, delete; validation feedback; optional policy simulation/preview.
- **Dependencies:** T1.4
- **Priority:** P2
- **Files:** `server/api/policies/[id].patch.ts`, `.delete.ts`, `app/pages/policies.vue`
- **Acceptance criteria:** Full policy lifecycle with server validation and audit.
- **Tests:** API + integration tests; invalid conditions rejected.

### T3.6 — Field-level restrictions (cost price and sensitive fields)
- **Area:** ABAC/field-level
- **Status:** Not implemented (engine supports it)
- **Missing work:** Define field-policy mechanism (e.g. action/attribute-tagged fields), strip fields server-side before serialization, apply to `products.get`/`sales` as needed.
- **Dependencies:** T1.4
- **Priority:** P2
- **Files:** `server/utils/abac.ts`, `server/api/products.get.ts`, `server/database/seed.ts`
- **Acceptance criteria:** Users without the required attribute never receive `costPrice` (or other protected fields).
- **Tests:** integration test asserting field omission.

---

## Phase 4 — Reporting, dashboard polish, and required tests

### T4.1 — Report route tests & `report.export`
- **Area:** Reports
- **Status:** Partial / Not implemented
- **Missing work:** Integration tests for `reports/sales.get.ts`; implement `report.export` (CSV/printable) with authorization.
- **Dependencies:** T2.2, T2.3
- **Priority:** P3
- **Files:** `server/api/reports/sales.get.ts`, new export route, `app/pages/reports.vue`
- **Acceptance criteria:** Reports accurate under branch/date filters; export authorized and correct.
- **Tests:** aggregation + integration tests.

### T4.2 — Receipt verification & pagination
- **Area:** Sales UI/receipts
- **Status:** Implemented, unverified
- **Missing work:** Browser/manual verification of the printable receipt; add pagination to products/sales/customers lists.
- **Dependencies:** T3.2
- **Priority:** P3
- **Files:** `app/pages/sales/[id].vue`, list endpoints/pages
- **Acceptance criteria:** Receipts print correctly; lists page efficiently on large data.
- **Tests:** manual browser check; pagination tests.

### T4.3 — Complete security regression suite
- **Area:** Testing
- **Status:** Not implemented
- **Missing work:** Automated tests for 401 (no session), 403 (ABAC deny), 403 (CSRF mismatch), cross-branch denial, session expiry, and the Phase 1/2 fixes.
- **Dependencies:** T0.2, all Phase 1–2 fixes
- **Priority:** P1
- **Files:** `tests/security/*.spec.ts`
- **Acceptance criteria:** Suite fails if any of the fixed vulnerabilities regress.
- **Tests:** itself.

### T4.4 — Migration tracking & schema hardening
- **Area:** Database
- **Status:** Partial / technical debt
- **Missing work:** Introduce a migration tracking table, apply ordered migration files, add FKs for `users.branch_id`/`department_id` (or a departments table), add indexes on `sales(created_at)`/`payments(created_at)`, use DB defaults for timestamps; reconcile `products.stock` with `stock_movements`.
- **Dependencies:** T0.1
- **Priority:** P3
- **Files:** `server/database/migrate.ts`, new migration files, `schema.ts`
- **Acceptance criteria:** New migrations apply in order and are tracked; integrity/performance gaps addressed.
- **Tests:** migration tests on a fresh and existing DB.

---

## Preservation notes

- Do not rewrite the ABAC engine or the payment/report helpers; they are unit-tested and correct.
- Preserve `stock_movements` and `audit_logs` writes when changing sale/inventory flows.
- The `user.branchId ?? 'branch-main'` default is load-bearing; changing it (T2.2) must be deliberate and tested because it alters live authorization.
