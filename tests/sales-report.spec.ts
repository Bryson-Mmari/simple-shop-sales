import { describe, expect, it } from 'vitest'
import { summarizeSalesReport } from '../server/utils/sales-report'

describe('sales report aggregation', () => {
  it('summarizes sales, collections, balances, methods, and products', () => {
    const payments = [
      { saleId: 'sale-a', amount: 25, method: 'cash' },
      { saleId: 'sale-b', amount: 100, method: 'card' },
    ]

    const report = summarizeSalesReport({
      sales: [
        { id: 'sale-a', total: 100, discount: 10, status: 'partial', createdAt: '2026-10-12T08:00:00.000Z' },
        { id: 'sale-b', total: 200, discount: 0, status: 'partial', createdAt: '2026-10-12T10:00:00.000Z' },
        { id: 'sale-void', total: 50, discount: 0, status: 'voided', createdAt: '2026-10-12T11:00:00.000Z' },
      ],
      payments,
      allPayments: [
        ...payments,
        { saleId: 'sale-a', amount: 20, method: 'bank_transfer' },
      ],
      items: [
        { saleId: 'sale-a', productId: 'tea', productName: 'Tea', quantity: 3, lineTotal: 90 },
        { saleId: 'sale-b', productId: 'tea', productName: 'Tea', quantity: 1, lineTotal: 30 },
        { saleId: 'sale-void', productId: 'cake', productName: 'Cake', quantity: 2, lineTotal: 50 },
      ],
    })

    expect(report.salesCount).toBe(2)
    expect(report.salesTotal).toBe(300)
    expect(report.discountsTotal).toBe(10)
    expect(report.paymentsCollected).toBe(125)
    expect(report.outstanding).toBe(155)
    expect(report.paymentsByMethod).toEqual([
      { method: 'card', amount: 100 },
      { method: 'cash', amount: 25 },
    ])
    expect(report.dailySales).toEqual([
      { date: '2026-10-12', count: 2, total: 300 },
    ])
    expect(report.topProducts).toEqual([
      { productId: 'tea', productName: 'Tea', quantity: 4, total: 120 },
    ])
  })
})