import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Gauge, History, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { TimelineChart } from '@/components/charts/Charts'
import { FlatReadingTimeline } from '@/components/readings/FlatReadingTimeline'
import { useAppContext } from '@/context/AppContext'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { getFlatAnalytics } from '@/services/analyticsService'
import { getFlatReadingEntries, getFlats } from '@/services/readingsService'
import type { Flat, FlatAnalytics, MeterReading } from '@/types'
import { ALERT_LABELS } from '@/types'

export function FlatAnalyticsPage() {
  const { selectedMonth, refreshKey } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [flats, setFlats] = useState<Flat[]>([])
  const [selectedFlatId, setSelectedFlatId] = useState(searchParams.get('flat') ?? '')
  const [analytics, setAnalytics] = useState<FlatAnalytics | null>(null)
  const [readingEntries, setReadingEntries] = useState<MeterReading[]>([])
  const [timelineScope, setTimelineScope] = useState<'month' | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)

  useEffect(() => {
    void getFlats().then((f) => {
      setFlats(f)
      if (!selectedFlatId && f.length) setSelectedFlatId(f[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedFlatId) return
    setSearchParams({ flat: selectedFlatId })
    let cancelled = false
    setLoading(true)
    void getFlatAnalytics(selectedFlatId, selectedMonth).then((a) => {
      if (!cancelled) {
        setAnalytics(a)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedFlatId, selectedMonth, refreshKey, setSearchParams])

  useEffect(() => {
    if (!selectedFlatId) return
    let cancelled = false
    setEntriesLoading(true)
    const month = timelineScope === 'month' ? selectedMonth : undefined
    void getFlatReadingEntries(selectedFlatId, month).then((entries) => {
      if (!cancelled) {
        setReadingEntries(entries)
        setEntriesLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedFlatId, selectedMonth, timelineScope, refreshKey])

  const selectedFlat = flats.find((f) => f.id === selectedFlatId)

  if (!flats.length && loading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader
        title="Flat Analytics"
        description="Consumption trends, spike detection, and billing estimates"
        actions={
          <select
            value={selectedFlatId}
            onChange={(e) => setSelectedFlatId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium"
          >
            {flats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        }
      />

      {loading || !analytics ? (
        <LoadingSpinner label="Analyzing consumption..." />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Current Month"
              value={formatKL(analytics.currentConsumptionKL)}
              subtitle={formatMonthLabel(selectedMonth)}
              icon={Gauge}
            />
            <StatCard
              title="3-Month Average"
              value={formatKL(analytics.rolling3MonthAvgKL)}
              icon={TrendingUp}
              accent="emerald"
            />
            <StatCard
              title="Estimated Bill"
              value={formatCurrency(analytics.estimatedBill)}
              icon={TrendingUp}
              accent="amber"
            />
            <StatCard
              title="Efficiency Score"
              value={`${analytics.efficiencyScore}/100`}
              subtitle={`Block avg: ${formatKL(analytics.blockAvgKL)}`}
              icon={Gauge}
              accent="violet"
            />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Consumption Timeline</h2>
              <TimelineChart data={analytics.timeline} />
            </div>
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Comparisons</h2>
              <div className="space-y-3 text-sm">
                <ComparisonRow label="This flat" value={formatKL(analytics.currentConsumptionKL)} />
                <ComparisonRow label="Block average" value={formatKL(analytics.blockAvgKL)} />
                <ComparisonRow label="Society average" value={formatKL(analytics.societyAvgKL)} />
                <ComparisonRow
                  label="Est. tankers (next month)"
                  value={String(analytics.estimatedTankers)}
                />
              </div>
            </div>
          </div>

          {(analytics.spikes.length > 0 || analytics.anomalies.length > 0) && (
            <div className="mb-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Anomalies & Spikes
              </h2>
              <div className="space-y-2">
                {analytics.spikes.map((s) => (
                  <div
                    key={s.month}
                    className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  >
                    Spike in {formatMonthLabel(s.month)}: +{s.percentIncrease}%
                  </div>
                ))}
                {analytics.anomalies.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"
                  >
                    {ALERT_LABELS[a.type]}: {a.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <History className="h-4 w-4 text-sky-500" />
                Reading Timeline
              </h2>
              <div className="flex rounded-xl border border-slate-200 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTimelineScope('all')}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${
                    timelineScope === 'all'
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All history
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineScope('month')}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${
                    timelineScope === 'month'
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {formatMonthLabel(selectedMonth)}
                </button>
              </div>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Chronological view of every meter reading entry for{' '}
              <strong>{selectedFlat?.label ?? selectedFlatId}</strong>. Multiple entries in a month
              chain opening → closing; monthly billing uses the combined total.
            </p>
            {entriesLoading ? (
              <LoadingSpinner label="Loading reading history..." />
            ) : (
              <FlatReadingTimeline
                entries={readingEntries}
                emptyMessage={
                  timelineScope === 'month'
                    ? `No reading entries for ${formatMonthLabel(selectedMonth)}.`
                    : 'No reading entries recorded for this flat yet.'
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ComparisonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}
