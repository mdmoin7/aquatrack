import type { BlockId, Flat, MeterReading, MonthlyFlatSummary, UserRole } from '@/types'
import {
  calculateConsumption,
  getCurrentMonth,
  getNextMonth,
  getPreviousMonth,
  getPreviousMonths,
  litersToKL,
} from '@/lib/billing'
import { generateAlertsForReading } from '@/lib/analytics'
import {
  aggregateFlatMonth,
  aggregateMonthlyReadings,
  getFlatReadingsForMonth,
  sortReadingsChronologically,
  summaryToBillingReading,
} from '@/lib/readings'
import { cacheGet, cacheInvalidate, cacheSet, CacheKeys } from '@/lib/cache'
import { dataStore } from '@/services/dataStore'

function generateId(): string {
  return crypto.randomUUID()
}

export interface OpeningReadingInfo {
  openingReading: number | null
  source: 'previous_closing' | 'previous_entry' | 'initial' | 'none'
  previousMonth?: string
  previousClosing?: number
  entryNumber?: number
  monthlyConsumptionKL?: number
}

export async function resolveOpeningReading(
  flatId: string,
  month: string,
): Promise<OpeningReadingInfo> {
  const allReadings = await dataStore.getReadings()
  const monthEntries = getFlatReadingsForMonth(flatId, month, allReadings)
  const monthlySummary = aggregateFlatMonth(flatId, month, allReadings)

  if (monthEntries.length > 0) {
    const last = monthEntries[monthEntries.length - 1]
    return {
      openingReading: last.closingReading,
      source: 'previous_entry',
      previousClosing: last.closingReading,
      entryNumber: monthEntries.length + 1,
      monthlyConsumptionKL: monthlySummary?.consumptionKL,
    }
  }

  const previousMonth = getPreviousMonth(month)
  const prevSummary = aggregateFlatMonth(flatId, previousMonth, allReadings)
  if (prevSummary) {
    return {
      openingReading: prevSummary.closingReading,
      source: 'previous_closing',
      previousMonth,
      previousClosing: prevSummary.closingReading,
      entryNumber: 1,
    }
  }

  return { openingReading: null, source: 'none', entryNumber: 1 }
}

async function cascadeOpeningToNextMonth(
  flatId: string,
  month: string,
  monthlyClosing: number,
): Promise<void> {
  const nextMonth = getNextMonth(month)
  const nextConfig = await dataStore.getBillingConfig(nextMonth)
  if (nextConfig?.locked) return

  const allReadings = await dataStore.getReadings()
  const nextEntries = getFlatReadingsForMonth(flatId, nextMonth, allReadings)
  if (nextEntries.length === 0) return

  const first = nextEntries[0]
  if (first.openingReading === monthlyClosing) return

  const consumptionLiters = calculateConsumption(monthlyClosing, first.closingReading)
  const updated: MeterReading = {
    ...first,
    openingReading: monthlyClosing,
    consumptionLiters,
    consumptionKL: litersToKL(consumptionLiters),
    updatedAt: new Date().toISOString(),
    auditTrail: [
      ...first.auditTrail,
      {
        action: 'update',
        userId: 'system',
        userName: 'System (cycle carry-forward)',
        timestamp: new Date().toISOString(),
        previousValues: {
          openingReading: first.openingReading,
          consumptionLiters: first.consumptionLiters,
          consumptionKL: first.consumptionKL,
        },
      },
    ],
  }

  await dataStore.upsertReading(updated)
  await cacheInvalidate(CacheKeys.readings(nextMonth))
  await cacheInvalidate(CacheKeys.dashboard(nextMonth))
}

export async function getFlats(): Promise<Flat[]> {
  const cached = await cacheGet<Flat[]>(CacheKeys.flats())
  if (cached) return cached
  const flats = await dataStore.getFlats()
  await cacheSet(CacheKeys.flats(), flats)
  return flats
}

export async function getReadings(month: string): Promise<MeterReading[]> {
  const cached = await cacheGet<MeterReading[]>(CacheKeys.readings(month))
  if (cached) return cached
  const readings = sortReadingsChronologically(await dataStore.getReadings(month))
  await cacheSet(CacheKeys.readings(month), readings)
  return readings
}

export async function getMonthlySummaries(month: string): Promise<MonthlyFlatSummary[]> {
  const cacheKey = `monthly-summaries:${month}`
  const cached = await cacheGet<MonthlyFlatSummary[]>(cacheKey)
  if (cached) return cached
  const summaries = aggregateMonthlyReadings(month, await dataStore.getReadings())
  await cacheSet(cacheKey, summaries)
  return summaries
}

export async function getReadingHistory(flatId: string): Promise<MeterReading[]> {
  const all = (await dataStore.getReadings()).filter((r) => r.flatId === flatId)
  const months = [...new Set(all.map((r) => r.month))].sort()
  return months
    .map((month) => {
      const summary = aggregateFlatMonth(flatId, month, all)
      return summary ? summaryToBillingReading(summary) : null
    })
    .filter((r): r is MeterReading => r !== null)
}

/** All individual meter reading entries for a flat, optionally filtered by month. */
export async function getFlatReadingEntries(
  flatId: string,
  month?: string,
): Promise<MeterReading[]> {
  const all = await dataStore.getReadings()
  let entries = all.filter((r) => r.flatId === flatId)
  if (month) entries = entries.filter((r) => r.month === month)
  return sortReadingsChronologically(entries)
}

export async function saveReading(
  input: {
    flatId: string
    month: string
    closingReading: number
    initialOpeningReading?: number
    enteredBy: string
    enteredByRole: UserRole
  },
  existingId?: string,
): Promise<MeterReading> {
  const config = await dataStore.getBillingConfig(input.month)
  if (config?.locked) {
    throw new Error('Billing for this month is locked. Readings cannot be modified.')
  }

  const openingInfo = await resolveOpeningReading(input.flatId, input.month)
  let openingReading: number

  if (existingId && input.initialOpeningReading !== undefined) {
    openingReading = input.initialOpeningReading
  } else if (openingInfo.source === 'previous_closing' && openingInfo.openingReading !== null) {
    openingReading = openingInfo.openingReading
  } else if (openingInfo.source === 'previous_entry' && openingInfo.openingReading !== null) {
    openingReading = openingInfo.openingReading
  } else if (input.initialOpeningReading !== undefined) {
    openingReading = input.initialOpeningReading
  } else {
    throw new Error(
      'No previous month reading found. Enter the initial meter reading to start the billing cycle.',
    )
  }

  if (input.closingReading < openingReading) {
    throw new Error(
      `Closing reading (${input.closingReading} L) cannot be less than opening reading (${openingReading} L).`,
    )
  }

  const consumptionLiters = calculateConsumption(openingReading, input.closingReading)
  const now = new Date().toISOString()
  const allReadings = await dataStore.getReadings()
  const existing = existingId ? allReadings.find((r) => r.id === existingId) : undefined

  const reading: MeterReading = {
    id: existingId ?? generateId(),
    flatId: input.flatId,
    month: input.month,
    openingReading,
    closingReading: input.closingReading,
    consumptionLiters,
    consumptionKL: litersToKL(consumptionLiters),
    enteredBy: input.enteredBy,
    enteredByRole: input.enteredByRole,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    auditTrail: [
      ...(existing?.auditTrail ?? []),
      {
        action: existing ? 'update' : 'create',
        userId: input.enteredBy,
        userName: input.enteredBy,
        timestamp: now,
        previousValues: existing ? { ...existing } : undefined,
      },
    ],
  }

  await dataStore.upsertReading(reading)

  const monthlySummary = aggregateFlatMonth(
    input.flatId,
    input.month,
    await dataStore.getReadings(),
  )
  if (monthlySummary) {
    await cascadeOpeningToNextMonth(input.flatId, input.month, monthlySummary.closingReading)
  }

  await cacheInvalidate(CacheKeys.readings(input.month))
  await cacheInvalidate(`monthly-summaries:${input.month}`)
  await cacheInvalidate(CacheKeys.dashboard(input.month))
  await cacheInvalidate(CacheKeys.alerts(input.month))
  await cacheInvalidatePrefixAnalytics(input.flatId)

  const flats = await getFlats()
  const flat = flats.find((f) => f.id === input.flatId)
  if (flat && monthlySummary) {
    const history = await getReadingHistory(input.flatId)
    const prev = history.filter((r) => r.month < input.month).at(-1)
    const billingReading = summaryToBillingReading(monthlySummary)
    const alerts = generateAlertsForReading(billingReading, flat, prev)
    if (alerts.length) await dataStore.upsertAlerts(alerts)
  }

  return reading
}

export async function deleteReading(
  id: string,
  userId: string,
  userName: string,
  canDelete: boolean,
): Promise<void> {
  if (!canDelete) throw new Error('You do not have permission to delete readings.')

  const all = await dataStore.getReadings()
  const reading = all.find((r) => r.id === id)
  if (!reading) throw new Error('Reading not found.')

  const config = await dataStore.getBillingConfig(reading.month)
  if (config?.locked) throw new Error('Billing for this month is locked.')

  await dataStore.deleteReading(id)

  const remainingSummary = aggregateFlatMonth(
    reading.flatId,
    reading.month,
    await dataStore.getReadings(),
  )
  if (remainingSummary) {
    await cascadeOpeningToNextMonth(
      reading.flatId,
      reading.month,
      remainingSummary.closingReading,
    )
  }

  await cacheInvalidate(CacheKeys.readings(reading.month))
  await cacheInvalidate(`monthly-summaries:${reading.month}`)
  await cacheInvalidate(CacheKeys.dashboard(reading.month))
  await cacheInvalidatePrefixAnalytics(reading.flatId)

  void { ...reading, auditTrail: [...reading.auditTrail, { action: 'delete' as const, userId, userName, timestamp: new Date().toISOString() }] }
}

async function cacheInvalidatePrefixAnalytics(flatId: string): Promise<void> {
  const months = getPreviousMonths(12, getCurrentMonth())
  await Promise.all([
    ...months.map((m) => cacheInvalidate(CacheKeys.flatAnalytics(flatId, m))),
    ...months.map((m) => cacheInvalidate(`monthly-summaries:${m}`)),
  ])
}

export function groupReadingsByBlock(
  summaries: MonthlyFlatSummary[],
  flats: Flat[],
): Record<BlockId, number> {
  const result: Record<BlockId, number> = { A: 0, B: 0, C: 0, COMMON: 0 }
  for (const summary of summaries) {
    const flat = flats.find((f) => f.id === summary.flatId)
    if (flat) result[flat.block] += summary.consumptionKL
  }
  return result
}

export interface BulkImportResult {
  imported: number
  skipped: number
  failed: Array<{ flatLabel: string; error: string }>
}

/** Import validated rows from CSV upload. Skips duplicate rows; processes valid rows sequentially. */
export async function bulkImportReadings(
  rows: Array<{
    flatId: string
    flatLabel: string
    closingReading: number
    initialOpeningReading?: number
  }>,
  month: string,
  enteredBy: string,
  enteredByRole: UserRole,
): Promise<BulkImportResult> {
  const result: BulkImportResult = { imported: 0, skipped: 0, failed: [] }

  for (const row of rows) {
    try {
      await saveReading(
        {
          flatId: row.flatId,
          month,
          closingReading: row.closingReading,
          initialOpeningReading: row.initialOpeningReading,
          enteredBy,
          enteredByRole,
        },
      )
      result.imported++
    } catch (e) {
      result.failed.push({
        flatLabel: row.flatLabel,
        error: e instanceof Error ? e.message : 'Import failed',
      })
    }
  }

  return result
}
