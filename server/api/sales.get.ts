import { eq } from 'drizzle-orm'
import { db } from '../database'
import { payments, sales, saleItems } from '../database/schema'
import { requireAuth } from '../auth'
import { authorizeAction } from '../utils/abac'
import { getPaymentBalance, getSalePaymentStatus } from '../utils/sales-payment'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const branchId = user.branchId ?? 'branch-main'
  const rows = db.select().from(sales).where(eq(sales.branchId, branchId)).all()

  const visibleSales = rows.filter((sale) => {
    try {
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
      return true
    } catch {
      return false
    }
  })

  const saleIds = new Set(visibleSales.map((sale) => sale.id))
  const completedPayments = db.select().from(payments).all()
    .filter((payment) => payment.status === 'completed' && saleIds.has(payment.saleId))
  const paidBySale = new Map<string, number>()
  for (const payment of completedPayments) {
    paidBySale.set(payment.saleId, (paidBySale.get(payment.saleId) ?? 0) + payment.amount)
  }
  const itemsBySale = db.select().from(saleItems).all()
    .filter((item) => saleIds.has(item.saleId))

  return {
    ok: true,
    items: visibleSales.map((sale) => {
      const paid = paidBySale.get(sale.id) ?? 0
      return {
        id: sale.id,
        reference: sale.reference,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        status: sale.status === 'voided' ? sale.status : getSalePaymentStatus(sale.total, paid),
        paid,
        balance: getPaymentBalance(sale.total, paid),
        createdAt: sale.createdAt,
        items: itemsBySale.filter((item) => item.saleId === sale.id),
      }
    }),
  }
})
