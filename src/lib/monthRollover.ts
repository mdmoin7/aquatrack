import type { Flat, MeterReading } from '@/types'
import { formatMonthLabel, getPreviousMonth } from '@/lib/billing'
import { aggregateFlatMonth, getFlatReadingsForMonth } from '@/lib/readings'

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

export function buildFlatRolloverInfo(
  flat: Flat,
  month: string,
  allReadings: MeterReading[],
): FlatRolloverInfo {
  const previousMonth = getPreviousMonth(month)
  const prevSummary = aggregateFlatMonth(flat.id, previousMonth, allReadings)
  const currentEntries = getFlatReadingsForMonth(flat.id, month, allReadings)
  const currentSummary = aggregateFlatMonth(flat.id, month, allReadings)
  const hadEarlierHistory = flatHadReadingBeforeMonth(flat.id, previousMonth, allReadings)

  const base = {
    flatId: flat.id,
    flatLabel: flat.label,
    previousMonth,
  }

  if (currentSummary && currentEntries.length > 0) {
    const first = currentEntries[0]
    if (prevSummary && first.openingReading !== prevSummary.closingReading) {
      return {
        ...base,
        status: 'mismatch',
        previousClosing: prevSummary.closingReading,
        expectedOpening: prevSummary.closingReading,
        actualOpening: first.openingReading,
      }
    }
    return {
      ...base,
      status: 'complete',
      previousClosing: prevSummary?.closingReading,
      expectedOpening: first.openingReading,
      actualOpening: first.openingReading,
    }
  }

  if (prevSummary) {
    return {
      ...base,
      status: 'ready',
      previousClosing: prevSummary.closingReading,
      expectedOpening: prevSummary.closingReading,
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
): MonthRolloverStatus {
  const previousMonth = getPreviousMonth(month)
  const flatInfos = flats.map((flat) => buildFlatRolloverInfo(flat, month, allReadings))
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
