import { eq } from 'drizzle-orm'
import { db } from '../database'
import { abacPolicies } from '../database/schema'
import { buildSubjectFromUser } from '../auth'
import { AbacPolicyEngine, createPolicy, type PolicyDefinition } from '../abac'

export function getPolicyList(): PolicyDefinition[] {
  return db.select().from(abacPolicies).all().map((policy) => {
    const parsedCondition = JSON.parse(policy.conditionJson || '{}')
    return createPolicy({
      id: policy.id,
      name: policy.name,
      effect: policy.effect as 'Permit' | 'Deny',
      target: {
        action: policy.targetAction ?? 'product.read',
      },
      condition: parsedCondition,
      createdAt: policy.createdAt,
      createdBy: policy.createdBy,
    })
  })
}

export function authorizeAction({
  user,
  action,
  resource,
  environment,
}: {
  user: any
  action: string
  resource: Record<string, unknown>
  environment?: Record<string, unknown>
}) {
  const engine = new AbacPolicyEngine()
  const subject = buildSubjectFromUser(user)
  const decision = engine.decide({
    subject,
    resource,
    action,
    environment: {
      currentTime: new Date().toISOString(),
      ...(environment ?? {}),
    },
    policies: getPolicyList(),
  })

  if (decision.effect !== 'Permit') {
    throw createError({ statusCode: 403, statusMessage: `Access denied for action: ${action}` })
  }

  return decision
}
