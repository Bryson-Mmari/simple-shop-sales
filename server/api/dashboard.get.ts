import { requireAuth } from '../auth'
import { db } from '../database'
import { payments, products, sales } from '../database/schema'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const salesData = db.select().from(sales).all()
  const todaySales = salesData.filter((sale) => sale.createdAt >= startOfDay)
  const totalSales = todaySales.reduce((sum, sale) => sum + sale.total, 0)
  const paymentTotal = db.select().from(payments).all().reduce((sum, payment) => sum + payment.amount, 0)
  const lowStock = db.select().from(products).all().filter((product) => product.stock <= product.minStock)

  return {
    ok: true,
    summary: {
      salesToday: todaySales.length,
      salesTotal: totalSales,
      paymentsToday: paymentTotal,
      outstanding: salesData.filter((sale) => sale.status !== 'paid').reduce((sum, sale) => sum + sale.total, 0),
      lowStockCount: lowStock.length,
    },
    lowStock,
    recentSales: todaySales.slice(0, 5),
  }
})
