import { Icon } from './AppLayout'

export default function DataRecoveryState({
  title = 'Chưa tải được dữ liệu',
  message,
  onRetry,
  isRetrying = false,
}) {
  return (
    <section className="data-recovery-state" role="alert" aria-live="assertive">
      <span className="data-recovery-icon" aria-hidden="true"><Icon name="spark" /></span>
      <div>
        <p>TẠM THỜI GIÁN ĐOẠN</p>
        <h2>{title}</h2>
        <span>{message}</span>
      </div>
      <button type="button" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? 'Đang thử lại…' : 'Thử lại'}
        <Icon name="arrow" />
      </button>
    </section>
  )
}
