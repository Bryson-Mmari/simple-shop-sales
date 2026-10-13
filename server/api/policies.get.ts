import { db } from '../database'
import { abacPolicies } from '../database/schema'
import { requireAuth } from '../auth'
import { authorizeAction } from '../utils/abac'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  authorizeAction({ user, action: 'policy.manage', resource: { branchId: user.branchId ?? 'branch-main' } })

  const items = db.select().from(abacPolicies).all()
  return { ok: true, items: items.map((p) => ({ ...p, condition: JSON.parse(p.conditionJson || '{}') })) }
})
