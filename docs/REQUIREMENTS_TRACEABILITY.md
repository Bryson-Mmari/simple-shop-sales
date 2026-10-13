# Requirements Traceability Matrix

Status values: **Complete & verified** · **Implemented, unverified** · **Partial** · **Not implemented** · **Broken** · **Blocked**

| ID | Requirement | Status | Evidence | Remaining work | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| R1 | Nuxt 4 + TypeScript | Complete & verified | `nuxt` ^4.6, `app/` + `server/` TS; `pnpm typecheck` exit 0; `pnpm build` exit 0 | None | Typecheck + build pass without errors |
| R2 | Bootstrap 5 | Complete & verified | `bootstrap` ^5.3.8 imported in `app/assets/css/main.css:1`; responsive grid on all pages; build passes | None | UI renders Bootstrap components at mobile/desktop widths |
| R3 | SQLite persistence | Complete & verified | `better-sqlite3`, `server/database/index.ts`; live DB inspected (14 tables, FK on, WAL) | Add migration tracking (technical) | CRUD persists across restarts |
| R4 | Secure authentication | **Partial** | Argon2id (`auth/index.ts:11`), HTTP-only cookie, active-status gate (`login.post.ts:22`) | Fix plaintext session token (#C1); add throttling; log auth events | Session cannot be replayed from DB dump; brute force mitigated |
| R5 | Secure session management | **Partial** | 8h expiry, server-side session table, `requireAuth` on all protected routes | Verify `token_hash` or drop it; add rotation; CSRF on logout | Cookie theft/DB leak cannot trivially impersonate |
| R6 | Pure ABAC authorization | **Partial** | Engine `server/abac/index.ts`; tests pass; enforcement on most routes | Fix dashboard bypass, customer action, discount policy, `active` flag, null action, branch default | Every protected op passes through a policy decision; no bypasses |
| R7 | Products (CRUD) | **Partial** | Create/list: `products.get.ts`, `products.post.ts`, `app/pages/products.vue` | Implement update + archive endpoints/UI; add `categoryId` support | Create/read/update/archive all work and are audited |
| R8 | Categories | **Not implemented** | Table exists (`schema.ts:34`); no API/UI/seed | CRUD API, UI, relation on products | Category manage + assign to products |
| R9 | Inventory & stock movements | Complete & verified (logic) | `inventory/adjust.post.ts` (optimistic guard + audit), `inventory.get.ts`; movement history UI | Add HTTP/integration tests; reconciliation | Adjustments atomic, non-negative, audited |
| R10 | Customers | **Partial** | Create/list: `customers.get.ts`, `customers.post.ts`; creation uses wrong action | Correct action + add update/delete; consider branch scope | Customer CRUD correctly authorized |
| R11 | Sales & sale items | **Partial** | `sales.post.ts`, `sales.get.ts`, `sales/[id].get.ts`; unit tests for schema | Fix concurrency (#C2); add void/update; audit creation | Concurrent sales never corrupt stock; sale lifecycle complete |
| R12 | Payments & outstanding balances | Implemented, unverified | `sales/[id]/payments.post.ts`; `sales-payment.ts` unit-tested | Add route/integration tests | Partial/full payments update balance/status atomically |
| R13 | Printable receipts | Implemented, unverified | `app/pages/sales/[id].vue` `@media print`; "Print receipt" button | Manual/browser verification; test data | Receipt prints cleanly without nav chrome |
| R14 | Dashboard | **Partial** | `dashboard.get.ts`, `app/pages/index.vue` | Add branch scoping + ABAC action | Dashboard shows only caller-authorized scope |
| R15 | Reports | Implemented, unverified | `reports/sales.get.ts`, `utils/sales-report.ts` (unit-tested), `app/pages/reports.vue` | Route/integration tests; `report.export` | Collections/daily/top-products accurate and branch-scoped |
| R16 | User attributes | **Not implemented** | `user_attributes` table unused; no user CRUD | User/attribute admin API+UI; merge into subject | Attributes manageable and honored by policies |
| R17 | ABAC policy management | **Partial** | `policies.get.ts`, `policies.post.ts`, `app/pages/policies.vue` | Editable conditions; update/deactivate/delete; honor `active` | Full policy lifecycle with validation |
| R18 | Audit logs | **Partial** | `audit_logs`; only inventory + payment write rows | Audit all mutations + auth + denials; add viewer | Every sensitive action produces an immutable log |
| R19 | Automated business-logic tests | **Partial** | `tests/sales-payment.spec.ts`, `tests/sales-report.spec.ts` | Cover sale creation, payment route, stock logic | Business rules covered by unit tests |
| R20 | Automated integration tests | **Not implemented** | None | Add HTTP-level tests (Nuxt/Nitro test utils or server harness) | End-to-end route tests pass |
| R21 | Automated security tests | **Not implemented** | None | Auth 401, ABAC 403, CSRF 403, cross-branch denial tests | Security regression suite passes |

## Cross-reference to roadmap

- R4/R5 ← Phase 1 (P1.1, P1.2)
- R6/R10/R14 ← Phase 1–2 (P1.3, P1.4, P2.1)
- R11 ← Phase 1 (P1.5)
- R1–R3, R9, R12, R15, R19 baseline preserved
- R7/R8/R16/R17/R18/R21 ← Phases 3–5 in `IMPLEMENTATION_ROADMAP.md`
