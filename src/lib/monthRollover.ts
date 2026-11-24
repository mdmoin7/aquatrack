import type { Flat, MeterReading, WaterMeter } from '@/types'
import { formatMonthLabel, getPreviousMonth } from '@/lib/billing'
import { readingsForMeter } from '@/lib/readings'

export type FlatRolloverStatus =
  | 'complete'
  | 'ready'
  | 'mismatch'
  | 'missing_prior'
  | 'new_flat'

export interface FlatRolloverInfo {
  flatId: string
  flatLabel: string
  status: FlatRolloverStatus
  previousMonth: string
  previousClosing?: number
  expectedOpening?: number
  actualOpening?: number
}

export interface MonthRolloverStatus {
  month: string
  previousMonth: string
  previousMonthLabel: string
  priorMonthFlatCount: number
  societyFlatCount: number
  priorMonthComplete: boolean
  readyCount: number
  completeCount: number
  mismatchCount: number
  missingPriorCount: number
  newFlatCount: number
  flats: FlatRolloverInfo[]
}

function flatHadReadingBeforeMonth(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
): boolean {
  return allReadings.some((r) => r.flatId === flatId && r.month < month)
}

function activeMeter(meters: WaterMeter[], flatId: string): WaterMeter | undefined {
  return meters.find((meter) => meter.flatId === flatId && meter.status === 'active')
}

/** Opening the active meter should use this month. A new dial does not inherit the removed meter's closing. */
function expectedActiveOpening(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
  meter: WaterMeter | undefined,
): { expected?: number; previousClosing?: number; missingPrior: boolean } {
  if (!meter) return { missingPrior: false }
  const previousMonth = getPreviousMonth(month)
  const previousEntries = readingsForMeter(flatId, previousMonth, allReadings, meter.id)
  if (previousEntries.length > 0) {
    const closing = previousEntries[previousEntries.length - 1].closingReading
    return { expected: closing, previousClosing: closing, missingPrior: false }
  }
  const earlierOnMeter = allReadings.some(
    (reading) => reading.flatId === flatId && reading.meterId === meter.id && reading.month < previousMonth,
  )
  if (earlierOnMeter) return { missingPrior: true }
  return { expected: meter.startReading, missingPrior: false }
}

export function buildFlatRolloverInfo(
  flat: Flat,
  month: string,
  allReadings: MeterReading[],
  meters: WaterMeter[] = [],
): FlatRolloverInfo {
  const previousMonth = getPreviousMonth(month)
  const meter = activeMeter(meters, flat.id)
  const currentEntries = readingsForMeter(flat.id, month, allReadings, meter?.id)
  const expected = expectedActiveOpening(flat.id, month, allReadings, meter)
  const hadEarlierHistory = flatHadReadingBeforeMonth(flat.id, previousMonth, allReadings)

  const base = {
    flatId: flat.id,
    flatLabel: flat.label,
    previousMonth,
  }

  if (currentEntries.length > 0) {
    const first = currentEntries[0]
    if (expected.expected !== undefined && first.openingReading !== expected.expected) {
      return {
        ...base,
        status: 'mismatch',
        previousClosing: expected.previousClosing,
        expectedOpening: expected.expected,
        actualOpening: first.openingReading,
      }
    }
    return {
      ...base,
      status: 'complete',
      previousClosing: expected.previousClosing,
      expectedOpening: first.openingReading,
      actualOpening: first.openingReading,
    }
  }

  if (expected.missingPrior) {
    return { ...base, status: 'missing_prior' }
  }

  if (expected.expected !== undefined && (expected.previousClosing !== undefined || hadEarlierHistory)) {
    return {
      ...base,
      status: 'ready',
      previousClosing: expected.previousClosing,
      expectedOpening: expected.expected,
    }
  }

  if (hadEarlierHistory) {
    return { ...base, status: 'missing_prior' }
  }

  return { ...base, status: 'new_flat' }
}

export function buildMonthRolloverStatus(
  month: string,
  flats: Flat[],
  allReadings: MeterReading[],
  meters: WaterMeter[] = [],
): MonthRolloverStatus {
  const previousMonth = getPreviousMonth(month)
  const flatInfos = flats.map((flat) => buildFlatRolloverInfo(flat, month, allReadings, meters))
  const priorMonthFlatCount = new Set(
    allReadings.filter((r) => r.month === previousMonth).map((r) => r.flatId),
  ).size

  const counts = {
    ready: 0,
    complete: 0,
    mismatch: 0,
    missing_prior: 0,
    new_flat: 0,
  }
  for (const info of flatInfos) counts[info.status]++

  const flatsNeedingPrior = new Set(
    allReadings.filter((r) => r.month < previousMonth).map((r) => r.flatId),
  )
  const priorMonthComplete =
    flatsNeedingPrior.size === 0 ||
    [...flatsNeedingPrior].every((flatId) =>
      allReadings.some((r) => r.flatId === flatId && r.month === previousMonth),
    )

  return {
    month,
    previousMonth,
    previousMonthLabel: formatMonthLabel(previousMonth),
    priorMonthFlatCount,
    societyFlatCount: flats.length,
    priorMonthComplete,
    readyCount: counts.ready,
    completeCount: counts.complete,
    mismatchCount: counts.mismatch,
    missingPriorCount: counts.missing_prior,
    newFlatCount: counts.new_flat,
    flats: flatInfos,
  }
}

export function getFlatRolloverError(info: FlatRolloverInfo): string | null {
  if (info.status === 'missing_prior') {
    return `${info.flatLabel}: complete ${formatMonthLabel(info.previousMonth)} before adding readings for this month.`
  }
  return null
}
