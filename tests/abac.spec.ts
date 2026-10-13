import { describe, expect, it } from 'vitest'
import {
  AbacPolicyEngine,
  createPolicy,
  evaluateCondition,
  type Condition,
  type PolicyDefinition,
} from '../server/abac'
import { db } from '../server/database'
import { abacPolicies } from '../server/database/schema'
import { seedPrimaryData } from '../server/database/seed'

describe('ABAC policy engine', () => {
  it('permits a valid active seller for an authorized branch', () => {
    const engine = new AbacPolicyEngine()
    const policy = createPolicy({
      id: 'p1',
      name: 'sales-create',
      effect: 'Permit',
      target: {
        action: 'sale.create',
      },
      condition: {
        and: [
          { field: 'subject.accountStatus', op: 'eq', value: 'active' },
          { field: 'subject.authorizedBranchIds', op: 'contains', value: 'branch-1' },
        ],
      },
    })

    const decision = engine.decide({
      subject: {
        userId: 'u1',
        accountStatus: 'active',
        authorizedBranchIds: ['branch-1'],
      },
      resource: { branchId: 'branch-1' },
      action: 'sale.create',
      environment: { currentTime: '2026-10-12T10:00:00.000Z' },
      policies: [policy],
    })

    expect(decision.effect).toBe('Permit')
  })

  it('denies cross-branch access when branch is not authorized', () => {
    const engine = new AbacPolicyEngine()
    const policy = createPolicy({
      id: 'p2',
      name: 'branch-scope',
      effect: 'Permit',
      target: {
        action: 'sale.read',
      },
      condition: {
        and: [
          { field: 'subject.authorizedBranchIds', op: 'contains', value: 'branch-1' },
          { field: 'resource.branchId', op: 'eq', value: 'branch-1' },
        ],
      },
    })

    const decision = engine.decide({
      subject: {
        userId: 'u2',
        authorizedBranchIds: ['branch-1'],
      },
      resource: { branchId: 'branch-2' },
      action: 'sale.read',
      environment: { currentTime: '2026-10-12T10:00:00.000Z' },
      policies: [policy],
    })

    expect(decision.effect).toBe('Deny')
  })

  it('explicit deny overrides a permit', () => {
    const engine = new AbacPolicyEngine()
    const denyPolicy = createPolicy({
      id: 'deny1',
      name: 'deny-branch',
      effect: 'Deny',
      target: { action: 'sale.read' },
      condition: { field: 'resource.branchId', op: 'eq', value: 'branch-999' },
    })
    const permitPolicy = createPolicy({
      id: 'permit1',
      name: 'permit-branch',
      effect: 'Permit',
      target: { action: 'sale.read' },
      condition: { field: 'resource.branchId', op: 'eq', value: 'branch-1' },
    })

    const decision = engine.decide({
      subject: { userId: 'u3' },
      resource: { branchId: 'branch-999' },
      action: 'sale.read',
      environment: { currentTime: '2026-10-12T10:00:00.000Z' },
      policies: [denyPolicy, permitPolicy],
    })

    expect(decision.effect).toBe('Deny')
  })

  it('fails closed when no applicable policy permits', () => {
    const engine = new AbacPolicyEngine()
    const decision = engine.decide({
      subject: { userId: 'u4', accountStatus: 'inactive' },
      resource: { branchId: 'branch-1' },
      action: 'sale.create',
      environment: { currentTime: '2026-10-12T10:00:00.000Z' },
      policies: [],
    })

    expect(decision.effect).toBe('Deny')
  })

  it('rejects unsupported policy operators', () => {
    expect(() =>
      createPolicy({
        id: 'bad1',
        name: 'bad-policy',
        effect: 'Permit',
        target: { action: 'product.read' },
        condition: { field: 'subject.userId', op: 'hacked', value: 'x' } as Condition,
      }),
    ).toThrow()
  })

  it('evaluates nested condition groups', () => {
    const condition: Condition = {
      and: [
        { field: 'subject.accountStatus', op: 'eq', value: 'active' },
        {
          or: [
            { field: 'subject.clearanceLevel', op: 'gte', value: 2 },
            { field: 'subject.discountLimit', op: 'gte', value: 25 },
          ],
        },
      ],
    }

    expect(
      evaluateCondition(condition, {
        subject: { accountStatus: 'active', clearanceLevel: 3, discountLimit: 10 },
      }),
    ).toBe(true)
  })

  it('enforces discount threshold policy using the subject attribute', () => {
    const engine = new AbacPolicyEngine()
    const policy = createPolicy({
      id: 'discount-1',
      name: 'discount-limit',
      effect: 'Permit',
      target: { action: 'sale.discount' },
      condition: {
        and: [
          { field: 'subject.discountLimit', op: 'gte', value: 15 },
          { field: 'resource.discountPercent', op: 'lte', value: 15 },
        ],
      },
    })

    const decision = engine.decide({
      subject: { discountLimit: 25 },
      resource: { discountPercent: 10 },
      action: 'sale.discount',
      environment: { currentTime: '2026-10-12T10:00:00.000Z' },
      policies: [policy],
    })

    expect(decision.effect).toBe('Permit')
  })

  it('blocks field-level exposure when field policy denies it', () => {
    const engine = new AbacPolicyEngine()
    const policy = createPolicy({
      id: 'field-1',
      name: 'sensitive-cost-price',
      effect: 'Deny',
      target: { action: 'product.read' },
      condition: { field: 'subject.departmentId', op: 'neq', value: 'finance' },
    })

    const decision = engine.decide({
      subject: { departmentId: 'sales' },
      resource: { costPrice: 2500 },
      action: 'product.read',
      environment: { currentTime: '2026-10-12T10:00:00.000Z' },
      policies: [policy],
    })

    expect(decision.effect).toBe('Deny')
  })
})

describe('Policy storage validation', () => {
  it('validates action identifiers before a policy is saved', () => {
    expect(() =>
      createPolicy({
        id: 'invalid-action',
        name: 'bad-action',
        effect: 'Permit',
        target: { action: 'not-a-real-action' },
        condition: { field: 'subject.userId', op: 'eq', value: 'u1' },
      } as PolicyDefinition),
    ).toThrow()
  })

  it('seeds the default product and customer permissions required for working actions', async () => {
    db.delete(abacPolicies).run()
    process.env.NUXT_BOOTSTRAP_EMAIL = 'admin@example.com'
    process.env.NUXT_BOOTSTRAP_PASSWORD = 'StrongPass123!'

    await seedPrimaryData()

    const actions = db.select().from(abacPolicies).all().map((policy) => policy.targetAction)

    expect(actions).toContain('product.create')
    expect(actions).toContain('customer.read')
  })
})
