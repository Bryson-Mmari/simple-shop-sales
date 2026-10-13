import { randomUUID } from 'node:crypto'
import { db } from './index'
import { abacPolicies, branches, products, users } from './schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../auth'

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

  const userCount = db.select().from(users).all().length
  if (userCount === 0 && process.env.NUXT_BOOTSTRAP_EMAIL && process.env.NUXT_BOOTSTRAP_PASSWORD) {
    const passwordHash = await hashPassword(process.env.NUXT_BOOTSTRAP_PASSWORD)
    db.insert(users).values({
      id: randomUUID(),
      email: process.env.NUXT_BOOTSTRAP_EMAIL,
      passwordHash,
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
