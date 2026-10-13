import { and, eq } from 'drizzle-orm'
import { db } from '../../database'
import { customers, payments, products, saleItems, sales } from '../../database/schema'
import { requireAuth } from '../../auth'
import { authorizeAction } from '../../utils/abac'
import { getPaymentBalance, getSalePaymentStatus } from '../../utils/sales-payment'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const saleId = getRouterParam(event, 'id')
  const branchId = user.branchId ?? 'branch-main'
  const sale = saleId ? db.select().from(sales).where(eq(sales.id, saleId)).get() : undefined

  if (!sale || sale.branchId !== branchId) {
    throw createError({ statusCode: 404, statusMessage: 'Sale not found.' })
  }

  authorizeAction({
    user,
    action: 'sale.read',
    resource: {
      id: sale.id,
      type: 'sale',
      branchId: sale.branchId,
      total: sale.total,
      status: sale.status,
      createdBy: sale.createdBy,
    },
  })

  const lineItems = db.select({
    quantity: saleItems.quantity,
    unitPrice: saleItems.unitPrice,
    lineTotal: saleItems.lineTotal,
    productCode: products.code,
    productName: products.name,
  })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, sale.id))
    .all()

  const salePayments = db.select({
    id: payments.id,
    amount: payments.amount,
    method: payments.method,
    createdAt: payments.createdAt,
  })
    .from(payments)
    .where(and(eq(payments.saleId, sale.id), eq(payments.status, 'completed')))
    .all()

  const paid = salePayments.reduce((sum, payment) => sum + payment.amount, 0)
  const customer = sale.customerId
    ? db.select({ name: customers.name }).from(customers).where(eq(customers.id, sale.customerId)).get() ?? null
    : null

  return {
    ok: true,
    sale: {
      id: sale.id,
      reference: sale.reference,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      status: sale.status === 'voided' ? sale.status : getSalePaymentStatus(sale.total, paid),
      paid,
      balance: getPaymentBalance(sale.total, paid),
      customerName: customer?.name ?? null,
      createdAt: sale.createdAt,
      items: lineItems,
      payments: salePayments,
    },
  }
})