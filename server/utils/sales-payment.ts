export function getPaymentBalance(total: number, paid: number) {
  return Math.max(total - paid, 0)
}

export function getSalePaymentStatus(total: number, paid: number): 'draft' | 'partial' | 'paid' {
  if (total <= 0 || paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'draft'
}