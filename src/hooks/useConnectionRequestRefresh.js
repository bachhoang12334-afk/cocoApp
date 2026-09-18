import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useConnectionRequestRefresh(
  refresh,
  {
    onError,
    refreshOnMount = true,
    refreshOnFocus = true,
  } = {}
) {
  const refreshRef = useRef(refresh)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    refreshRef.current = refresh
    onErrorRef.current = onError
  }, [onError, refresh])

  useEffect(() => {
    let isMounted = true
    let refreshPromise = null
    let refreshQueued = false

    function runRefresh() {
      if (refreshPromise) {
        refreshQueued = true
        return refreshPromise
      }

      refreshPromise = Promise.resolve()
        .then(() => refreshRef.current())
        .catch((error) => {
          if (isMounted) onErrorRef.current?.(error)
        })
        .finally(() => {
          refreshPromise = null

          if (isMounted && refreshQueued) {
            refreshQueued = false
            void runRefresh()
          }
        })

      return refreshPromise
    }

    function handleWindowFocus() {
      void runRefresh()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void runRefresh()
      }
    }

    const channel = supabase
      .channel(`connection-requests:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connection_requests' },
        () => void runRefresh()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void runRefresh()
      })

    if (refreshOnFocus) {
      window.addEventListener('focus', handleWindowFocus)
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    if (refreshOnMount) void runRefresh()

    return () => {
      isMounted = false
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [refreshOnFocus, refreshOnMount])
}
