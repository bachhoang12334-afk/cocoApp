import { getTrustSignal } from '../lib/trustSignals'

export default function TrustBadge({ profile, compact = false }) {
  const signal = getTrustSignal(profile)

  return (
    <span
      className={`trust-badge trust-badge-${signal.key}${compact ? ' is-compact' : ''}`}
      aria-label={`${signal.label}. ${signal.description}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 19 6v5c0 4.7-2.8 8.2-7 10-4.2-1.8-7-5.3-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
      <span>{signal.label}</span>
    </span>
  )
}
