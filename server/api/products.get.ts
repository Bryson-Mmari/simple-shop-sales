import { eq } from 'drizzle-orm'
import { db } from '../database'
import { products } from '../database/schema'
import { requireAuth } from '../auth'
import { authorizeAction } from '../utils/abac'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const branchId = user.branchId ?? 'branch-main'
  authorizeAction({
    user,
    action: 'product.read',
    resource: { branchId },
  })

  const query = getQuery(event)
  const search = String(query.search ?? '').trim().toLowerCase()
  const rows = db.select().from(products).where(eq(products.branchId, branchId)).all()

  const filtered = rows.filter((product) => {
    if (!search) return true
    return product.name.toLowerCase().includes(search) || product.code.toLowerCase().includes(search)
  })

  return {
    ok: true,
    items: filtered,
    total: filtered.length,
  }
})
