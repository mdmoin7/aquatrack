import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: { value: string; positive?: boolean }
  accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet'
}

const accentClasses = {
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent = 'sky',
}: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          {trend && (
            <p
              className={`mt-2 text-xs font-medium ${
                trend.positive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div className={`rounded-xl p-3 ring-1 ${accentClasses[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
