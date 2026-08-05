import { calculateConsumption, litersToKL } from '@/lib/billing'
import type { MeterReading, MonthlyFlatSummary } from '@/types'

export function sortReadingsChronologically(readings: MeterReading[]): MeterReading[] {
  return [...readings].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function sortReadingsNewestFirst(readings: MeterReading[]): MeterReading[] {
  return [...readings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export interface MonthReadingGroup {
  month: string
  entries: MeterReading[]
  monthlyOpening: number
  monthlyClosing: number
  monthlyConsumptionKL: number
}

/** Group individual entries by billing month, newest month first. */
export function groupReadingsByMonth(readings: MeterReading[]): MonthReadingGroup[] {
  const byMonth = new Map<string, MeterReading[]>()
  for (const reading of readings) {
    const list = byMonth.get(reading.month) ?? []
    list.push(reading)
    byMonth.set(reading.month, list)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, entries]) => {
      const sorted = sortReadingsChronologically(entries)
      const summary = aggregateFlatMonth(sorted[0].flatId, month, readings)
      return {
        month,
        entries: sorted,
        monthlyOpening: summary?.openingReading ?? sorted[0].openingReading,
        monthlyClosing: summary?.closingReading ?? sorted[sorted.length - 1].closingReading,
        monthlyConsumptionKL: summary?.consumptionKL ?? sorted[sorted.length - 1].consumptionKL,
      }
    })
}

export function getFlatReadingsForMonth(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
): MeterReading[] {
  return sortReadingsChronologically(
    allReadings.filter((r) => r.flatId === flatId && r.month === month),
  )
}

/** Collapse multiple in-month entries into one billable monthly figure per flat. */
export function aggregateFlatMonth(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
): MonthlyFlatSummary | null {
  const entries = getFlatReadingsForMonth(flatId, month, allReadings)
  if (entries.length === 0) return null

  const first = entries[0]
  const last = entries[entries.length - 1]
  const consumptionLiters = calculateConsumption(first.openingReading, last.closingReading)

  return {
    flatId,
    month,
    openingReading: first.openingReading,
    closingReading: last.closingReading,
    consumptionLiters,
    consumptionKL: litersToKL(consumptionLiters),
    readingCount: entries.length,
    lastUpdated: last.updatedAt,
    enteredBy: last.enteredBy,
    readings: entries,
  }
}

export function aggregateMonthlyReadings(
  month: string,
  allReadings: MeterReading[],
): MonthlyFlatSummary[] {
  const flatIds = [...new Set(allReadings.filter((r) => r.month === month).map((r) => r.flatId))]
  return flatIds
    .map((flatId) => aggregateFlatMonth(flatId, month, allReadings))
    .filter((s): s is MonthlyFlatSummary => s !== null)
    .sort((a, b) => a.flatId.localeCompare(b.flatId))
}

/** Shape expected by the billing engine — monthly totals only. */
export function summaryToBillingReading(summary: MonthlyFlatSummary): MeterReading {
  const last = summary.readings[summary.readings.length - 1]
  return {
    id: `summary-${summary.flatId}-${summary.month}`,
    flatId: summary.flatId,
    month: summary.month,
    openingReading: summary.openingReading,
    closingReading: summary.closingReading,
    consumptionLiters: summary.consumptionLiters,
    consumptionKL: summary.consumptionKL,
    enteredBy: summary.enteredBy,
    enteredByRole: last?.enteredByRole ?? 'admin',
    createdAt: summary.readings[0]?.createdAt ?? summary.lastUpdated,
    updatedAt: summary.lastUpdated,
    auditTrail: [],
  }
}
