<script setup lang="ts">
const { data, refresh } = await useFetch('/api/customers', { server: false })
const csrfToken = useCookie('shop_csrf')
const form = reactive({
  name: '',
  phone: '',
  email: '',
  address: '',
})

async function submit() {
  await $fetch('/api/customers', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken.value ?? '' },
    body: form,
  })
  await refresh()
  Object.assign(form, { name: '', phone: '', email: '', address: '' })
}
</script>

<template>
  <div>
    <h2 class="fw-bold mb-4">Customers</h2>
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3"><input v-model="form.name" class="form-control" placeholder="Name" /></div>
          <div class="col-md-3"><input v-model="form.phone" class="form-control" placeholder="Phone" /></div>
          <div class="col-md-3"><input v-model="form.email" class="form-control" placeholder="Email" /></div>
          <div class="col-md-3"><input v-model="form.address" class="form-control" placeholder="Address" /></div>
          <div class="col-md-3">
            <button class="btn btn-primary" @click="submit">Add customer</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data?.items || []" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.phone || '-' }}</td>
              <td>{{ item.email || '-' }}</td>
              <td>{{ item.address || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
