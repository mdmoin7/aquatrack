import { useEffect, useState } from 'react'
import { Bell, Droplets, FileText, History, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { TimelineChart } from '@/components/charts/Charts'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { FlatReadingTimeline } from '@/components/readings/FlatReadingTimeline'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { getFlatAnalytics } from '@/services/analyticsService'
import { getFlatBillHistory } from '@/services/billingService'
import { getFlatReadingEntries } from '@/services/readingsService'
import type { FlatAnalytics, FlatBill, MeterReading } from '@/types'

export function ResidentPage() {
  const { user } = useAuth()
  const { selectedMonth, refreshKey } = useAppContext()
  const { active: alerts, acknowledge } = useNotifications()
  const [analytics, setAnalytics] = useState<FlatAnalytics | null>(null)
  const [history, setHistory] = useState<FlatBill[]>([])
  const [loading, setLoading] = useState(true)

  const [readingEntries, setReadingEntries] = useState<MeterReading[]>([])

  const flatId = user?.flatId ?? 'A001'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([
      getFlatAnalytics(flatId, selectedMonth),
      getFlatBillHistory(flatId),
      getFlatReadingEntries(flatId),
    ]).then(([a, h, entries]) => {
      if (!cancelled) {
        setAnalytics(a)
        setHistory(h)
        setReadingEntries(entries)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [flatId, selectedMonth, refreshKey])

  if (loading || !analytics) return <LoadingSpinner label="Loading your consumption..." />

  const currentInvoice = history.find((h) => h.month === selectedMonth)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.displayName}`}
        description={`Your water consumption for ${formatMonthLabel(selectedMonth)}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="This Month"
          value={formatKL(analytics.currentConsumptionKL)}
          icon={Droplets}
        />
        <StatCard
          title="Estimated Bill"
          value={formatCurrency(analytics.estimatedBill)}
          icon={FileText}
          accent="amber"
        />
        <StatCard
          title="3-Month Average"
          value={formatKL(analytics.rolling3MonthAvgKL)}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          title="Efficiency Score"
          value={`${analytics.efficiencyScore}/100`}
          subtitle="vs block & society average"
          icon={TrendingUp}
          accent="violet"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Consumption Trend</h2>
          <TimelineChart data={analytics.timeline} />
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Current Invoice</h2>
          {currentInvoice ? (
            <div className="space-y-3 text-sm">
              <InvoiceRow label="Opening Reading" value={`${currentInvoice.openingReading} L`} />
              <InvoiceRow label="Closing Reading" value={`${currentInvoice.closingReading} L`} />
              <InvoiceRow label="Consumption" value={formatKL(currentInvoice.consumptionKL)} />
              <InvoiceRow
                label="Effective Rate"
                value={`${formatCurrency(currentInvoice.effectiveRatePerKL)}/kL`}
              />
              <InvoiceRow
                label="Water Charge"
                value={formatCurrency(currentInvoice.waterCharge)}
              />
              <InvoiceRow
                label="Maintenance"
                value={formatCurrency(currentInvoice.maintenanceShare)}
              />
              <div className="border-t border-slate-100 pt-3">
                <InvoiceRow
                  label="Total Bill"
                  value={formatCurrency(currentInvoice.finalBill)}
                  bold
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No invoice available for this month yet.</p>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-sky-500" />
          My Reading Timeline
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Every meter reading recorded for your flat, grouped by billing month.
        </p>
        <FlatReadingTimeline entries={readingEntries} />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bell className="h-4 w-4 text-amber-500" />
            Notifications
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <NotificationCard
                key={alert.id}
                alert={alert}
                user={user}
                compact
                onAcknowledge={(id) => void acknowledge(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-800'}>{value}</span>
    </div>
  )
}
