export default defineNuxtConfig({
  compatibilityDate: '2025-05-19',
  ssr: false,

  router: {
    options: { strict: false },
  },

  app: {
    head: {
      title: 'darwin — offline image effects',
      meta: [
        { name: 'description', content: 'Private, offline image effects powered by WebAssembly.' },
        { name: 'theme-color', content: '#111827' },
      ],
      link: [{ rel: 'manifest', href: '/manifest.webmanifest' }],
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
  },

  vite: {
    optimizeDeps: { include: ['wasm-vips'] },
    server: {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
  },
})
