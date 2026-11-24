import { calculateConsumption, litersToKL } from '@/lib/billing'
import type { MeterConsumptionSegment, MeterReading, MonthlyFlatSummary, WaterMeter } from '@/types'

export function sortReadingsChronologically(readings: MeterReading[]): MeterReading[] {
  return [...readings].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function sortReadingsNewestFirst(readings: MeterReading[]): MeterReading[] {
  return [...readings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function meterSerial(meterId: string | undefined, meters: WaterMeter[]): string {
  if (!meterId) return 'Unknown meter'
  return meters.find((meter) => meter.id === meterId)?.serialNumber ?? 'Unknown meter'
}

export function formatMeterBreakdown(segments: MeterConsumptionSegment[] | undefined): string {
  if (!segments || segments.length <= 1) return ''
  return segments
    .map(
      (segment) =>
        `${segment.serialNumber} ${segment.openingReading.toLocaleString()}→${segment.closingReading.toLocaleString()} L (${segment.consumptionLiters.toLocaleString()} L)`,
    )
    .join(' | ')
}

/** Monthly total when a new closing is added on one meter, keeping other meters' usage. */
export function projectMonthConsumptionLiters(
  summary: MonthlyFlatSummary | undefined,
  meterId: string | undefined,
  opening: number,
  closing: number,
): number {
  if (!summary?.meterSegments?.length) return calculateConsumption(opening, closing)
  if (summary.meterSegments.length === 1) {
    return calculateConsumption(summary.meterSegments[0].openingReading, closing)
  }
  const others = summary.meterSegments.filter((segment) => segment.meterId !== meterId)
  const active = summary.meterSegments.find((segment) => segment.meterId === meterId)
  const activeTotal = calculateConsumption(active?.openingReading ?? opening, closing)
  return others.reduce((sum, segment) => sum + segment.consumptionLiters, 0) + activeTotal
}

export interface MonthReadingGroup {
  month: string
  entries: MeterReading[]
  monthlyOpening: number
  monthlyClosing: number
  monthlyConsumptionKL: number
  meterSegments: MeterConsumptionSegment[]
}

/** Group individual entries by billing month, newest month first. */
export function groupReadingsByMonth(
  readings: MeterReading[],
  meters: WaterMeter[] = [],
): MonthReadingGroup[] {
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
      const summary = aggregateFlatMonth(sorted[0].flatId, month, readings, meters)
      return {
        month,
        entries: sorted,
        monthlyOpening: summary?.openingReading ?? sorted[0].openingReading,
        monthlyClosing: summary?.closingReading ?? sorted[sorted.length - 1].closingReading,
        monthlyConsumptionKL: summary?.consumptionKL ?? sorted[sorted.length - 1].consumptionKL,
        meterSegments: summary?.meterSegments ?? [],
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

export function readingsForMeter(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
  meterId?: string,
): MeterReading[] {
  return getFlatReadingsForMonth(flatId, month, allReadings).filter(
    (reading) => !meterId || !reading.meterId || reading.meterId === meterId,
  )
}

function segmentKey(reading: MeterReading): string {
  return reading.meterId ?? `unstamped-${reading.flatId}`
}

/** Collapse in-month entries into one billable figure. Usage is summed per physical meter. */
export function aggregateFlatMonth(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
  meters: WaterMeter[] = [],
): MonthlyFlatSummary | null {
  const entries = getFlatReadingsForMonth(flatId, month, allReadings)
  if (entries.length === 0) return null

  const groups = new Map<string, MeterReading[]>()
  for (const reading of entries) {
    const key = segmentKey(reading)
    const list = groups.get(key) ?? []
    list.push(reading)
    groups.set(key, list)
  }

  const meterSegments: MeterConsumptionSegment[] = [...groups.entries()]
    .map(([meterId, group]) => {
      const sorted = sortReadingsChronologically(group)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const consumptionLiters = calculateConsumption(first.openingReading, last.closingReading)
      return {
        meterId: first.meterId ?? meterId,
        serialNumber: meterSerial(first.meterId, meters),
        openingReading: first.openingReading,
        closingReading: last.closingReading,
        consumptionLiters,
        consumptionKL: litersToKL(consumptionLiters),
        startedAt: first.createdAt,
      }
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((segment) => ({
      meterId: segment.meterId,
      serialNumber: segment.serialNumber,
      openingReading: segment.openingReading,
      closingReading: segment.closingReading,
      consumptionLiters: segment.consumptionLiters,
      consumptionKL: segment.consumptionKL,
    }))

  const consumptionLiters = meterSegments.reduce((sum, segment) => sum + segment.consumptionLiters, 0)
  const active = meters.find((meter) => meter.flatId === flatId && meter.status === 'active')
  const primary =
    meterSegments.length === 1
      ? meterSegments[0]
      : (meterSegments.find((segment) => segment.meterId === active?.id) ??
        meterSegments[meterSegments.length - 1])
  const last = entries[entries.length - 1]

  return {
    flatId,
    month,
    openingReading: primary.openingReading,
    closingReading: primary.closingReading,
    consumptionLiters,
    consumptionKL: litersToKL(consumptionLiters),
    readingCount: entries.length,
    lastUpdated: last.updatedAt,
    enteredBy: last.enteredBy,
    readings: entries,
    meterSegments,
  }
}

export function aggregateMonthlyReadings(
  month: string,
  allReadings: MeterReading[],
  meters: WaterMeter[] = [],
): MonthlyFlatSummary[] {
  const flatIds = [...new Set(allReadings.filter((r) => r.month === month).map((r) => r.flatId))]
  return flatIds
    .map((flatId) => aggregateFlatMonth(flatId, month, allReadings, meters))
    .filter((s): s is MonthlyFlatSummary => s !== null)
    .sort((a, b) => a.flatId.localeCompare(b.flatId))
}

/** Shape expected by the billing engine — monthly totals only. */
export function summaryToBillingReading(summary: MonthlyFlatSummary): MeterReading {
  const last = summary.readings[summary.readings.length - 1]
  const activeSegment = summary.meterSegments[summary.meterSegments.length - 1]
  return {
    id: `summary-${summary.flatId}-${summary.month}`,
    flatId: summary.flatId,
    month: summary.month,
    meterId: activeSegment?.meterId ?? last?.meterId,
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
