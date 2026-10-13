import { describe, expect, it, vi } from 'vitest'
import { getPaymentBalance, getSalePaymentStatus } from '../server/utils/sales-payment'

describe('sale payment calculations', () => {
  it('treats an unpaid sale as a draft with the full balance due', () => {
    expect(getSalePaymentStatus(1250, 0)).toBe('draft')
    expect(getPaymentBalance(1250, 0)).toBe(1250)
  })

  it('tracks partial payments and the remaining balance', () => {
    expect(getSalePaymentStatus(1250, 400)).toBe('partial')
    expect(getPaymentBalance(1250, 400)).toBe(850)
  })

  it('marks fully paid and zero-total sales as paid', () => {
    expect(getSalePaymentStatus(1250, 1250)).toBe('paid')
    expect(getSalePaymentStatus(0, 0)).toBe('paid')
  })

  it('never reports a negative outstanding balance', () => {
    expect(getPaymentBalance(1250, 1300)).toBe(0)
  })

  it('accepts a null customer when no customer is selected on a sale', async () => {
    vi.stubGlobal('defineEventHandler', (handler: any) => handler)
    const { saleSchema } = await import('../server/api/sales.post')

    const result = saleSchema.parse({
      customerId: null,
      discount: 0,
      paymentMethod: 'cash',
      paymentAmount: 0,
      items: [{ productId: 'p-1', quantity: 1 }],
    })

    expect(result.customerId).toBeNull()
    vi.unstubAllGlobals()
  })
})