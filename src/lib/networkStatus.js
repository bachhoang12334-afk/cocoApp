import { useSyncExternalStore } from 'react'

export const NETWORK_STATUS_ONLINE = 'online'
export const NETWORK_STATUS_OFFLINE = 'offline'
export const NETWORK_STATUS_RESTORED = 'restored'

const DEFAULT_RESTORE_DURATION = 4000

function isOnline(navigatorTarget) {
  return navigatorTarget?.onLine !== false
}

export function createNetworkStatusStore({
  windowTarget = typeof window === 'undefined' ? null : window,
  navigatorTarget = typeof navigator === 'undefined' ? null : navigator,
  restoreDuration = DEFAULT_RESTORE_DURATION,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (timerId) => clearTimeout(timerId),
} = {}) {
  const listeners = new Set()
  let currentStatus = isOnline(navigatorTarget)
    ? NETWORK_STATUS_ONLINE
    : NETWORK_STATUS_OFFLINE
  let restoreTimer = null
  let isListening = false

  function clearRestoreTimer() {
    if (restoreTimer === null) return
    cancel(restoreTimer)
    restoreTimer = null
  }

  function publish(nextStatus) {
    if (nextStatus === currentStatus) return
    currentStatus = nextStatus
    listeners.forEach((listener) => listener())
  }

  function handleOffline() {
    clearRestoreTimer()
    publish(NETWORK_STATUS_OFFLINE)
  }

  function handleOnline() {
    if (currentStatus !== NETWORK_STATUS_OFFLINE) return

    publish(NETWORK_STATUS_RESTORED)
    clearRestoreTimer()
    restoreTimer = schedule(() => {
      restoreTimer = null
      publish(NETWORK_STATUS_ONLINE)
    }, restoreDuration)
  }

  function reconcileStatus() {
    if (isOnline(navigatorTarget)) {
      handleOnline()
    } else {
      handleOffline()
    }
  }

  function startListening() {
    if (isListening || !windowTarget?.addEventListener) return
    isListening = true
    windowTarget.addEventListener('offline', handleOffline)
    windowTarget.addEventListener('online', handleOnline)
    reconcileStatus()
  }

  function stopListening() {
    if (!isListening) return
    isListening = false
    windowTarget.removeEventListener('offline', handleOffline)
    windowTarget.removeEventListener('online', handleOnline)
    clearRestoreTimer()

    if (currentStatus === NETWORK_STATUS_RESTORED) {
      currentStatus = NETWORK_STATUS_ONLINE
    }
  }

  function subscribe(listener) {
    listeners.add(listener)
    startListening()

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) stopListening()
    }
  }

  return {
    getSnapshot: () => currentStatus,
    getServerSnapshot: () => NETWORK_STATUS_ONLINE,
    subscribe,
  }
}

export const networkStatusStore = createNetworkStatusStore()

export function useNetworkStatus(store = networkStatusStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}
