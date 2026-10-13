<script setup lang="ts">
const { data, refresh } = await useFetch('/api/policies', { server: false })
const csrfToken = useCookie('shop_csrf')
const form = reactive({
  name: '',
  effect: 'Permit',
  targetAction: 'sale.read',
  condition: { field: 'subject.accountStatus', op: 'eq', value: 'active' },
})

async function submitPolicy() {
  await $fetch('/api/policies', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken.value ?? '' },
    body: form,
  })
  await refresh()
  form.name = ''
}
</script>

<template>
  <div>
    <h2 class="fw-bold mb-4">Policy management</h2>
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3"><input v-model="form.name" class="form-control" placeholder="Policy name" /></div>
          <div class="col-md-3">
            <select v-model="form.effect" class="form-select">
              <option value="Permit">Permit</option>
              <option value="Deny">Deny</option>
            </select>
          </div>
          <div class="col-md-3">
            <input v-model="form.targetAction" class="form-control" placeholder="Action" />
          </div>
          <div class="col-md-3">
            <button class="btn btn-primary w-100" @click="submitPolicy">Add policy</button>
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
              <th>Effect</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data?.items || []" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.effect }}</td>
              <td>{{ item.targetAction }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
