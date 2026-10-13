<script setup lang="ts">
type Receipt = {
  reference: string
  subtotal: number
  discount: number
  total: number
  status: string
  paid: number
  balance: number
  customerName: string | null
  createdAt: string
  items: Array<{
    productCode: string
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  payments: Array<{
    id: string
    amount: number
    method: string
    createdAt: string
  }>
}

const route = useRoute()
const { data, pending, error } = await useFetch<{ sale: Receipt }>(
  () => `/api/sales/${String(route.params.id)}`,
  { server: false },
)
const sale = computed(() => data.value?.sale)

function printReceipt() {
  window.print()
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat().format(amount)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4 no-print">
      <NuxtLink class="btn btn-outline-secondary" to="/sales">Back to sales</NuxtLink>
      <button class="btn btn-primary" type="button" :disabled="!sale" @click="printReceipt">Print receipt</button>
    </div>

    <p v-if="pending" class="text-muted">Loading receipt...</p>
    <p v-else-if="error || !sale" class="alert alert-danger" role="alert">Receipt is unavailable.</p>

    <article v-else class="receipt mx-auto">
      <header class="text-center border-bottom pb-3 mb-4">
        <p class="text-uppercase small text-muted mb-1">Simple Shop Sales</p>
        <h1 class="h3 mb-1">Receipt</h1>
        <p class="mb-0">{{ sale.reference }}</p>
      </header>

      <dl class="row mb-4">
        <dt class="col-5">Date</dt>
        <dd class="col-7">{{ formatDate(sale.createdAt) }}</dd>
        <dt class="col-5">Customer</dt>
        <dd class="col-7">{{ sale.customerName || 'Walk-in customer' }}</dd>
        <dt class="col-5">Status</dt>
        <dd class="col-7 text-capitalize">{{ sale.status }}</dd>
      </dl>

      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" class="text-end">Qty</th>
              <th scope="col" class="text-end">Unit</th>
              <th scope="col" class="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in sale.items" :key="`${item.productCode}-${index}`">
              <td>{{ item.productName }} <span class="text-muted small">{{ item.productCode }}</span></td>
              <td class="text-end">{{ item.quantity }}</td>
              <td class="text-end">{{ formatAmount(item.unitPrice) }}</td>
              <td class="text-end">{{ formatAmount(item.lineTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="row justify-content-end mb-4">
        <dt class="col-6 text-end">Subtotal</dt>
        <dd class="col-3 text-end">{{ formatAmount(sale.subtotal) }}</dd>
        <dt class="col-6 text-end">Discount</dt>
        <dd class="col-3 text-end">{{ formatAmount(sale.discount) }}</dd>
        <dt class="col-6 text-end fw-bold">Total</dt>
        <dd class="col-3 text-end fw-bold">{{ formatAmount(sale.total) }}</dd>
        <dt class="col-6 text-end">Paid</dt>
        <dd class="col-3 text-end">{{ formatAmount(sale.paid) }}</dd>
        <dt class="col-6 text-end fw-bold">Balance due</dt>
        <dd class="col-3 text-end fw-bold">{{ formatAmount(sale.balance) }}</dd>
      </dl>

      <section v-if="sale.payments.length" class="border-top pt-3">
        <h2 class="h6">Payments</h2>
        <div v-for="payment in sale.payments" :key="payment.id" class="d-flex justify-content-between small mb-2">
          <span>{{ formatDate(payment.createdAt) }} - {{ payment.method.replaceAll('_', ' ') }}</span>
          <span>{{ formatAmount(payment.amount) }}</span>
        </div>
      </section>

      <footer class="text-center border-top mt-4 pt-3 small text-muted">Thank you</footer>
    </article>
  </div>
</template>

<style scoped>
.receipt {
  max-width: 760px;
  background: #fff;
  padding: 2rem;
}

@media print {
  :global(body) {
    background: #fff !important;
  }

  .no-print {
    display: none !important;
  }

  .receipt {
    max-width: none;
    padding: 0;
  }
}
</style>