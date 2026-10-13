<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Customers', href: '/customers' },
  { label: 'Sales', href: '/sales' },
  { label: 'Reports', href: '/reports' },
  { label: 'Policies', href: '/policies' },
]

const user = ref<any>(null)

onMounted(async () => {
  try {
    const me = await $fetch('/api/me')
    user.value = me.user
  } catch {
    if (route.path !== '/login') {
      await router.push('/login')
    }
  }
})

watch(
  () => route.path,
  async () => {
    if (route.path === '/login') return
    try {
      const me = await $fetch('/api/me')
      user.value = me.user
    } catch {
      await router.push('/login')
    }
  },
  { immediate: true },
)

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div class="container-fluid">
        <span class="navbar-brand fw-bold">Simple Shop Sales</span>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
          <span class="navbar-toggler-icon" />
        </button>
        <div id="mainNav" class="collapse navbar-collapse">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li v-for="item in navItems" :key="item.href" class="nav-item">
              <NuxtLink class="nav-link" :class="{ active: route.path === item.href }" :to="item.href">
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
          <div v-if="user" class="d-flex align-items-center gap-3 text-white">
            <span class="small text-light">{{ user.firstName }} {{ user.lastName }}</span>
            <button class="btn btn-outline-light btn-sm" @click="logout">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <div class="container-fluid py-4">
      <slot />
    </div>
  </div>
</template>
