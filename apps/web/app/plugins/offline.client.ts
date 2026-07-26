export default defineNuxtPlugin(() => {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('/sw.js')
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }
})
