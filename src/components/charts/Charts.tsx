import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SocietyStats } from '@/types'
import { BLOCK_LABELS, type BlockId } from '@/types'

interface ConsumptionChartProps {
  data: SocietyStats['dailyTrend']
}

export function DailyConsumptionChart({ data }: ConsumptionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(v: string) => v.split('-')[2] ?? v}
        />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit=" kL" />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
          formatter={(value) => [`${Number(value ?? 0).toFixed(2)} kL`, 'Consumption']}
        />
        <Area
          type="monotone"
          dataKey="consumptionKL"
          stroke="#0ea5e9"
          fill="url(#consumptionGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface BlockChartProps {
  blockConsumption: Record<BlockId, number>
}

const BLOCK_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6']

export function BlockComparisonChart({ blockConsumption }: BlockChartProps) {
  const data = (Object.keys(blockConsumption) as BlockId[]).map((block) => ({
    block: BLOCK_LABELS[block],
    consumptionKL: blockConsumption[block],
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="block" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit=" kL" />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
          formatter={(value) => [`${Number(value ?? 0).toFixed(2)} kL`, 'Consumption']}
        />
        <Bar dataKey="consumptionKL" radius={[8, 8, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BLOCK_COLORS[i % BLOCK_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface TimelineChartProps {
  data: Array<{ month: string; consumptionKL: number; bill?: number }>
}

export function TimelineChart({ data }: TimelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} unit=" kL" />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="consumptionKL"
          name="Consumption (kL)"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        {data.some((d) => d.bill !== undefined) && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="bill"
            name="Bill (₹)"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface HeatmapProps {
  data: Array<{ flatLabel: string; intensity: number; consumptionKL: number }>
}

export function LeakageHeatmap({ data }: HeatmapProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
      {data.map((item) => {
        const opacity = 0.15 + item.intensity * 0.85
        const isHigh = item.intensity > 0.7
        return (
          <div
            key={item.flatLabel}
            className="rounded-xl p-3 text-center ring-1 ring-slate-200"
            style={{ backgroundColor: `rgba(239, 68, 68, ${opacity})` }}
            title={`${item.flatLabel}: ${item.consumptionKL.toFixed(2)} kL`}
          >
            <p className="text-xs font-medium text-slate-700">{item.flatLabel}</p>
            <p className={`mt-1 text-sm font-semibold ${isHigh ? 'text-rose-700' : 'text-slate-600'}`}>
              {item.consumptionKL.toFixed(1)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
