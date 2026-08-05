import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import { formatMonthLabel } from '@/lib/billing'
import { acknowledgeAlert, getAlerts } from '@/services/analyticsService'
import type { Alert } from '@/types'
import { ALERT_LABELS } from '@/types'

const severityStyles = {
  low: 'bg-slate-50 text-slate-700 ring-slate-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  high: 'bg-rose-50 text-rose-800 ring-rose-200',
}

export function AlertsPage() {
  const { selectedMonth, refreshKey } = useAppContext()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setAlerts(await getAlerts(selectedMonth))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [selectedMonth, refreshKey])

  const handleAck = async (id: string) => {
    await acknowledgeAlert(id)
    await load()
  }

  if (loading) return <LoadingSpinner />

  const unacknowledged = alerts.filter((a) => !a.acknowledged)

  return (
    <div>
      <PageHeader
        title="Alerts"
        description={`Smart anomaly detection for ${formatMonthLabel(selectedMonth)}`}
      />

      {unacknowledged.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200/80">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">No active alerts for this month</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unacknowledged.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start justify-between gap-4 rounded-2xl p-5 ring-1 ${severityStyles[alert.severity]}`}
            >
              <div>
                <p className="font-semibold">{ALERT_LABELS[alert.type]}</p>
                <p className="mt-1 text-sm opacity-90">{alert.message}</p>
                <p className="mt-2 text-xs opacity-70">
                  {alert.flatLabel} · {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAck(alert.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium hover:bg-white"
              >
                <Check className="h-3 w-3" />
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
