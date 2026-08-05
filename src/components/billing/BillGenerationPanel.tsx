import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import { formatCurrency, formatMonthLabel } from '@/lib/billing'
import type { BillGenerationCheck } from '@/lib/billGeneration'
import type { BillingConfig } from '@/types'

interface BillGenerationPanelProps {
  month: string
  validation: BillGenerationCheck
  config: BillingConfig | null
  billCount: number
  totalAmount: number
  generating: boolean
  onGenerate: () => void
}

export function BillGenerationPanel({
  month,
  validation,
  config,
  billCount,
  totalAmount,
  generating,
  onGenerate,
}: BillGenerationPanelProps) {
  if (config?.locked) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">
            Bills locked for {formatMonthLabel(month)}
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {billCount} flat bills generated
            {config.billsGeneratedAt
              ? ` on ${new Date(config.billsGeneratedAt).toLocaleString()}`
              : ''}
            {config.billsGeneratedBy ? ` by ${config.billsGeneratedBy}` : ''}.
            Readings and billing config for this month can no longer be changed.
          </p>
        </div>
      </div>
    )
  }

  if (validation.ok) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">Ready to generate bills</p>
              <p className="mt-1 text-sm text-emerald-800">
                {billCount} flats · {formatCurrency(totalAmount)} total · preview below is
                live until you generate and lock.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={generating || billCount === 0}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            {generating ? 'Generating…' : 'Generate & Lock Bills'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">Cannot generate bills yet</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {billCount > 0 && (
            <p className="mt-3 text-sm text-amber-800">
              Preview below shows {billCount} flats with readings ({formatCurrency(totalAmount)}{' '}
              total) — resolve the issues above before locking.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
