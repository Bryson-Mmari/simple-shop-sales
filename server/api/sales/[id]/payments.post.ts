import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../database'
import { auditLogs, payments, sales } from '../../../database/schema'
import { requireAuth, validateCsrf } from '../../../auth'
import { authorizeAction } from '../../../utils/abac'
import { getPaymentBalance, getSalePaymentStatus } from '../../../utils/sales-payment'

const paymentSchema = z.object({
  amount: z.number().int().safe().positive(),
  method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'card']),
})

function getCompletedPaymentTotal(saleId: string) {
  return db.select({ amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.saleId, saleId), eq(payments.status, 'completed')))
    .all()
    .reduce((sum, payment) => sum + payment.amount, 0)
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  validateCsrf(event)

  const saleId = getRouterParam(event, 'id')
  if (!saleId) {
    throw createError({ statusCode: 400, statusMessage: 'Sale ID is required.' })
  }

  const payload = paymentSchema.parse(await readBody(event))
  const branchId = user.branchId ?? 'branch-main'
  const sale = db.select().from(sales).where(eq(sales.id, saleId)).get()

  if (!sale || sale.branchId !== branchId) {
    throw createError({ statusCode: 404, statusMessage: 'Sale not found.' })
  }
  if (sale.status === 'voided') {
    throw createError({ statusCode: 409, statusMessage: 'Voided sales cannot receive payments.' })
  }

  const currentPaid = getCompletedPaymentTotal(saleId)
  const currentBalance = getPaymentBalance(sale.total, currentPaid)
  authorizeAction({
    user,
    action: 'payment.record',
    resource: {
      type: 'sale',
      id: sale.id,
      branchId: sale.branchId,
      total: sale.total,
      paid: currentPaid,
      balance: currentBalance,
      paymentAmount: payload.amount,
    },
  })

  if (payload.amount > currentBalance) {
    throw createError({ statusCode: 409, statusMessage: 'Payment exceeds the outstanding balance.' })
  }

  const paymentId = randomUUID()
  const timestamp = new Date().toISOString()
  const result = db.transaction(() => {
    const currentSale = db.select().from(sales).where(eq(sales.id, saleId)).get()
    if (!currentSale || currentSale.branchId !== branchId) {
      throw createError({ statusCode: 404, statusMessage: 'Sale not found.' })
    }
    if (currentSale.status === 'voided') {
      throw createError({ statusCode: 409, statusMessage: 'Voided sales cannot receive payments.' })
    }

    const paidBefore = getCompletedPaymentTotal(saleId)
    const balanceBefore = getPaymentBalance(currentSale.total, paidBefore)
    if (payload.amount > balanceBefore) {
      throw createError({ statusCode: 409, statusMessage: 'Payment exceeds the outstanding balance.' })
    }

    const paid = paidBefore + payload.amount
    const balance = getPaymentBalance(currentSale.total, paid)
    const status = getSalePaymentStatus(currentSale.total, paid)

    db.insert(payments).values({
      id: paymentId,
      saleId,
      amount: payload.amount,
      method: payload.method,
      status: 'completed',
      recordedBy: user.id,
      createdAt: timestamp,
    }).run()

    db.update(sales).set({ status }).where(eq(sales.id, saleId)).run()

    db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: user.id,
      action: 'payment.record',
      resourceType: 'sale',
      resourceId: saleId,
      details: JSON.stringify({ paymentId, amount: payload.amount, method: payload.method, balance }),
      ipAddress: event.node.req.socket.remoteAddress ?? null,
      createdAt: timestamp,
    }).run()

    return { paid, balance, status }
  })

  return { ok: true, paymentId, saleId, ...result }
})