import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Droplets, Gauge } from 'lucide-react'
import { OfflineSyncBanner } from '@/components/common/OfflineSyncBanner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatCard } from '@/components/common/StatCard'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatKL, formatMonthLabel } from '@/lib/billing'
import { getDashboardBlocks } from '@/lib/roles'
import { getBlockDashboardStats, type BlockDashboardStats } from '@/services/readingsService'
import type { BlockId } from '@/types'
import { BLOCK_LABELS } from '@/types'

export function BlockDashboardPage() {
  const { user } = useAuth()
  const { selectedMonth, refreshKey } = useAppContext()
  const dashboardBlocks = useMemo(() => getDashboardBlocks(user), [user])
  const [activeBlock, setActiveBlock] = useState<BlockId>(dashboardBlocks[0] ?? 'A')
  const [stats, setStats] = useState<BlockDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (dashboardBlocks.length > 0 && !dashboardBlocks.includes(activeBlock)) {
      setActiveBlock(dashboardBlocks[0])
    }
  }, [dashboardBlocks, activeBlock])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getBlockDashboardStats(selectedMonth, activeBlock).then((s) => {
      if (!cancelled) {
        setStats(s)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedMonth, activeBlock, refreshKey])

  const progress =
    stats && stats.flatCount > 0
      ? Math.round((stats.completeCount / stats.flatCount) * 100)
      : 0

  return (
    <div>
      <OfflineSyncBanner />

      <PageHeader
        title="Block Dashboard"
        description={
          user?.role === 'meter_reader'
            ? `Meter reading progress for ${formatMonthLabel(selectedMonth)}`
            : `Block-wise reading status for ${formatMonthLabel(selectedMonth)}`
        }
        actions={
          <Link
            to="/readings"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            <Gauge className="h-4 w-4" />
            Enter Readings
          </Link>
        }
      />

      {dashboardBlocks.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Select block
          </p>
          <div className="flex flex-wrap gap-2">
            {dashboardBlocks.map((block) => (
              <button
                key={block}
                type="button"
                onClick={() => setActiveBlock(block)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeBlock === block
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {BLOCK_LABELS[block]}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading || !stats ? (
        <LoadingSpinner label="Loading block dashboard..." />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Block"
              value={BLOCK_LABELS[stats.block]}
              subtitle={`${stats.flatCount} flats assigned`}
              icon={ClipboardList}
              accent="sky"
            />
            <StatCard
              title="Readings Complete"
              value={`${stats.completeCount}/${stats.flatCount}`}
              subtitle={`${progress}% of block done`}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard
              title="Block Consumption"
              value={formatKL(stats.totalConsumptionKL)}
              subtitle={formatMonthLabel(selectedMonth)}
              icon={Droplets}
              accent="amber"
            />
            <StatCard
              title="Pending Flats"
              value={String(stats.pendingFlatLabels.length)}
              subtitle="Still need readings"
              icon={Gauge}
              accent="rose"
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              {BLOCK_LABELS[stats.block]} — flat status
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="pb-3 font-medium">Flat</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Consumption</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.flats.map((row) => (
                    <tr key={row.flat.id} className="border-b border-slate-50">
                      <td className="py-3 font-medium text-slate-900">{row.flat.label}</td>
                      <td className="py-3">
                        {row.hasReading ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {row.hasReading ? formatKL(row.consumptionKL) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
