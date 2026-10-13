import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '../database'
import { products, stockMovements } from '../database/schema'
import { requireAuth, validateCsrf } from '../auth'
import { authorizeAction } from '../utils/abac'

const productSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  minStock: z.number().int().nonnegative(),
  status: z.enum(['active', 'archived']).default('active'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  validateCsrf(event)
  authorizeAction({ user, action: 'product.create', resource: { branchId: user.branchId ?? 'branch-main' } })

  const body = await readBody(event)
  const payload = productSchema.parse(body)

  const id = randomUUID()
  db.transaction(() => {
    db.insert(products).values({
      id,
      code: payload.code,
      name: payload.name,
      description: payload.description ?? '',
      categoryId: payload.categoryId ?? null,
      costPrice: payload.costPrice,
      sellingPrice: payload.sellingPrice,
      stock: payload.stock,
      minStock: payload.minStock,
      status: payload.status,
      branchId: user.branchId ?? 'branch-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run()

    if (payload.stock > 0) {
      db.insert(stockMovements).values({
        id: randomUUID(),
        productId: id,
        branchId: user.branchId ?? 'branch-main',
        delta: payload.stock,
        reason: 'Initial stock',
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      }).run()
    }
  })

  return { ok: true, item: { id, ...payload, branchId: user.branchId ?? 'branch-main' } }
})
