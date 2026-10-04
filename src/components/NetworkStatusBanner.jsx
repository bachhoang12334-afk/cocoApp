import {
  NETWORK_STATUS_OFFLINE,
  NETWORK_STATUS_ONLINE,
  useNetworkStatus,
} from '../lib/networkStatus'

function NetworkStatusIcon({ isOffline }) {
  return (
    <span className="network-status-icon" aria-hidden="true">
      {isOffline ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 4l16 16" />
          <path d="M8.5 6.2A12.5 12.5 0 0 1 21 9.4" />
          <path d="M3 9.4a12.4 12.4 0 0 1 2.6-1.7" />
          <path d="M6.7 13a8 8 0 0 1 5.3-2 8 8 0 0 1 2.4.4" />
          <path d="M9.7 16.5a3.7 3.7 0 0 1 4.6 0" />
          <path d="M12 20h.01" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      )}
    </span>
  )
}

export default function NetworkStatusBanner() {
  const status = useNetworkStatus()

  if (status === NETWORK_STATUS_ONLINE) return null

  const isOffline = status === NETWORK_STATUS_OFFLINE

  return (
    <section
      className={`network-status-banner ${isOffline ? 'is-offline' : 'is-restored'}`}
      role={isOffline ? 'alert' : 'status'}
      aria-live={isOffline ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <NetworkStatusIcon isOffline={isOffline} />
      <span className="network-status-copy">
        <strong>{isOffline ? 'Coco đang ngoại tuyến' : 'Đã kết nối lại'}</strong>
        <span>
          {isOffline
            ? 'Các thao tác cần mạng chưa thể hoàn tất. Nội dung đang mở vẫn được giữ.'
            : 'Thiết bị đã có mạng lại. Cậu có thể tiếp tục thao tác.'}
        </span>
      </span>
    </section>
  )
}
