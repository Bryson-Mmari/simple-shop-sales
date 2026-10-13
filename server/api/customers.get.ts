import { db } from '../database'
import { customers } from '../database/schema'
import { requireAuth } from '../auth'
import { authorizeAction } from '../utils/abac'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  authorizeAction({ user, action: 'customer.read', resource: { ownerId: user.id, branchId: user.branchId ?? 'branch-main' } })

  const rows = db.select().from(customers).all() as typeof customers.$inferSelect[]
  return { ok: true, items: rows }
})
