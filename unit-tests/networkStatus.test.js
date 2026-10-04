import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNetworkStatusStore,
  NETWORK_STATUS_OFFLINE,
  NETWORK_STATUS_ONLINE,
  NETWORK_STATUS_RESTORED,
} from '../src/lib/networkStatus.js'

function createEventTarget() {
  const listeners = new Map()

  return {
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type)
    },
    dispatch(type) {
      listeners.get(type)?.()
    },
    listenerCount() {
      return listeners.size
    },
  }
}

test('network store reports offline and a short restored state without reloading', () => {
  const windowTarget = createEventTarget()
  const navigatorTarget = { onLine: true }
  const scheduled = []
  const store = createNetworkStatusStore({
    windowTarget,
    navigatorTarget,
    restoreDuration: 3500,
    schedule(callback, delay) {
      scheduled.push({ callback, delay })
      return scheduled.length
    },
    cancel() {},
  })
  const observed = []
  const unsubscribe = store.subscribe(() => observed.push(store.getSnapshot()))

  navigatorTarget.onLine = false
  windowTarget.dispatch('offline')
  assert.equal(store.getSnapshot(), NETWORK_STATUS_OFFLINE)

  navigatorTarget.onLine = true
  windowTarget.dispatch('online')
  assert.equal(store.getSnapshot(), NETWORK_STATUS_RESTORED)
  assert.equal(scheduled[0].delay, 3500)

  scheduled[0].callback()
  assert.equal(store.getSnapshot(), NETWORK_STATUS_ONLINE)
  assert.deepEqual(observed, [
    NETWORK_STATUS_OFFLINE,
    NETWORK_STATUS_RESTORED,
    NETWORK_STATUS_ONLINE,
  ])

  unsubscribe()
  assert.equal(windowTarget.listenerCount(), 0)
})

test('network store starts offline and removes listeners after the final subscriber', () => {
  const windowTarget = createEventTarget()
  const store = createNetworkStatusStore({
    windowTarget,
    navigatorTarget: { onLine: false },
  })

  assert.equal(store.getSnapshot(), NETWORK_STATUS_OFFLINE)
  const unsubscribe = store.subscribe(() => {})
  assert.equal(windowTarget.listenerCount(), 2)

  unsubscribe()
  assert.equal(windowTarget.listenerCount(), 0)
})
