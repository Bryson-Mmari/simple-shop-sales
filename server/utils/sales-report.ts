type ReportSale = {
  id: string
  total: number
  discount: number
  status: string
  createdAt: string
}

type ReportPayment = {
  saleId: string
  amount: number
  method: string
}

type ReportItem = {
  saleId: string
  productId: string
  productName: string
  quantity: number
  lineTotal: number
}

export function summarizeSalesReport({
  sales,
  payments,
  allPayments,
  items,
}: {
  sales: ReportSale[]
  payments: ReportPayment[]
  allPayments: ReportPayment[]
  items: ReportItem[]
}) {
  const activeSales = sales.filter((sale) => sale.status !== 'voided')
  const saleIds = new Set(activeSales.map((sale) => sale.id))
  const paidBySale = new Map<string, number>()

  for (const payment of allPayments) {
    paidBySale.set(payment.saleId, (paidBySale.get(payment.saleId) ?? 0) + payment.amount)
  }

  const paymentsByMethod = new Map<string, number>()
  for (const payment of payments) {
    paymentsByMethod.set(payment.method, (paymentsByMethod.get(payment.method) ?? 0) + payment.amount)
  }

  const dailySales = new Map<string, { date: string; count: number; total: number }>()
  for (const sale of activeSales) {
    const date = sale.createdAt.slice(0, 10)
    const daily = dailySales.get(date) ?? { date, count: 0, total: 0 }
    daily.count += 1
    daily.total += sale.total
    dailySales.set(date, daily)
  }

  const productTotals = new Map<string, { productId: string; productName: string; quantity: number; total: number }>()
  for (const item of items) {
    if (!saleIds.has(item.saleId)) continue
    const product = productTotals.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productName,
      quantity: 0,
      total: 0,
    }
    product.quantity += item.quantity
    product.total += item.lineTotal
    productTotals.set(item.productId, product)
  }

  return {
    salesCount: activeSales.length,
    salesTotal: activeSales.reduce((sum, sale) => sum + sale.total, 0),
    discountsTotal: activeSales.reduce((sum, sale) => sum + sale.discount, 0),
    paymentsCollected: payments.reduce((sum, payment) => sum + payment.amount, 0),
    outstanding: activeSales.reduce((sum, sale) => sum + Math.max(sale.total - (paidBySale.get(sale.id) ?? 0), 0), 0),
    paymentsByMethod: [...paymentsByMethod.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((left, right) => right.amount - left.amount || left.method.localeCompare(right.method)),
    dailySales: [...dailySales.values()].sort((left, right) => left.date.localeCompare(right.date)),
    topProducts: [...productTotals.values()]
      .sort((left, right) => right.quantity - left.quantity || right.total - left.total)
      .slice(0, 10),
  }
}