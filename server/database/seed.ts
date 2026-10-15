import { randomUUID } from 'node:crypto'
import { db } from './index.ts'
import { abacPolicies, branches, products, users } from './schema.ts'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../auth/index.ts'

export async function seedPrimaryData() {
  const branchCount = db.select().from(branches).all().length
  if (branchCount === 0) {
    db.insert(branches).values({
      id: 'branch-main',
      name: 'Main Branch',
      code: 'MAIN',
      isActive: true,
      createdAt: new Date().toISOString(),
    }).run()
  }

  // Admin user from environment variables or fallback
  let adminEmail = 'admin@example.com'
  let adminPassword = 'adminpassword'
  if (process.env.NUXT_BOOTSTRAP_EMAIL && process.env.NUXT_BOOTSTRAP_PASSWORD) {
    adminEmail = process.env.NUXT_BOOTSTRAP_EMAIL
    adminPassword = process.env.NUXT_BOOTSTRAP_PASSWORD
  }
  const adminExisting = db.select().from(users).where(eq(users.email, adminEmail)).get()
  if (!adminExisting) {
    const adminPasswordHash = await hashPassword(adminPassword)
    db.insert(users).values({
      id: randomUUID(),
      email: adminEmail,
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      accountStatus: 'active',
      departmentId: 'management',
      clearanceLevel: 5,
      discountLimit: 30,
      branchId: 'branch-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run()
  }

  // Regular user with clearance level 2
  const user2Email = 'user2@example.com'
  const user2Existing = db.select().from(users).where(eq(users.email, user2Email)).get()
  if (!user2Existing) {
    const user2PasswordHash = await hashPassword('User2Pass123!')
    db.insert(users).values({
      id: randomUUID(),
      email: user2Email,
      passwordHash: user2PasswordHash,
      firstName: 'User',
      lastName: 'Two',
      accountStatus: 'active',
      departmentId: 'sales',
      clearanceLevel: 2,
      discountLimit: 10,
      branchId: 'branch-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run()
  }

  // Manager user with clearance level 4
  const user3Email = 'user3@example.com'
  const user3Existing = db.select().from(users).where(eq(users.email, user3Email)).get()
  if (!user3Existing) {
    const user3PasswordHash = await hashPassword('User3Pass123!')
    db.insert(users).values({
      id: randomUUID(),
      email: user3Email,
      passwordHash: user3PasswordHash,
      firstName: 'User',
      lastName: 'Three',
      accountStatus: 'active',
      departmentId: 'management',
      clearanceLevel: 4,
      discountLimit: 20,
      branchId: 'branch-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run()
  }

  const policyCount = db.select().from(abacPolicies).all().length
  if (policyCount === 0) {
    db.insert(abacPolicies).values([
      {
        id: 'policy-default-sale-read',
        name: 'default sale read',
        effect: 'Permit' as const,
        targetAction: 'sale.read',
        conditionJson: JSON.stringify({
          and: [
            { field: 'subject.accountStatus', op: 'eq', value: 'active' },
            { field: 'subject.authorizedBranchIds', op: 'contains', value: 'branch-main' },
            { field: 'resource.branchId', op: 'eq', value: 'branch-main' },
          ],
        }),
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'policy-default-product-read',
        name: 'default product read',
        effect: 'Permit' as const,
        targetAction: 'product.read',
        conditionJson: JSON.stringify({
          field: 'subject.accountStatus',
          op: 'eq',
          value: 'active',
        }),
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'policy-default-product-create',
        name: 'default product creation',
        effect: 'Permit' as const,
        targetAction: 'product.create',
        conditionJson: JSON.stringify({
          and: [
            { field: 'subject.accountStatus', op: 'eq', value: 'active' },
            { field: 'subject.clearanceLevel', op: 'gte', value: 3 },
          ],
        }),
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'policy-default-customer-read',
        name: 'default customer access',
        effect: 'Permit' as const,
        targetAction: 'customer.read',
        conditionJson: JSON.stringify({
          and: [
            { field: 'subject.accountStatus', op: 'eq', value: 'active' },
            { field: 'subject.clearanceLevel', op: 'gte', value: 3 },
          ],
        }),
        active: true,
        createdAt: new Date().toISOString(),
      },
    ]).run()
  }

  const operationalPolicies = [
    {
      id: 'policy-default-product-create',
      name: 'default product creation',
      targetAction: 'product.create',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 3 },
        ],
      },
    },
    {
      id: 'policy-default-customer-read',
      name: 'default customer access',
      targetAction: 'customer.read',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 3 },
        ],
      },
    },
    {
      id: 'policy-default-inventory-adjust',
      name: 'default inventory adjustment',
      targetAction: 'inventory.adjust',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 4 },
        ],
      },
    },
    {
      id: 'policy-default-policy-manage',
      name: 'default policy management',
      targetAction: 'policy.manage',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 5 },
        ],
      },
    },
    {
      id: 'policy-default-sale-create',
      name: 'default sale creation',
      targetAction: 'sale.create',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 4 },
        ],
      },
    },
    {
      id: 'policy-default-payment-record',
      name: 'default payment recording',
      targetAction: 'payment.record',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 4 },
        ],
      },
    },
    {
      id: 'policy-default-report-read',
      name: 'default report access',
      targetAction: 'report.read',
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.clearanceLevel', op: 'gte', value: 4 },
        ],
      },
    },
  ]

  for (const policy of operationalPolicies) {
    const existingPolicy = db.select().from(abacPolicies).where(eq(abacPolicies.id, policy.id)).get()
    if (!existingPolicy) {
      db.insert(abacPolicies).values({
        id: policy.id,
        name: policy.name,
        effect: 'Permit',
        targetAction: policy.targetAction,
        conditionJson: JSON.stringify(policy.condition),
        active: true,
        createdAt: new Date().toISOString(),
      }).run()
    }
  }
}

if (import.meta.main) {
  seedPrimaryData().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
