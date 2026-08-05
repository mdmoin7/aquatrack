import type { Alert, Flat } from '@/types'
import { formatMonthLabel } from '@/lib/billing'
import { getBillingConfig } from '@/services/billingService'
import { getFlats, getMonthlySummaries } from '@/services/readingsService'
import { getProcurementSummary } from '@/services/tankerService'

const SOCIETY_FLAT_ID = 'society'

/** True when `date` falls on the last calendar day of the billing month (YYYY-MM). */
export function isLastDayOfBillingMonth(billingMonth: string, date = new Date()): boolean {
  const [year, month] = billingMonth.split('-').map(Number)
  if (!year || !month) return false
  const lastDay = new Date(year, month, 0).getDate()
  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === lastDay
  )
}

export async function buildSuperAdminOperationalAlerts(
  month: string,
  flat: Flat,
  enteredBy: string,
): Promise<Alert[]> {
  const alerts: Alert[] = []
  const now = new Date().toISOString()
  const societyBase = {
    flatId: SOCIETY_FLAT_ID,
    flatLabel: 'Society',
    month,
    audience: 'superadmin' as const,
    acknowledged: false,
  }

  if (isLastDayOfBillingMonth(month)) {
    const [summaries, flats] = await Promise.all([getMonthlySummaries(month), getFlats()])
    const withReadings = summaries.filter((s) => s.readingCount > 0).length
    alerts.push({
      ...societyBase,
      id: `${month}-month-end-reading`,
      type: 'month_end_reading',
      message: `Month-end reading saved for ${flat.label} by ${enteredBy}. ${withReadings}/${flats.length} flats have readings for ${formatMonthLabel(month)}.`,
      severity: withReadings >= flats.length ? 'low' : 'medium',
      createdAt: now,
    })
  }

  const [summary, config] = await Promise.all([
    getProcurementSummary(month),
    getBillingConfig(month),
  ])

  const billingTankers = config?.tankerCount ?? 0
  const requiredTankers = summary.requiredTankers
  const needsProcurementUpdate =
    requiredTankers > 0 &&
    (requiredTankers !== billingTankers || summary.procurementGapTankers > 0)

  if (needsProcurementUpdate) {
    const gapPart =
      summary.procurementGapTankers > 0
        ? ` Procurement gap: ${summary.procurementGapTankers} tanker(s) (${Math.round(summary.procurementGapLiters).toLocaleString()} L).`
        : ''
    alerts.push({
      ...societyBase,
      id: `${month}-tanker-procurement-update`,
      type: 'tanker_procurement_update',
      message: `Readings require ${requiredTankers} tanker(s) for ${formatMonthLabel(month)} but billing config has ${billingTankers}.${gapPart} Update total tankers on Tanker Procurement.`,
      severity: summary.procurementGapTankers > 0 ? 'high' : 'medium',
      createdAt: now,
    })
  }

  return alerts
}
