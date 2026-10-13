# Database

> Source of truth: `server/database/schema.ts` (Drizzle definitions) and `server/database/migrations/001_init.sql` (executed SQL). The live database at `.data/simple-shop.sqlite` was inspected read-only and matches this schema.

## 1. Engine and connection

- Engine: SQLite via `better-sqlite3`.
- Location: `NUXT_DATABASE_PATH` env var, default `path.join(process.cwd(), '.data', 'simple-shop.sqlite')` (`server/database/index.ts:6`).
- Pragmas on connect: `foreign_keys = ON`, `journal_mode = WAL` (`server/database/index.ts:10-11`).
- A single module-level connection is exported as `sqlite` and wrapped by Drizzle as `db`.
- Dates/timestamps are stored as ISO-8601 **TEXT**; IDs are TEXT UUIDs; money/quantities are **INTEGER**.

## 2. Tables

### users
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `email` | TEXT | NOT NULL, UNIQUE |
| `password_hash` | TEXT | NOT NULL (Argon2id) |
| `first_name` | TEXT | NOT NULL |
| `last_name` | TEXT | NOT NULL |
| `account_status` | TEXT | NOT NULL, default `active`, CHECK in (`active`,`inactive`,`locked`) |
| `department_id` | TEXT | nullable |
| `clearance_level` | INTEGER | NOT NULL, default 1 |
| `discount_limit` | INTEGER | NOT NULL, default 0 |
| `branch_id` | TEXT | nullable (references branches conceptually; **no FK constraint**) |
| `created_at` | TEXT | NOT NULL, default '' |
| `updated_at` | TEXT | NOT NULL, default '' |

Purpose: authentication identity + ABAC subject attributes (clearance, department, branch, discount limit).

### user_attributes
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `user_id` | TEXT | NOT NULL, FK → users(id) |
| `attribute_key` | TEXT | NOT NULL |
| `attribute_value` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL, default '' |

Purpose: intended flexible per-user ABAC attributes. **Unused by current code.**

### branches
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `code` | TEXT | NOT NULL, UNIQUE |
| `is_active` | INTEGER | NOT NULL, default 1 (boolean mode) |
| `created_at` | TEXT | NOT NULL, default '' |

### categories
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | nullable |
| `created_at` | TEXT | NOT NULL, default '' |

Purpose: product categorization. **No API/UI; not seeded.**

### products
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `code` | TEXT | NOT NULL, UNIQUE |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | nullable |
| `category_id` | TEXT | FK → categories(id) |
| `cost_price` | INTEGER | NOT NULL, default 0 |
| `selling_price` | INTEGER | NOT NULL, default 0 |
| `stock` | INTEGER | NOT NULL, default 0 |
| `min_stock` | INTEGER | NOT NULL, default 0 |
| `status` | TEXT | NOT NULL, default `active`, CHECK in (`active`,`archived`) |
| `branch_id` | TEXT | FK → branches(id) |
| `created_at` | TEXT | NOT NULL, default '' |
| `updated_at` | TEXT | NOT NULL, default '' |

### customers
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `phone` | TEXT | nullable |
| `email` | TEXT | nullable |
| `address` | TEXT | nullable |
| `created_at` | TEXT | NOT NULL, default '' |

Note: customers are **not** branch-scoped, so `customers.get` returns all customers regardless of the caller's branch.

### sales
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `reference` | TEXT | NOT NULL, UNIQUE |
| `customer_id` | TEXT | FK → customers(id) |
| `branch_id` | TEXT | FK → branches(id) |
| `subtotal` | INTEGER | NOT NULL, default 0 |
| `discount` | INTEGER | NOT NULL, default 0 |
| `total` | INTEGER | NOT NULL, default 0 |
| `status` | TEXT | NOT NULL, default `draft`, CHECK in (`draft`,`paid`,`partial`,`voided`) |
| `created_by` | TEXT | FK → users(id) |
| `created_at` | TEXT | NOT NULL, default '' |

### sale_items
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `sale_id` | TEXT | NOT NULL, FK → sales(id) |
| `product_id` | TEXT | NOT NULL, FK → products(id) |
| `quantity` | INTEGER | NOT NULL |
| `unit_price` | INTEGER | NOT NULL (snapshot of selling price) |
| `line_total` | INTEGER | NOT NULL |
| `created_at` | TEXT | NOT NULL, default '' |

### payments
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `sale_id` | TEXT | NOT NULL, FK → sales(id) |
| `amount` | INTEGER | NOT NULL |
| `method` | TEXT | NOT NULL, CHECK in (`cash`,`bank_transfer`,`mobile_money`,`card`) |
| `status` | TEXT | NOT NULL, default `completed`, CHECK in (`pending`,`completed`,`failed`) |
| `recorded_by` | TEXT | FK → users(id) |
| `created_at` | TEXT | NOT NULL, default '' |

### stock_movements
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `product_id` | TEXT | NOT NULL, FK → products(id) |
| `branch_id` | TEXT | FK → branches(id) |
| `delta` | INTEGER | NOT NULL (negative = out) |
| `reason` | TEXT | NOT NULL |
| `created_by` | TEXT | FK → users(id) |
| `created_at` | TEXT | NOT NULL, default '' |

### abac_policies
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `name` | TEXT | NOT NULL |
| `effect` | TEXT | NOT NULL, CHECK in (`Permit`,`Deny`) |
| `target_action` | TEXT | nullable |
| `condition_json` | TEXT | NOT NULL (JSON condition tree) |
| `active` | INTEGER | NOT NULL, default 1 (boolean) |
| `created_by` | TEXT | FK → users(id) |
| `created_at` | TEXT | NOT NULL, default '' |

### sessions
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK — **the raw session token** |
| `user_id` | TEXT | NOT NULL, FK → users(id) |
| `token_hash` | TEXT | NOT NULL, UNIQUE |
| `expires_at` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL, default '' |

### audit_logs
| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | PK |
| `actor_id` | TEXT | FK → users(id) |
| `action` | TEXT | NOT NULL |
| `resource_type` | TEXT | nullable |
| `resource_id` | TEXT | nullable |
| `details` | TEXT | nullable (JSON string) |
| `ip_address` | TEXT | nullable |
| `created_at` | TEXT | NOT NULL, default '' |

### application_settings
| Column | Type | Constraints |
| --- | --- | --- |
| `key` | TEXT | PK |
| `value` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL, default '' |

Purpose: intended key/value config store. **Unused by current code.**

## 3. Indexes

Defined in `001_init.sql:161-165` (all present in the live DB):

- `idx_products_branch` on `products(branch_id)`
- `idx_sales_branch` on `sales(branch_id)`
- `idx_payments_sale` on `payments(sale_id)`
- `idx_stock_movements_product` on `stock_movements(product_id)`
- `idx_abac_policies_target` on `abac_policies(target_action)`

No index exists on `sales(created_at)` or `payments(created_at)`, which are used by the reports range filters.

## 4. Relationships

Foreign keys (enforced because `PRAGMA foreign_keys = ON`):

- `user_attributes.user_id → users.id`
- `products.category_id → categories.id`, `products.branch_id → branches.id`
- `sale_items.sale_id → sales.id`, `sale_items.product_id → products.id`
- `sales.customer_id → customers.id`, `sales.branch_id → branches.id`, `sales.created_by → users.id`
- `payments.sale_id → sales.id`, `payments.recorded_by → users.id`
- `stock_movements.product_id → products.id`, `stock_movements.branch_id → branches.id`, `stock_movements.created_by → users.id`
- `abac_policies.created_by → users.id`
- `sessions.user_id → users.id`
- `audit_logs.actor_id → users.id`

Not enforced by FK: `users.branch_id` and `users.department_id` are plain TEXT (no table reference).

Delete behavior: all FKs use SQLite default `NO ACTION`, so deleting a referenced parent row is blocked while children exist. Combined with the fact that no delete endpoints exist, this is currently moot.

## 5. Migration history and mechanism

- Only one migration exists: `server/database/migrations/001_init.sql`.
- `server/database/migrate.ts:ensureDatabase()` reads that single file and runs it through `sqlite.exec`. Because every statement is `IF NOT EXISTS`, it is idempotent but is executed on **every** startup.
- There is **no** `__drizzle_migrations`/schema-version table. `drizzle-kit generate` (`pnpm db:generate`) writes to `server/database/migrations/` but those generated files are **never read** by `migrate.ts`, which hard-codes `001_init.sql`. New migrations will not be applied automatically.
- Schema drift risk: hand-written `001_init.sql` and `schema.ts` must be kept in sync manually.

## 6. Transaction and stock-management behavior

| Operation | Transaction? | Concurrency guard |
| --- | --- | --- |
| Create product (`products.post.ts`) | yes | none needed (insert + movement) |
| Adjust inventory (`inventory/adjust.post.ts`) | yes | **re-reads product and updates with `WHERE id = ? AND stock = <old>`**, rejects negative/unsafe stock |
| Create sale (`sales.post.ts`) | yes | **none inside the transaction** — stock is read before the transaction and written as `stock = <stale> - qty` with `WHERE id = ?` only |
| Record payment (`payments.post.ts`) | yes | re-reads sale; re-computes paid/balance inside the transaction and rejects overpayment |

Stock effects:
- Product creation records an `Initial stock` movement when `stock > 0`.
- Sale creation writes a negative movement per line and decrements `products.stock`.
- Inventory adjustment writes a signed movement.
- There is **no** recomputation of `products.stock` from `stock_movements`; `products.stock` is the authoritative balance, so the sale race (see below) can desynchronize it from the movement history.

## 7. Schema gaps and integrity risks

1. **Sale stock race** — `sales.post.ts:93-96` does not compare-and-swap, so concurrent sales can corrupt `products.stock` (oversell / lost update). This is the highest data-integrity risk.
2. **`products.stock` vs `stock_movements` divergence** — no reconciliation job or constraint; the two can drift independently of the race above.
3. **Sale status derived, not always stored consistently** — `sales.get`/`sales/[id].get` recompute status from payments rather than trusting `sales.status`; `sales.status` is only updated on payment recording, not on sale creation beyond the initial value. This is workable but means `sales.status` is a cache that some reads ignore.
4. **Money as integer** — no declared currency or minor-unit convention; `discount_limit` unit (absolute vs percent) is ambiguous (see `PROJECT_STATUS.md` §5.8).
5. **`users.branch_id` has no FK** — a user can reference a non-existent branch.
6. **Customers global** — no branch/ownership column, so customer reads cannot be scoped.
7. **No soft-delete** for products/customers; `products.status='archived'` exists but no endpoint sets it.
8. **`sessions` stores raw token as PK and `token_hash` is unused** — DB compromise exposes live sessions.
9. **No audit rows for most mutations** — `audit_logs` only receives `inventory.adjust` and `payment.record`.
10. **Timestamps default to empty string** rather than a DB default; all writers set ISO strings, but a direct insert without `created_at` yields `''`, which sorts before real timestamps and breaks report range filters.
