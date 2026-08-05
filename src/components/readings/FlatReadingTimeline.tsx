import { Calendar, Gauge, User } from 'lucide-react'
import { formatKL, formatMonthLabel, litersToKL } from '@/lib/billing'
import { groupReadingsByMonth } from '@/lib/readings'
import type { MeterReading } from '@/types'

interface FlatReadingTimelineProps {
  entries: MeterReading[]
  flatLabel?: string
  emptyMessage?: string
}

export function FlatReadingTimeline({
  entries,
  flatLabel,
  emptyMessage = 'No reading entries recorded yet.',
}: FlatReadingTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    )
  }

  const groups = groupReadingsByMonth(entries)

  return (
    <div className="space-y-8">
      {flatLabel && (
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{flatLabel}</p>
      )}
      {groups.map((group) => (
        <MonthGroup key={group.month} group={group} />
      ))}
    </div>
  )
}

function MonthGroup({
  group,
}: {
  group: ReturnType<typeof groupReadingsByMonth>[number]
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900">{formatMonthLabel(group.month)}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {group.entries.length} entr{group.entries.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
        <div className="text-xs text-slate-500">
          Monthly billable:{' '}
          <span className="font-semibold text-sky-700">{formatKL(group.monthlyConsumptionKL)}</span>
          <span className="mx-1 text-slate-300">·</span>
          {group.monthlyOpening.toLocaleString()} → {group.monthlyClosing.toLocaleString()} L
        </div>
      </div>

      <ol className="relative space-y-0 border-l-2 border-slate-200 pl-6">
        {[...group.entries].reverse().map((entry, idx) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            entryNumber={group.entries.length - idx}
            isLast={idx === group.entries.length - 1}
          />
        ))}
      </ol>
    </section>
  )
}

function TimelineEntry({
  entry,
  entryNumber,
  isLast,
}: {
  entry: MeterReading
  entryNumber: number
  isLast: boolean
}) {
  const date = new Date(entry.createdAt)
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const formattedTime = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li className={`relative ${isLast ? '' : 'pb-6'}`}>
      <span className="absolute -left-[1.9rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-sky-500 ring-2 ring-sky-100" />

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
              Entry #{entryNumber}
            </span>
            <span className="text-xs text-slate-400">
              {formattedDate} · {formattedTime}
            </span>
          </div>
          <span className="text-sm font-semibold text-emerald-700">
            {formatKL(entry.consumptionKL)}
          </span>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <ReadingStat
            icon={Gauge}
            label="Opening"
            value={`${entry.openingReading.toLocaleString()} L`}
          />
          <ReadingStat
            icon={Gauge}
            label="Closing"
            value={`${entry.closingReading.toLocaleString()} L`}
          />
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-50 pt-3 text-xs text-slate-500">
          <User className="h-3.5 w-3.5" />
          <span>
            {entry.enteredBy}
            <span className="text-slate-300"> · </span>
            <span className="capitalize">{entry.enteredByRole}</span>
          </span>
          <span className="ml-auto text-slate-400">
            {entry.consumptionLiters.toLocaleString()} L ({litersToKL(entry.consumptionLiters)} kL)
          </span>
        </div>
      </div>
    </li>
  )
}

function ReadingStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="ml-auto font-medium text-slate-800">{value}</span>
    </div>
  )
}
