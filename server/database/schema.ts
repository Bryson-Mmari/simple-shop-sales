import { sqliteTable, text, integer, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  accountStatus: text('account_status', { enum: ['active', 'inactive', 'locked'] }).notNull().default('active'),
  departmentId: text('department_id'),
  clearanceLevel: integer('clearance_level').notNull().default(1),
  discountLimit: integer('discount_limit').notNull().default(0),
  branchId: text('branch_id'),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
})

export const userAttributes = sqliteTable('user_attributes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  attributeKey: text('attribute_key').notNull(),
  attributeValue: text('attribute_value').notNull(),
  createdAt: text('created_at').notNull().default(''),
})

export const branches = sqliteTable('branches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(''),
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default(''),
})

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: text('category_id').references(() => categories.id),
  costPrice: integer('cost_price').notNull().default(0),
  sellingPrice: integer('selling_price').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  minStock: integer('min_stock').notNull().default(0),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  branchId: text('branch_id').references(() => branches.id),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
})

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  createdAt: text('created_at').notNull().default(''),
})

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  customerId: text('customer_id').references(() => customers.id),
  branchId: text('branch_id').references(() => branches.id),
  subtotal: integer('subtotal').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull().default(0),
  status: text('status', { enum: ['draft', 'paid', 'partial', 'voided'] }).notNull().default('draft'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
})

export const saleItems = sqliteTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id),
  productId: text('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  lineTotal: integer('line_total').notNull(),
  createdAt: text('created_at').notNull().default(''),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => sales.id),
  amount: integer('amount').notNull(),
  method: text('method', { enum: ['cash', 'bank_transfer', 'mobile_money', 'card'] }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('completed'),
  recordedBy: text('recorded_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
})

export const stockMovements = sqliteTable('stock_movements', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  branchId: text('branch_id').references(() => branches.id),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
})

export const abacPolicies = sqliteTable('abac_policies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  effect: text('effect', { enum: ['Permit', 'Deny'] }).notNull(),
  targetAction: text('target_action'),
  conditionJson: text('condition_json').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(''),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(''),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default(''),
})

export const applicationSettings = sqliteTable('application_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull().default(''),
})

export const schema = {
  users,
  userAttributes,
  branches,
  categories,
  products,
  customers,
  sales,
  saleItems,
  payments,
  stockMovements,
  abacPolicies,
  sessions,
  auditLogs,
  applicationSettings,
}
