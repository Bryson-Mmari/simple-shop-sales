import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../database'
import { payments, products, saleItems, sales, stockMovements } from '../database/schema'
import { requireAuth, validateCsrf } from '../auth'
import { authorizeAction } from '../utils/abac'
import { getPaymentBalance, getSalePaymentStatus } from '../utils/sales-payment'

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
})

export const saleSchema = z.object({
  customerId: z.string().nullable().optional(),
  items: z.array(saleItemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'mobile_money', 'card']).default('cash'),
  paymentAmount: z.number().int().safe().nonnegative().default(0),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  validateCsrf(event)
  const body = saleSchema.parse(await readBody(event))
  const branchId = user.branchId ?? 'branch-main'

  const discount = Number(body.discount ?? 0)
  authorizeAction({
    user,
    action: 'sale.create',
    resource: { branchId, saleDiscount: discount },
  })

  if (discount > (user.discountLimit ?? 0)) {
    throw createError({ statusCode: 403, statusMessage: 'Discount exceeds your approved limit.' })
  }

  const saleId = randomUUID()
  const saleRef = `SALE-${Date.now()}`

  const preparedItems: Array<{ product: typeof products.$inferSelect; item: typeof body.items[number]; lineTotal: number }> = []

  for (const item of body.items) {
    const product = db.select().from(products).where(eq(products.id, item.productId)).get() as typeof products.$inferSelect | undefined
    if (!product || product.branchId !== branchId) {
      throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
    }
    if (product.stock < item.quantity) {
      throw createError({ statusCode: 400, statusMessage: `Insufficient stock for ${product.name}.` })
    }

    preparedItems.push({
      product,
      item,
      lineTotal: item.quantity * product.sellingPrice,
    })
  }

  const subtotal = preparedItems.reduce((sum, entry) => sum + entry.lineTotal, 0)
  const total = Math.max(subtotal - discount, 0)
  if (body.paymentAmount > total) {
    throw createError({ statusCode: 400, statusMessage: 'Payment cannot exceed the sale total.' })
  }
  const status = getSalePaymentStatus(total, body.paymentAmount)

  db.transaction(() => {
    db.insert(sales).values({
      id: saleId,
      reference: saleRef,
      customerId: body.customerId ?? null,
      branchId,
      subtotal,
      discount,
      total,
      status,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    }).run()

    preparedItems.forEach((entry) => {
      db.insert(saleItems).values({
        id: randomUUID(),
        saleId,
        productId: entry.product.id,
        quantity: entry.item.quantity,
        unitPrice: entry.product.sellingPrice,
        lineTotal: entry.lineTotal,
        createdAt: new Date().toISOString(),
      }).run()

      db.update(products)
        .set({ stock: entry.product.stock - entry.item.quantity, updatedAt: new Date().toISOString() })
        .where(eq(products.id, entry.product.id))
        .run()

      db.insert(stockMovements).values({
        id: randomUUID(),
        productId: entry.product.id,
        branchId,
        delta: -entry.item.quantity,
        reason: `Sale ${saleRef}`,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      }).run()
    })

    if (body.paymentAmount > 0) {
      db.insert(payments).values({
        id: randomUUID(),
        saleId,
        amount: body.paymentAmount,
        method: body.paymentMethod,
        status: 'completed',
        recordedBy: user.id,
        createdAt: new Date().toISOString(),
      }).run()
    }
  })

  return {
    ok: true,
    sale: {
      id: saleId,
      reference: saleRef,
      subtotal,
      discount,
      total,
      paid: body.paymentAmount,
      balance: getPaymentBalance(total, body.paymentAmount),
      status,
      items: preparedItems.map((entry) => ({
        productId: entry.product.id,
        quantity: entry.item.quantity,
        unitPrice: entry.product.sellingPrice,
        lineTotal: entry.lineTotal,
      })),
    },
  }
})
