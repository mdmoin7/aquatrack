import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Droplets,
  IndianRupee,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react'
import { CloudSetupBanner } from '@/components/common/CloudSetupBanner'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  BlockComparisonChart,
  DailyConsumptionChart,
  LeakageHeatmap,
} from '@/components/charts/Charts'
import { useAppContext } from '@/context/AppContext'
import { formatCurrency, formatKL, formatMonthLabel } from '@/lib/billing'
import { getSocietyStats } from '@/services/billingService'
import { getFlats, getMonthlySummaries } from '@/services/readingsService'
import type { BlockId, Flat, SocietyStats } from '@/types'
import { BLOCK_LABELS } from '@/types'

export function DashboardPage() {
  const { selectedMonth, refreshKey } = useAppContext()
  const [stats, setStats] = useState<SocietyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getSocietyStats(selectedMonth).then((s) => {
      if (!cancelled) {
        setStats(s)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedMonth, refreshKey])

  if (loading || !stats) return <LoadingSpinner label="Loading dashboard..." />

  return (
    <div>
      <CloudSetupBanner />
      <PageHeader
        title="Society Dashboard"
        description={`Overview for ${formatMonthLabel(selectedMonth)}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Consumption"
          value={formatKL(stats.totalConsumptionKL)}
          subtitle={`${stats.flatCount} flats monitored`}
          icon={Droplets}
          accent="sky"
        />
        <StatCard
          title="Water Cost"
          value={formatCurrency(stats.totalWaterCost)}
          subtitle={`${stats.tankerCount} tankers`}
          icon={Truck}
          accent="amber"
        />
        <StatCard
          title="Effective Rate"
          value={`${formatCurrency(stats.effectiveRatePerKL)}/kL`}
          subtitle="Based on actual tanker purchases"
          icon={IndianRupee}
          accent="emerald"
        />
        <StatCard
          title="Top Consumer"
          value={stats.topConsumers[0]?.flat.label ?? '—'}
          subtitle={
            stats.topConsumers[0]
              ? formatKL(stats.topConsumers[0].consumptionKL)
              : 'No data'
          }
          icon={TrendingUp}
          accent="rose"
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Daily Consumption Trend</h2>
          <DailyConsumptionChart data={stats.dailyTrend} />
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Block Comparison</h2>
          <BlockComparisonChart blockConsumption={stats.blockConsumption} />
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 lg:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="h-4 w-4 text-sky-500" />
            Block-wise Consumption
          </h2>
          <div className="space-y-3">
            {(Object.keys(stats.blockConsumption) as BlockId[]).map((block) => (
              <div key={block} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{BLOCK_LABELS[block]}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatKL(stats.blockConsumption[block])}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Top Consuming Flats</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-3 font-medium">Rank</th>
                  <th className="pb-3 font-medium">Flat</th>
                  <th className="pb-3 font-medium">Block</th>
                  <th className="pb-3 text-right font-medium">Consumption</th>
                </tr>
              </thead>
              <tbody>
                {stats.topConsumers.map((item, i) => (
                  <tr key={item.flat.id} className="border-b border-slate-50">
                    <td className="py-3 text-slate-400">#{i + 1}</td>
                    <td className="py-3">
                      <Link
                        to={`/analytics?flat=${item.flat.id}`}
                        className="font-medium text-sky-600 hover:underline"
                      >
                        {item.flat.label}
                      </Link>
                    </td>
                    <td className="py-3 text-slate-600">{BLOCK_LABELS[item.flat.block]}</td>
                    <td className="py-3 text-right font-semibold text-slate-900">
                      {formatKL(item.consumptionKL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Leakage Heatmap</h2>
        <HeatmapSection month={selectedMonth} blockConsumption={stats.blockConsumption} />
      </div>
    </div>
  )
}

function HeatmapSection({
  month,
  blockConsumption,
}: {
  month: string
  blockConsumption: Record<BlockId, number>
}) {
  const [heatmap, setHeatmap] = useState<Array<{ flatLabel: string; intensity: number; consumptionKL: number }>>([])

  useEffect(() => {
    void Promise.all([getFlats(), getMonthlySummaries(month)]).then(([flats, summaries]) => {
      const blockAvgs: Record<string, number> = {}
      for (const block of Object.keys(blockConsumption)) {
        const count = flats.filter((f) => f.block === block).length
        blockAvgs[block] = count > 0 ? blockConsumption[block as BlockId] / count : 0
      }
      const data = summaries.map((summary) => {
        const flat = flats.find((f) => f.id === summary.flatId)
        if (!flat) return null
        const consumptionKL = summary.consumptionKL
        const blockAvg = blockAvgs[flat.block] ?? 1
        const ratio = blockAvg > 0 ? consumptionKL / blockAvg : 0
        const intensity = Math.min(1, ratio / 2)
        return { flat, intensity, consumptionKL }
      }).filter((d): d is { flat: Flat; intensity: number; consumptionKL: number } => d !== null)
      setHeatmap(
        data.map((d) => ({
          flatLabel: d.flat.label,
          intensity: d.intensity,
          consumptionKL: d.consumptionKL,
        })),
      )
    })
  }, [month, blockConsumption])

  return <LeakageHeatmap data={heatmap} />
}
