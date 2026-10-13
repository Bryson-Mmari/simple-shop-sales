import { desc, eq } from 'drizzle-orm'
import { db } from '../database'
import { products, stockMovements } from '../database/schema'
import { requireAuth } from '../auth'
import { authorizeAction } from '../utils/abac'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const branchId = user.branchId ?? 'branch-main'

  authorizeAction({
    user,
    action: 'product.read',
    resource: { type: 'inventory', branchId },
  })

  const movements = db.select({
    id: stockMovements.id,
    productId: stockMovements.productId,
    productCode: products.code,
    productName: products.name,
    delta: stockMovements.delta,
    reason: stockMovements.reason,
    createdAt: stockMovements.createdAt,
  })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .where(eq(stockMovements.branchId, branchId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(100)
    .all()

  return { ok: true, items: movements }
})