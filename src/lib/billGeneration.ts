import type { BillingConfig } from '@/types'
import { formatMonthLabel } from '@/lib/billing'
import type { MonthRolloverStatus } from '@/lib/monthRollover'

export interface BillGenerationCheck {
  ok: boolean
  errors: string[]
}

export function canGenerateFlatBills(
  rollover: MonthRolloverStatus,
  config: BillingConfig | null,
): BillGenerationCheck {
  const errors: string[] = []

  if (!config) {
    errors.push('Save billing configuration (tanker count and rates) on the Billing page first.')
  } else if (config.locked) {
    errors.push('This month is already locked.')
  }

  if (!rollover.priorMonthComplete) {
    errors.push(
      `Complete readings for ${rollover.previousMonthLabel} before generating bills.`,
    )
  }

  if (rollover.mismatchCount > 0) {
    errors.push(
      `${rollover.mismatchCount} flat(s) have opening/closing mismatches — repair them on the Readings page.`,
    )
  }

  if (rollover.missingPriorCount > 0) {
    errors.push(
      `${rollover.missingPriorCount} flat(s) are missing prior-month readings.`,
    )
  }

  const billableCount = rollover.societyFlatCount - rollover.newFlatCount
  if (rollover.completeCount < billableCount) {
    const pending = billableCount - rollover.completeCount
    errors.push(
      `${pending} flat(s) still need readings for ${formatMonthLabel(rollover.month)}.`,
    )
  }

  return { ok: errors.length === 0, errors }
}
