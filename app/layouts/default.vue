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

interface TestUser {
  email: string
  password: string
  label: string
}

interface LoginResponse {
  ok: boolean
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    departmentId: string | null
    branchId: string
    clearanceLevel: number
    discountLimit: number
    accountStatus: string
  }
  csrfToken: string
}

interface CsrfResponse {
  ok: boolean
  csrfToken: string
  sessionActive: boolean
}

const user = ref<any>(null)
const isDev = import.meta.env.DEV
const testUsers: TestUser[] = [
  { email: 'admin@example.com', password: 'adminpassword', label: 'Admin' },
  { email: 'user2@example.com', password: 'User2Pass123!', label: 'User 2 (Clearance 2)' },
  { email: 'user3@example.com', password: 'User3Pass123!', label: 'User 3 (Clearance 4)' },
  { email: 'test@example.com', password: 'testpassword', label: 'Test (Clearance 3)' }, // from existing seed?
]

async function loginAs(userCred: TestUser) {
  try {
    // Get CSRF token
    const csrfRes = await $fetch('/api/csrf')
    const csrfToken = csrfRes.csrfToken
    
    // Login with credentials
    const loginRes = await $fetch<LoginResponse>('/api/auth-login', {
      method: 'POST',
      body: {
        email: userCred.email,
        password: userCred.password,
      },
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    })
    
    // Update user ref and redirect to home
    user.value = loginRes.user
    await router.push('/')
  } catch (error) {
    console.error('Login failed:', error)
    alert('Failed to login as ' + userCred.email)
  }
}
}

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
  await $fetch('/api/auth-logout', { method: 'POST' })
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
          <div v-if="isDev && user" class="d-flex align-items-center gap-2">
            <small class="text-light me-2">Switch to:</small>
            <button
              v-for="tu in testUsers"
              :key="tu.email"
              class="btn btn-outline-secondary btn-sm"
              @click="loginAs(tu)"
            >
              {{ tu.label }}
            </button>
          </div>
        </div>
      </div>
    </nav>

    <div class="container-fluid py-4">
      <slot />
    </div>
  </div>
</template>
