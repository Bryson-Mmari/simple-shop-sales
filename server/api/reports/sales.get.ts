import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../database'
import { payments, products, saleItems, sales } from '../../database/schema'
import { requireAuth } from '../../auth'
import { authorizeAction } from '../../utils/abac'
import { summarizeSalesReport } from '../../utils/sales-report'

const reportQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})

function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString()
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = reportQuerySchema.parse(getQuery(event))
  const today = new Date().toISOString().slice(0, 10)
  const from = query.from ?? `${today.slice(0, 7)}-01`
  const to = query.to ?? today

  if (from > to) {
    throw createError({ statusCode: 400, statusMessage: 'Start date must be on or before end date.' })
  }

  const branchId = user.branchId ?? 'branch-main'
  const startAt = new Date(`${from}T00:00:00.000Z`).toISOString()
  const endBefore = nextDay(to)

  authorizeAction({
    user,
    action: 'report.read',
    resource: { type: 'sales-report', branchId, from, to },
  })

  const reportSales = db.select({
    id: sales.id,
    total: sales.total,
    discount: sales.discount,
    status: sales.status,
    createdAt: sales.createdAt,
  })
    .from(sales)
    .where(and(
      eq(sales.branchId, branchId),
      gte(sales.createdAt, startAt),
      lt(sales.createdAt, endBefore),
    ))
    .all()

  const reportPayments = db.select({
    saleId: payments.saleId,
    amount: payments.amount,
    method: payments.method,
  })
    .from(payments)
    .innerJoin(sales, eq(payments.saleId, sales.id))
    .where(and(
      eq(sales.branchId, branchId),
      eq(payments.status, 'completed'),
      gte(payments.createdAt, startAt),
      lt(payments.createdAt, endBefore),
    ))
    .all()

  const saleIds = reportSales.map((sale) => sale.id)
  const allPayments = saleIds.length
    ? db.select({ saleId: payments.saleId, amount: payments.amount, method: payments.method })
      .from(payments)
      .where(and(inArray(payments.saleId, saleIds), eq(payments.status, 'completed')))
      .all()
    : []
  const reportItems = saleIds.length
    ? db.select({
      saleId: saleItems.saleId,
      productId: products.id,
      productName: products.name,
      quantity: saleItems.quantity,
      lineTotal: saleItems.lineTotal,
    })
      .from(saleItems)
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(inArray(saleItems.saleId, saleIds))
      .all()
    : []

  return {
    ok: true,
    from,
    to,
    summary: summarizeSalesReport({
      sales: reportSales,
      payments: reportPayments,
      allPayments,
      items: reportItems,
    }),
  }
})