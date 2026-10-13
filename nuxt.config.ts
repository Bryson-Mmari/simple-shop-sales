export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Simple Shop Sales',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  runtimeConfig: {
    sessionSecret: process.env.NUXT_SESSION_SECRET || 'development-secret-change-me',
    databasePath: process.env.NUXT_DATABASE_PATH || '.data/simple-shop.sqlite',
    appName: process.env.NUXT_APP_NAME || 'Simple Shop Sales',
    defaultAdminEmail: process.env.NUXT_BOOTSTRAP_EMAIL || '',
    defaultAdminPassword: process.env.NUXT_BOOTSTRAP_PASSWORD || '',
  },
})
