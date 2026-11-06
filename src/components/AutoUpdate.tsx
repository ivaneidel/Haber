import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * New content ships as a new bundle, and it should land at once. With
 * `registerType: 'autoUpdate'` the new service worker skips waiting and the
 * page reloads itself when it takes over. The browser only looks for a new
 * worker on navigation, so also check whenever the app comes back to the
 * foreground (an installed PWA can stay open for days) and hourly.
 */
export default function AutoUpdate() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, 60 * 60 * 1000)
    },
  })
  return null
}
