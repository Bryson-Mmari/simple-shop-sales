<script setup lang="ts">
const { data, refresh } = await useFetch('/api/products', { server: false })
const csrfToken = useCookie('shop_csrf')
const form = reactive({
  code: '',
  name: '',
  description: '',
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  minStock: 0,
  status: 'active',
})

async function submit() {
  await $fetch('/api/products', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken.value ?? '' },
    body: form,
  })
  await refresh()
  Object.assign(form, { code: '', name: '', description: '', costPrice: 0, sellingPrice: 0, stock: 0, minStock: 0, status: 'active' })
}
</script>

<template>
  <div>
    <h2 class="fw-bold mb-4">Products</h2>
    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">Create product</h5>
        <div class="row g-3">
          <div class="col-md-3"><input v-model="form.code" class="form-control" placeholder="Code" /></div>
          <div class="col-md-3"><input v-model="form.name" class="form-control" placeholder="Name" /></div>
          <div class="col-md-3"><input v-model="form.description" class="form-control" placeholder="Description" /></div>
          <div class="col-md-3"><input v-model.number="form.costPrice" type="number" class="form-control" placeholder="Cost" /></div>
          <div class="col-md-3"><input v-model.number="form.sellingPrice" type="number" class="form-control" placeholder="Selling price" /></div>
          <div class="col-md-2"><input v-model.number="form.stock" type="number" class="form-control" placeholder="Stock" /></div>
          <div class="col-md-2"><input v-model.number="form.minStock" type="number" class="form-control" placeholder="Min stock" /></div>
          <div class="col-md-2">
            <select v-model="form.status" class="form-select">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button class="btn btn-primary w-100" @click="submit">Save</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="data?.items?.length" class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.items" :key="item.id">
                <td>{{ item.code }}</td>
                <td>{{ item.name }}</td>
                <td>{{ item.sellingPrice }}</td>
                <td>{{ item.stock }}</td>
                <td><span class="badge bg-success">{{ item.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-muted mb-0">No products found.</p>
      </div>
    </div>
  </div>
</template>
