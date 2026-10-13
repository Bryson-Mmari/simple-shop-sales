# ABAC Authorization

> Describes the authorization model **as implemented**. §10 lists every deviation from a strict pure-ABAC design.

## 1. Model overview

Authorization is decided by a central policy engine (`server/abac/index.ts`), not by role checks. A decision is made from four attribute bags:

| Bag | Meaning | Provided by |
| --- | --- | --- |
| `subject` | The acting user's attributes | `buildSubjectFromUser(user)` (`server/auth/index.ts:113`) |
| `resource` | The record/object being accessed | Route handler (per action) |
| `action` | The requested operation string | Route handler |
| `environment` | Contextual attributes | `authorizeAction` (`currentTime`) + caller |

## 2. Attribute sources and trust boundaries

### Subject attributes (server-controlled, trusted)

Built only from the authenticated `users` row:

| Attribute | Source column | Notes |
| --- | --- | --- |
| `userId` | `users.id` | |
| `accountStatus` | `users.account_status` | Gate for almost all default policies |
| `departmentId` | `users.department_id` | Used by the field-level test only |
| `authorizedBranchIds` | derived from `users.branch_id` | Array (`[branchId]`) or `[]` |
| `clearanceLevel` | `users.clearance_level` | Acts as the de-facto privilege rank in seeded policies |
| `discountLimit` | `users.discount_limit` | Semantics ambiguous (see §10) |
| `branchId` | `users.branch_id` | |
| `email` | `users.email` | |

The subject is never taken from request input — it is always derived from the server-side session, so it cannot be spoofed by the client.

### Resource attributes (server-controlled, trusted)

Computed per route from DB reads, e.g. `resource.branchId` (from the product/sale row), `resource.currentStock`, `resource.stockDelta`, `resource.total`, `resource.paid`, `resource.balance`, `resource.paymentAmount`, `resource.type`, `resource.id`. Not client-supplied directly, though some originate from validated request fields (e.g. `stockDelta`).

### Action attributes (server-controlled)

A string from the fixed `SupportedAction` union (`server/abac/index.ts:2-18`):

`product.create`, `product.read`, `product.update`, `product.archive`, `inventory.adjust`, `customer.read`, `sale.create`, `sale.read`, `sale.update`, `sale.void`, `sale.discount`, `payment.record`, `report.read`, `report.export`, `user.update_attributes`, `policy.manage`.

### Environment attributes (partially trusted)

`authorizeAction` always injects `currentTime` (server clock). Callers may add fields; none currently pass client data. Time is therefore server-controlled.

### Trust boundary summary

- **Trusted:** session → subject; DB rows → resource; server code → action/environment.
- **Untrusted (validated):** request bodies/queries via Zod before use. Note that some resource attributes (e.g. `saleDiscount`, `stockDelta`, `paymentAmount`) originate from request input and are validated for type/range but are still user-influenced.

## 3. Policy format and storage

Policies live in `abac_policies`:

| DB column | Policy field |
| --- | --- |
| `id` | `id` |
| `name` | `name` |
| `effect` | `effect` (`Permit`/`Deny`) |
| `target_action` | `target.action` |
| `condition_json` | `condition` (JSON tree) |
| `active` | (not represented in `PolicyDefinition`) |
| `created_by` / `created_at` | metadata |

Condition grammar (`Condition`, `server/abac/index.ts:31-39`):

```jsonc
// leaf
{ "field": "subject.clearanceLevel", "op": "gte", "value": 3 }
// groups
{ "and": [ ... ] } | { "or": [ ... ] } | { "not": { ... } }
```

Field paths are dotted (`subject.*`, `resource.*`, `environment.*`) and resolved by `getFieldValue`. Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `exists`. `createPolicy` rejects unknown actions and unknown operators; `validateCondition` recursively checks leaves.

`getPolicyList()` (`server/utils/abac.ts:7`) loads all policies, parses `condition_json`, and coerces null `target_action` to `product.read`.

## 4. Evaluation and combining algorithm

`AbacPolicyEngine.decide` (`server/abac/index.ts:234-296`):

1. **Filter** policies to those whose `target.action` is empty or equals the requested action.
2. **Scan permits**: first permit whose condition evaluates true (or has no condition) wins.
3. **Scan denies**: first deny whose condition evaluates true wins.
4. **Combine**:
   - if a deny matched → **Deny** (explicit deny overrides permit).
   - else if a permit matched → **Permit**.
   - else → **Deny** (default deny / fail closed).

Missing attributes evaluate to `undefined`; for comparison operators a missing left value yields `false`, `exists` supports presence checks. This is a first-match, deny-overrides algorithm (not deny-overrides-if-no-permit — deny always wins).

## 5. Permit / Deny / default-deny behavior

- **Permit**: action allowed; `authorizeAction` returns the decision.
- **Deny**: `authorizeAction` throws `createError(403, "Access denied for action: <action>")`.
- **Default deny**: no matching permit ⇒ deny. Verified by `tests/abac.spec.ts` ("fails closed when no applicable policy permits").
- **Explicit-deny precedence**: verified by `tests/abac.spec.ts` ("explicit deny overrides a permit").

## 6. Server-side enforcement points

`authorizeAction` is invoked in these handlers:

| Route | Action |
| --- | --- |
| `products.get.ts` | `product.read` |
| `products.post.ts` | `product.create` |
| `inventory.get.ts` | `product.read` |
| `inventory/adjust.post.ts` | `inventory.adjust` |
| `customers.get.ts` | `customer.read` |
| `customers.post.ts` | `customer.read` **(deviation)** |
| `sales.get.ts` | `sale.read` per row |
| `sales.post.ts` | `sale.create` |
| `sales/[id].get.ts` | `sale.read` |
| `sales/[id]/payments.post.ts` | `payment.record` |
| `reports/sales.get.ts` | `report.read` |
| `policies.get.ts` / `policies.post.ts` | `policy.manage` |

**Not enforced:** `dashboard.get.ts` (only `requireAuth`). `me.get.ts`, `csrf.get.ts`, `auth/login`, `auth/logout` do not use ABAC (identity/session operations).

Authentication (`requireAuth`) is enforced on every route except `login`, `csrf`, and the two auth endpoints.

## 7. Record-level and field-level restrictions

**Record-level (implemented):**
- Branch scoping: most routes compute `branchId = user.branchId ?? 'branch-main'` and filter queries, and/or pass `resource.branchId` into a policy that requires `resource.branchId` to be in `subject.authorizedBranchIds` (seeded `sale.read` policy).
- `sales.get.ts` evaluates `sale.read` per row and silently drops rows that fail, so a user only lists sales they may read.
- Inventory/sale/product reads are scoped to the caller's branch by `WHERE branch_id = ?`.

**Record-level (missing/broken):**
- `dashboard.get.ts` applies **no** branch filter and no ABAC — global data across branches.
- `customers.get.ts` returns **all** customers (customers have no branch column).

**Field-level (not implemented in enforcement):**
- The engine can express field-level denies and there is a unit test for it (`tests/abac.spec.ts` "blocks field-level exposure..."), but no route filters fields. `products.get.ts` returns full rows (including `costPrice`) to anyone with `product.read`; the seeded `product.read` policy checks only `accountStatus`.

## 8. Policy administration and audit logging

- **List**: `GET /api/policies` (requires `policy.manage`).
- **Create**: `POST /api/policies` (requires `policy.manage` + CSRF); validates via `createPolicy`; stores condition JSON.
- **UI**: `app/pages/policies.vue` lists policies and can create one, but the condition input is a fixed default (`{field:'subject.accountStatus',op:'eq',value:'active'}`) and is not editable.
- **Not supported**: update, deactivate (`active` is ignored — see §10.5), delete, or version history.
- **Audit logging**: policy create/deny decisions are **not** written to `audit_logs`. Only `inventory.adjust` and `payment.record` write audit rows. Authorization denials are not logged.

## 9. Existing authorization tests

`tests/abac.spec.ts` (engine-level, all passing):
- permit for valid active seller / authorized branch
- deny cross-branch when unauthorized
- explicit deny overrides permit
- fail-closed with no policies
- rejects unsupported operators
- nested `and`/`or` evaluation
- discount-threshold policy using subject attribute
- field-level deny decision
- rejects invalid action identifiers
- seeds default product/customer permissions

**Missing test coverage:** no HTTP-level tests that a denied user receives 403, no tests for dashboard bypass, no tests that `customers.post` is gated by the wrong action, no tests for `active` filtering, no integration tests combining session + policy + DB.

## 10. Deviations from pure ABAC

1. **Dashboard bypasses the engine entirely** (`dashboard.get.ts`). Global, unscoped data is returned to any authenticated user. This is the most severe deviation.
2. **`customers.post` is authorized as `customer.read`.** There is no `customer.create` action, so the write is gated by a read decision; the action space does not model customer mutations.
3. **Discount authorization is hard-coded, not policy-driven.** `sales.post.ts:36-38` compares `discount > user.discountLimit` directly. The `sale.discount` action exists and is tested in isolation but is never invoked by any route. (The comparison still uses a subject attribute, but the decision does not flow through a policy.)
4. **Field-level policy is not enforced** — only the engine and its unit test support it.
5. **`active` is ignored.** `getPolicyList` returns inactive policies and the engine ignores the flag, so policy deactivation has no effect.
6. **Null action coerces to `product.read`** (`server/utils/abac.ts:15`), which can broaden an un-targeted policy to product reads.
7. **Unassigned-branch users default to `branch-main`** rather than being denied, weakening branch scoping as an authorization attribute.
8. **Some defined actions are unreachable**: `product.update`, `product.archive`, `sale.update`, `sale.void`, `sale.discount`, `report.export`, `user.update_attributes` have no enforcement points.

These deviations mean the system is **ABAC-based but not yet pure ABAC**: the engine and subject/resource model are genuine, but enforcement coverage and policy-driven decisions are incomplete.
