import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { formatMonthLabel } from '@/lib/billing'
import type { MonthRolloverStatus } from '@/lib/monthRollover'
import { repairAllRolloverMismatches } from '@/services/readingsService'

interface MonthRolloverPanelProps {
  status: MonthRolloverStatus
  onRepaired: () => void
  readOnly?: boolean
}

export function MonthRolloverPanel({ status, onRepaired, readOnly = false }: MonthRolloverPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [repairError, setRepairError] = useState('')

  const issueFlats = status.flats.filter(
    (f) => f.status === 'missing_prior' || f.status === 'mismatch',
  )
  const hasIssues = issueFlats.length > 0 || !status.priorMonthComplete
  const allComplete = status.completeCount === status.societyFlatCount

  const handleRepair = async () => {
    setRepairError('')
    setRepairing(true)
    try {
      const fixed = await repairAllRolloverMismatches(status.month)
      if (fixed === 0) {
        setRepairError('No opening mismatches to fix.')
      } else {
        onRepaired()
      }
    } catch (e) {
      setRepairError(e instanceof Error ? e.message : 'Repair failed')
    } finally {
      setRepairing(false)
    }
  }

  if (allComplete && !hasIssues) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-900">
            {formatMonthLabel(status.month)} readings complete
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            All {status.societyFlatCount} flats have readings for this month.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`mb-6 rounded-2xl border px-5 py-4 ${
        hasIssues
          ? 'border-amber-200 bg-amber-50'
          : 'border-sky-100 bg-sky-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {hasIssues ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          )}
          <div>
            <p className={`font-medium ${hasIssues ? 'text-amber-900' : 'text-sky-900'}`}>
              Month rollover — {formatMonthLabel(status.month)}
            </p>
            <p className={`mt-1 text-sm ${hasIssues ? 'text-amber-800' : 'text-sky-800'}`}>
              Opening readings carry forward from {status.previousMonthLabel} closing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!readOnly && status.mismatchCount > 0 && (
            <button
              type="button"
              onClick={() => void handleRepair()}
              disabled={repairing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${repairing ? 'animate-spin' : ''}`} />
              Fix {status.mismatchCount} mismatch{status.mismatchCount === 1 ? '' : 'es'}
            </button>
          )}
          {issueFlats.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white/60"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide' : 'Show'} issues ({issueFlats.length})
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Prior month flats" value={`${status.priorMonthFlatCount}`} />
        <Stat label="Ready to enter" value={String(status.readyCount)} accent="sky" />
        <Stat label="Entered" value={String(status.completeCount)} accent="emerald" />
        <Stat
          label="Missing prior"
          value={String(status.missingPriorCount)}
          accent={status.missingPriorCount > 0 ? 'amber' : undefined}
        />
        <Stat
          label="Opening mismatch"
          value={String(status.mismatchCount)}
          accent={status.mismatchCount > 0 ? 'rose' : undefined}
        />
      </div>

      {!status.priorMonthComplete && (
        <p className="mt-3 text-sm text-amber-800">
          {status.previousMonthLabel} is incomplete — some flats have older readings but no closing
          for the prior month. Finish that month before rolling forward.
        </p>
      )}

      {repairError && <p className="mt-2 text-sm text-rose-600">{repairError}</p>}

      {expanded && issueFlats.length > 0 && (
        <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-amber-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Flat</th>
                <th className="px-3 py-2 font-medium">Issue</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issueFlats.map((flat) => (
                <tr key={flat.flatId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{flat.flatLabel}</td>
                  <td className="px-3 py-2 capitalize text-slate-600">
                    {flat.status.replace('_', ' ')}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {flat.status === 'missing_prior' &&
                      `No ${status.previousMonthLabel} closing`}
                    {flat.status === 'mismatch' &&
                      `Expected ${flat.expectedOpening?.toLocaleString()} L, got ${flat.actualOpening?.toLocaleString()} L`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'sky' | 'emerald' | 'amber' | 'rose'
}) {
  const colors = {
    sky: 'text-sky-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${accent ? colors[accent] : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
