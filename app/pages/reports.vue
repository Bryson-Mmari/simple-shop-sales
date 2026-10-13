<script setup lang="ts">
type ReportSummary = {
  salesCount: number
  salesTotal: number
  discountsTotal: number
  paymentsCollected: number
  outstanding: number
  paymentsByMethod: Array<{ method: string; amount: number }>
  dailySales: Array<{ date: string; count: number; total: number }>
  topProducts: Array<{ productId: string; productName: string; quantity: number; total: number }>
}

const today = new Date().toISOString().slice(0, 10)
const from = ref(`${today.slice(0, 7)}-01`)
const to = ref(today)
const summary = ref<ReportSummary | null>(null)
const loading = ref(false)
const errorMessage = ref('')

async function loadReport() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<{ summary: ReportSummary }>('/api/reports/sales', {
      query: { from: from.value, to: to.value },
    })
    summary.value = response.summary
  } catch (error: any) {
    errorMessage.value = error.data?.statusMessage ?? 'Unable to load this report.'
  } finally {
    loading.value = false
  }
}

function formatAmount(amount: number) {
  return `TZS ${new Intl.NumberFormat().format(amount)}`
}

function formatMethod(method: string) {
  return method.replaceAll('_', ' ')
}

onMounted(loadReport)
</script>

<template>
  <div>
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div>
        <h2 class="fw-bold mb-1">Sales reports</h2>
        <p class="text-muted mb-0">Branch performance for the selected dates</p>
      </div>
      <form class="d-flex flex-wrap align-items-end gap-2" @submit.prevent="loadReport">
        <div>
          <label for="report-from" class="form-label mb-1">From</label>
          <input id="report-from" v-model="from" class="form-control" type="date" required />
        </div>
        <div>
          <label for="report-to" class="form-label mb-1">To</label>
          <input id="report-to" v-model="to" class="form-control" type="date" required />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Loading...' : 'Run report' }}
        </button>
      </form>
    </div>

    <p v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</p>
    <p v-else-if="loading && !summary" class="text-muted" role="status">Loading report...</p>

    <template v-if="summary">
      <div class="row g-3 mb-4">
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100"><div class="card-body">
            <div class="small text-muted">Sales</div>
            <div class="fs-4 fw-bold">{{ summary.salesCount }}</div>
            <div>{{ formatAmount(summary.salesTotal) }}</div>
          </div></div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100"><div class="card-body">
            <div class="small text-muted">Payments collected</div>
            <div class="fs-4 fw-bold">{{ formatAmount(summary.paymentsCollected) }}</div>
          </div></div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100"><div class="card-body">
            <div class="small text-muted">Outstanding on these sales</div>
            <div class="fs-4 fw-bold">{{ formatAmount(summary.outstanding) }}</div>
          </div></div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100"><div class="card-body">
            <div class="small text-muted">Discounts</div>
            <div class="fs-4 fw-bold">{{ formatAmount(summary.discountsTotal) }}</div>
          </div></div>
        </div>
      </div>

      <section class="mb-4" aria-labelledby="daily-heading">
        <h3 id="daily-heading" class="h5 mb-3">Daily sales</h3>
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead><tr><th scope="col">Date</th><th scope="col">Transactions</th><th scope="col" class="text-end">Total</th></tr></thead>
            <tbody>
              <tr v-for="day in summary.dailySales" :key="day.date">
                <td>{{ day.date }}</td><td>{{ day.count }}</td><td class="text-end">{{ formatAmount(day.total) }}</td>
              </tr>
              <tr v-if="!summary.dailySales.length"><td colspan="3" class="text-muted">No sales in this period.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="row g-4">
        <section class="col-lg-5" aria-labelledby="methods-heading">
          <h3 id="methods-heading" class="h5 mb-3">Payments by method</h3>
          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <thead><tr><th scope="col">Method</th><th scope="col" class="text-end">Collected</th></tr></thead>
              <tbody>
                <tr v-for="payment in summary.paymentsByMethod" :key="payment.method">
                  <td class="text-capitalize">{{ formatMethod(payment.method) }}</td><td class="text-end">{{ formatAmount(payment.amount) }}</td>
                </tr>
                <tr v-if="!summary.paymentsByMethod.length"><td colspan="2" class="text-muted">No payments in this period.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="col-lg-7" aria-labelledby="products-heading">
          <h3 id="products-heading" class="h5 mb-3">Top products</h3>
          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <thead><tr><th scope="col">Product</th><th scope="col" class="text-end">Units</th><th scope="col" class="text-end">Sales</th></tr></thead>
              <tbody>
                <tr v-for="product in summary.topProducts" :key="product.productId">
                  <td>{{ product.productName }}</td><td class="text-end">{{ product.quantity }}</td><td class="text-end">{{ formatAmount(product.total) }}</td>
                </tr>
                <tr v-if="!summary.topProducts.length"><td colspan="3" class="text-muted">No product sales in this period.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>