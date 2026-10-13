import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../database'
import { auditLogs, products, stockMovements } from '../../database/schema'
import { requireAuth, validateCsrf } from '../../auth'
import { authorizeAction } from '../../utils/abac'

const adjustmentSchema = z.object({
  productId: z.string().min(1),
  delta: z.number().int().safe().refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(240),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  validateCsrf(event)

  const payload = adjustmentSchema.parse(await readBody(event))
  const branchId = user.branchId ?? 'branch-main'
  const product = db.select().from(products).where(eq(products.id, payload.productId)).get()

  if (!product || product.branchId !== branchId) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
  }

  authorizeAction({
    user,
    action: 'inventory.adjust',
    resource: {
      id: product.id,
      type: 'product',
      branchId,
      currentStock: product.stock,
      stockDelta: payload.delta,
    },
  })

  const timestamp = new Date().toISOString()
  const movementId = randomUUID()
  const auditId = randomUUID()

  const updatedStock = db.transaction(() => {
    const currentProduct = db.select().from(products).where(eq(products.id, product.id)).get()
    if (!currentProduct || currentProduct.branchId !== branchId) {
      throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
    }

    const nextStock = currentProduct.stock + payload.delta
    if (!Number.isSafeInteger(nextStock) || nextStock < 0) {
      throw createError({ statusCode: 409, statusMessage: 'Adjustment would result in invalid stock.' })
    }

    db.update(products)
      .set({ stock: nextStock, updatedAt: timestamp })
      .where(and(eq(products.id, currentProduct.id), eq(products.stock, currentProduct.stock)))
      .run()

    db.insert(stockMovements).values({
      id: movementId,
      productId: currentProduct.id,
      branchId,
      delta: payload.delta,
      reason: payload.reason,
      createdBy: user.id,
      createdAt: timestamp,
    }).run()

    db.insert(auditLogs).values({
      id: auditId,
      actorId: user.id,
      action: 'inventory.adjust',
      resourceType: 'product',
      resourceId: currentProduct.id,
      details: JSON.stringify({ delta: payload.delta, reason: payload.reason }),
      ipAddress: event.node.req.socket.remoteAddress ?? null,
      createdAt: timestamp,
    }).run()

    return nextStock
  })

  return { ok: true, productId: product.id, stock: updatedStock, movementId }
})