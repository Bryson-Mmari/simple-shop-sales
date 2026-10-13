<script setup lang="ts">
const { data, error, refresh } = await useFetch('/api/dashboard', { server: false })

const summary = computed(() => data.value?.summary ?? { salesToday: 0, salesTotal: 0, paymentsToday: 0, outstanding: 0, lowStockCount: 0 })
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="fw-bold mb-1">Dashboard</h2>
        <p class="text-muted mb-0">Overview of store performance</p>
      </div>
      <button class="btn btn-outline-primary" @click="refresh()">Refresh</button>
    </div>

    <div v-if="error" class="alert alert-warning">Unable to load dashboard data.</div>

    <div v-else class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small">Sales today</div>
            <div class="fs-3 fw-bold">{{ summary.salesToday }}</div>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small">Sales value</div>
            <div class="fs-3 fw-bold">TZS {{ summary.salesTotal.toLocaleString() }}</div>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small">Payments</div>
            <div class="fs-3 fw-bold">TZS {{ summary.paymentsToday.toLocaleString() }}</div>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small">Outstanding</div>
            <div class="fs-3 fw-bold">TZS {{ summary.outstanding.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <h5 class="mb-3">Low-stock alerts</h5>
        <div v-if="(data?.lowStock ?? []).length">
          <ul class="mb-0 list-group list-group-flush">
            <li v-for="product in (data?.lowStock ?? [])" :key="product.id" class="list-group-item d-flex justify-content-between">
              <span>{{ product.name }}</span>
              <span class="badge bg-warning text-dark">{{ product.stock }} left</span>
            </li>
          </ul>
        </div>
        <p v-else class="text-muted mb-0">No stock alerts.</p>
      </div>
    </div>
  </div>
</template>
