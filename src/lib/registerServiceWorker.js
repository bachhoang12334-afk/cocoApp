export function registerCocoServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }

  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}
