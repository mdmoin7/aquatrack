import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { canAcknowledgeNotification } from '@/services/notificationService'
import type { Alert, User } from '@/types'
import { ALERT_LABELS } from '@/types'

const severityStyles = {
  low: 'bg-slate-50 text-slate-700 ring-slate-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  high: 'bg-rose-50 text-rose-800 ring-rose-200',
} as const

type NotificationCardProps = {
  alert: Alert
  user: User | null
  onAcknowledge?: (id: string) => void
  compact?: boolean
}

export function NotificationCard({
  alert,
  user,
  onAcknowledge,
  compact = false,
}: NotificationCardProps) {
  const showAcknowledge =
    !alert.acknowledged && onAcknowledge && canAcknowledgeNotification(user, alert)

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl ring-1 ${severityStyles[alert.severity]} ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold">{ALERT_LABELS[alert.type]}</p>
        <p className={`mt-1 opacity-90 ${compact ? 'text-xs' : 'text-sm'}`}>{alert.message}</p>
        <p className="mt-2 text-xs opacity-70">
          {alert.flatLabel} · {new Date(alert.createdAt).toLocaleString()}
          {alert.acknowledged && ' · Acknowledged'}
        </p>
      </div>
      {showAcknowledge && (
        <div className="flex shrink-0 flex-col items-end gap-2">
          {alert.type === 'tanker_procurement_update' && (
            <Link
              to="/procurement"
              className="inline-flex items-center rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium hover:bg-white"
            >
              View Procurement
            </Link>
          )}
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium hover:bg-white"
          >
            <Check className="h-3 w-3" />
            Acknowledge
          </button>
        </div>
      )}
    </div>
  )
}
