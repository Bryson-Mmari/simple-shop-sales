import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '../database'
import { abacPolicies } from '../database/schema'
import { requireAuth, validateCsrf } from '../auth'
import { authorizeAction } from '../utils/abac'
import { createPolicy } from '../abac'

const policySchema = z.object({
  name: z.string().min(3),
  effect: z.enum(['Permit', 'Deny']),
  targetAction: z.string().min(2),
  condition: z.any(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  validateCsrf(event)
  authorizeAction({ user, action: 'policy.manage', resource: { branchId: user.branchId ?? 'branch-main' } })

  const payload = policySchema.parse(await readBody(event))
  const policy = createPolicy({
    id: randomUUID(),
    name: payload.name,
    effect: payload.effect,
    target: { action: payload.targetAction },
    condition: payload.condition,
    createdBy: user.id,
  })

  db.insert(abacPolicies).values({
    id: policy.id,
    name: policy.name,
    effect: policy.effect,
    targetAction: payload.targetAction,
    conditionJson: JSON.stringify(policy.condition ?? {}),
    active: true,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
  }).run()

  return { ok: true, policy }
})
