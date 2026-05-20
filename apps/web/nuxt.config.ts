export default defineNuxtConfig({
  compatibilityDate: '2025-05-19',

  runtimeConfig: {
    esmbotWsUrl: process.env.ESMBOT_WS_URL || 'ws://localhost:3762/sock',
    esmbotHttpUrl: process.env.ESMBOT_HTTP_URL || 'http://localhost:3762',
    esmbotPass: process.env.ESMBOT_PASS || '',
    appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:3000',
    apiKeys: process.env.API_KEYS || '',
    mediaSecret: process.env.MEDIA_SECRET || 'dev-media-secret-change-in-prod',
  },

  router: {
    options: { strict: false },
  },

  nitro: {
    storage: { data: { driver: 'fs', base: './.data' } },
    rollupConfig: { external: ['bufferutil', 'utf-8-validate'] },
  },
})
