<script setup lang="ts">
const router = useRouter()
const form = reactive({
  email: '',
  password: '',
})

const isSubmitting = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  try {
    await $fetch('/api/me')
    await router.push('/')
  } catch {
    // not authenticated, continue to login view
  }
})

async function submit() {
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: form,
    })
    await router.push('/')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Login failed.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-lg-5 col-md-7">
        <div class="card shadow border-0">
          <div class="card-body p-4">
            <div class="text-center mb-4">
              <h2 class="fw-bold mb-1">Simple Shop Sales</h2>
              <p class="text-muted mb-0">Secure sales and inventory control</p>
            </div>
            <form @submit.prevent="submit">
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input v-model="form.email" type="email" class="form-control" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Password</label>
                <input v-model="form.password" type="password" class="form-control" required />
              </div>
              <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>
              <button class="btn btn-primary w-100" :disabled="isSubmitting">
                {{ isSubmitting ? 'Signing in...' : 'Login' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
