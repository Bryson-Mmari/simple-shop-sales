<script setup lang="ts">
type ProductOption = { id: string; code: string; name: string; stock: number }
type Movement = {
  id: string
  productCode: string
  productName: string
  delta: number
  reason: string
  createdAt: string
}

const { data: productData } = await useFetch<{ items: ProductOption[] }>('/api/products', { server: false })
const { data: movementData, refresh } = await useFetch<{ items: Movement[] }>('/api/inventory', { server: false })
const csrfToken = useCookie('shop_csrf')
const form = reactive({ productId: '', delta: 1, reason: '' })
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function submitAdjustment() {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken.value ?? '' },
      body: form,
    })
    successMessage.value = 'Stock adjustment recorded.'
    form.delta = 1
    form.reason = ''
    await refresh()
    await refreshNuxtData('/api/products')
  } catch (error: any) {
    errorMessage.value = error.data?.statusMessage ?? 'Unable to record this adjustment.'
  } finally {
    saving.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div>
    <h2 class="fw-bold mb-4">Inventory</h2>

    <section class="card mb-4" aria-labelledby="adjustment-heading">
      <div class="card-body">
        <h3 id="adjustment-heading" class="h5 card-title">Adjust stock</h3>
        <form class="row g-3" @submit.prevent="submitAdjustment">
          <div class="col-md-5">
            <label for="inventory-product" class="form-label">Product</label>
            <select id="inventory-product" v-model="form.productId" class="form-select" required>
              <option disabled value="">Select a product</option>
              <option v-for="product in productData?.items ?? []" :key="product.id" :value="product.id">
                {{ product.code }} - {{ product.name }} ({{ product.stock }} in stock)
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <label for="inventory-delta" class="form-label">Change</label>
            <input id="inventory-delta" v-model.number="form.delta" class="form-control" type="number" step="1" required />
          </div>
          <div class="col-md-5">
            <label for="inventory-reason" class="form-label">Reason</label>
            <input id="inventory-reason" v-model="form.reason" class="form-control" minlength="3" maxlength="240" required />
          </div>
          <div class="col-12 d-flex align-items-center gap-3">
            <button class="btn btn-primary" type="submit" :disabled="saving || !form.productId || !form.delta">
              {{ saving ? 'Recording...' : 'Record adjustment' }}
            </button>
            <span v-if="successMessage" class="text-success" role="status">{{ successMessage }}</span>
            <span v-if="errorMessage" class="text-danger" role="alert">{{ errorMessage }}</span>
          </div>
        </form>
      </div>
    </section>

    <section aria-labelledby="history-heading">
      <h3 id="history-heading" class="h5 mb-3">Recent stock movements</h3>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Product</th>
              <th scope="col">Change</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="movement in movementData?.items ?? []" :key="movement.id">
              <td>{{ formatDate(movement.createdAt) }}</td>
              <td>{{ movement.productCode }} - {{ movement.productName }}</td>
              <td :class="movement.delta > 0 ? 'text-success' : 'text-danger'">
                {{ movement.delta > 0 ? '+' : '' }}{{ movement.delta }}
              </td>
              <td>{{ movement.reason }}</td>
            </tr>
            <tr v-if="!movementData?.items.length">
              <td colspan="4" class="text-muted">No stock movements recorded.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>