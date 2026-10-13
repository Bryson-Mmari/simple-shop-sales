<script setup lang="ts">
const products = await useFetch('/api/products', { server: false })
const sales = await useFetch('/api/sales', { server: false })

const form = reactive({
  customerId: '',
  items: [{ productId: '', quantity: 1 }],
  discount: 0,
  paymentMethod: 'cash',
  paymentAmount: 0,
})
const paymentForm = reactive({ saleId: '', amount: 0, method: 'cash' })
const csrfToken = useCookie('shop_csrf')
const paymentError = ref('')
const paymentSuccess = ref('')
const paymentSaving = ref(false)

const selectedProducts = computed(() => products.data.value?.items || [])
const outstandingSales = computed(() => (sales.data.value?.items || []).filter((sale) => sale.balance > 0 && sale.status !== 'voided'))

watch(() => paymentForm.saleId, (saleId) => {
  const sale = outstandingSales.value.find((item) => item.id === saleId)
  paymentForm.amount = sale?.balance ?? 0
})

async function addItem() {
  form.items.push({ productId: '', quantity: 1 })
}

async function createSale() {
  await $fetch('/api/sales', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken.value ?? '' },
    body: {
      customerId: form.customerId || null,
      discount: Number(form.discount || 0),
      paymentMethod: form.paymentMethod,
      paymentAmount: Number(form.paymentAmount || 0),
      items: form.items.filter((item) => item.productId).map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity || 1),
      })),
    },
  })
  await sales.refresh()
  await products.refresh()
  form.items = [{ productId: '', quantity: 1 }]
  form.discount = 0
  form.paymentAmount = 0
  form.paymentMethod = 'cash'
}

async function recordPayment() {
  if (!paymentForm.saleId) return
  paymentSaving.value = true
  paymentError.value = ''
  paymentSuccess.value = ''

  try {
    await $fetch(`/api/sales/${paymentForm.saleId}/payments`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken.value ?? '' },
      body: { amount: Number(paymentForm.amount), method: paymentForm.method },
    })
    paymentSuccess.value = 'Payment recorded.'
    paymentForm.saleId = ''
    paymentForm.amount = 0
    await sales.refresh()
  } catch (error: any) {
    paymentError.value = error.data?.statusMessage ?? 'Unable to record this payment.'
  } finally {
    paymentSaving.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="fw-bold mb-4">Sales</h2>
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3 mb-3">
          <div class="col-md-3">
            <label class="form-label">Customer</label>
            <input v-model="form.customerId" class="form-control" placeholder="customer id" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Discount</label>
            <input v-model.number="form.discount" type="number" class="form-control" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Payment method</label>
            <select v-model="form.paymentMethod" class="form-select">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mobile_money">Mobile money</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Payment amount</label>
            <input v-model.number="form.paymentAmount" type="number" class="form-control" />
          </div>
        </div>

        <div v-for="(item, index) in form.items" :key="index" class="row g-3 mb-2">
          <div class="col-md-6">
            <select v-model="item.productId" class="form-select">
              <option value="">Select product</option>
              <option v-for="product in selectedProducts" :key="product.id" :value="product.id">
                {{ product.name }} ({{ product.stock }} in stock)
              </option>
            </select>
          </div>
          <div class="col-md-3">
            <input v-model.number="item.quantity" type="number" min="1" class="form-control" placeholder="Qty" />
          </div>
          <div class="col-md-3 d-flex align-items-end">
            <button class="btn btn-outline-secondary w-100" @click="addItem">Add row</button>
          </div>
        </div>

        <button class="btn btn-primary" @click="createSale">Create sale</button>
      </div>
    </div>

    <section class="card mb-4" aria-labelledby="payment-heading">
      <div class="card-body">
        <h3 id="payment-heading" class="h5 card-title">Record a payment</h3>
        <form class="row g-3" @submit.prevent="recordPayment">
          <div class="col-md-5">
            <label for="payment-sale" class="form-label">Outstanding sale</label>
            <select id="payment-sale" v-model="paymentForm.saleId" class="form-select" required>
              <option disabled value="">Select a sale</option>
              <option v-for="sale in outstandingSales" :key="sale.id" :value="sale.id">
                {{ sale.reference }} - balance {{ sale.balance }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <label for="payment-amount" class="form-label">Amount</label>
            <input id="payment-amount" v-model.number="paymentForm.amount" class="form-control" type="number" min="1" step="1" required />
          </div>
          <div class="col-md-3">
            <label for="payment-method" class="form-label">Method</label>
            <select id="payment-method" v-model="paymentForm.method" class="form-select">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mobile_money">Mobile money</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button class="btn btn-primary w-100" type="submit" :disabled="paymentSaving || !paymentForm.saleId || !paymentForm.amount">
              {{ paymentSaving ? 'Recording...' : 'Record payment' }}
            </button>
          </div>
          <div class="col-12">
            <span v-if="paymentSuccess" class="text-success" role="status">{{ paymentSuccess }}</span>
            <span v-if="paymentError" class="text-danger" role="alert">{{ paymentError }}</span>
          </div>
        </form>
      </div>
    </section>

    <div class="card">
      <div class="card-body table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sales.data.value?.items || []" :key="item.id">
              <td>{{ item.reference }}</td>
              <td>{{ item.total }}</td>
              <td>{{ item.paid }}</td>
              <td>{{ item.balance }}</td>
              <td><span class="badge" :class="item.status === 'paid' ? 'bg-success' : item.status === 'voided' ? 'bg-secondary' : 'bg-warning text-dark'">{{ item.status }}</span></td>
              <td>{{ new Date(item.createdAt).toLocaleDateString() }}</td>
              <td><NuxtLink class="btn btn-outline-secondary btn-sm" :to="`/sales/${item.id}`">Receipt</NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
