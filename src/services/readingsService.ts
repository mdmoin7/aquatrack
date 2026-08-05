import type { BlockId, Flat, MeterReading, MonthlyFlatSummary, UserRole } from '@/types'
import {
  calculateConsumption,
  formatMonthLabel,
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
import {
  enqueuePendingReading,
  listPendingReadings,
  pendingToMeterReading,
  removePendingReading,
  updatePendingError,
  type PendingReadingInput,
} from '@/services/readingQueueService'
import {
  buildFlatRolloverInfo,
  buildMonthRolloverStatus,
  type MonthRolloverStatus,
} from '@/lib/monthRollover'
import { dataStore } from '@/services/dataStore'

function generateId(): string {
  return crypto.randomUUID()
}

export interface OpeningReadingInfo {
  openingReading: number | null
  source: 'previous_closing' | 'previous_entry' | 'initial' | 'missing_prior' | 'none'
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

  const hadEarlierHistory = allReadings.some(
    (r) => r.flatId === flatId && r.month < previousMonth,
  )
  if (hadEarlierHistory) {
    return {
      openingReading: null,
      source: 'missing_prior',
      previousMonth,
      entryNumber: 1,
    }
  }

  return { openingReading: null, source: 'none', entryNumber: 1 }
}

export async function getMonthRolloverStatus(month: string): Promise<MonthRolloverStatus> {
  const cacheKey = `month-rollover:${month}`
  const cached = await cacheGet<MonthRolloverStatus>(cacheKey)
  if (cached) return cached

  const [flats, allReadings] = await Promise.all([getFlats(), dataStore.getReadings()])
  const status = buildMonthRolloverStatus(month, flats, allReadings)
  await cacheSet(cacheKey, status, 60_000)
  return status
}

export async function repairFlatRolloverOpening(
  flatId: string,
  month: string,
): Promise<boolean> {
  const allReadings = await dataStore.getReadings()
  const flats = await getFlats()
  const flat = flats.find((f) => f.id === flatId)
  if (!flat) throw new Error('Flat not found.')

  const info = buildFlatRolloverInfo(flat, month, allReadings)
  if (info.status !== 'mismatch' || info.expectedOpening === undefined) return false

  const entries = getFlatReadingsForMonth(flatId, month, allReadings)
  const first = entries[0]
  if (!first) return false

  const config = await dataStore.getBillingConfig(month)
  if (config?.locked) throw new Error('Billing for this month is locked.')

  const consumptionLiters = calculateConsumption(info.expectedOpening, first.closingReading)
  const now = new Date().toISOString()
  const updated: MeterReading = {
    ...first,
    openingReading: info.expectedOpening,
    consumptionLiters,
    consumptionKL: litersToKL(consumptionLiters),
    updatedAt: now,
    auditTrail: [
      ...first.auditTrail,
      {
        action: 'update',
        userId: 'system',
        userName: 'System (month rollover repair)',
        timestamp: now,
        previousValues: {
          openingReading: first.openingReading,
          consumptionLiters: first.consumptionLiters,
          consumptionKL: first.consumptionKL,
        },
      },
    ],
  }

  await dataStore.upsertReading(updated)
  await cacheInvalidate(CacheKeys.readings(month))
  await cacheInvalidate(`monthly-summaries:${month}`)
  await cacheInvalidate(`month-rollover:${month}`)
  await cacheInvalidate(CacheKeys.dashboard(month))
  return true
}

export async function repairAllRolloverMismatches(month: string): Promise<number> {
  const status = await getMonthRolloverStatus(month)
  let fixed = 0
  for (const flat of status.flats) {
    if (flat.status === 'mismatch') {
      const didFix = await repairFlatRolloverOpening(flat.flatId, month)
      if (didFix) fixed++
    }
  }
  return fixed
}

function assertFlatCanAddReading(
  flatId: string,
  month: string,
  allReadings: MeterReading[],
  flats: Flat[],
): void {
  const flat = flats.find((f) => f.id === flatId)
  if (!flat) return

  const info = buildFlatRolloverInfo(flat, month, allReadings)
  if (info.status === 'missing_prior') {
    throw new Error(
      `Cannot add reading: ${flat.label} has no ${formatMonthLabel(info.previousMonth)} closing. Complete the prior month first.`,
    )
  }
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
  const stored = cached ?? sortReadingsChronologically(await dataStore.getReadings(month))
  if (!cached) await cacheSet(CacheKeys.readings(month), stored)

  const pending = (await listPendingReadings()).filter((p) => p.input.month === month)
  if (pending.length === 0) return stored

  const storedIds = new Set(stored.map((r) => r.id))
  const merged = [
    ...stored,
    ...pending.map(pendingToMeterReading).filter((r) => !storedIds.has(r.id)),
  ]
  return sortReadingsChronologically(merged)
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

export type SaveReadingInput = PendingReadingInput

export async function saveReading(
  input: SaveReadingInput,
  existingId?: string,
): Promise<MeterReading> {
  if (!navigator.onLine) {
    const pending = await enqueuePendingReading(input, existingId)
    await cacheInvalidate(CacheKeys.readings(input.month))
    await cacheInvalidate(`monthly-summaries:${input.month}`)
    return pendingToMeterReading(pending)
  }
  return persistReading(input, existingId)
}

export async function flushReadingQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 }

  const pending = await listPendingReadings()
  let synced = 0
  let failed = 0

  for (const item of pending) {
    try {
      await persistReading(item.input, item.existingId)
      await removePendingReading(item.queueId)
      synced++
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed'
      await updatePendingError(item.queueId, message)
      failed++
    }
  }

  return { synced, failed }
}

async function persistReading(
  input: SaveReadingInput,
  existingId?: string,
): Promise<MeterReading> {
  const config = await dataStore.getBillingConfig(input.month)
  if (config?.locked) {
    throw new Error('Billing for this month is locked. Readings cannot be modified.')
  }

  const allReadings = await dataStore.getReadings()
  const flats = await getFlats()

  if (!existingId) {
    assertFlatCanAddReading(input.flatId, input.month, allReadings, flats)
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
  await cacheInvalidate(`month-rollover:${input.month}`)
  await cacheInvalidate(`month-rollover:${getNextMonth(input.month)}`)
  await cacheInvalidate(CacheKeys.dashboard(input.month))
  await cacheInvalidate(CacheKeys.alerts(input.month))
  await cacheInvalidatePrefixAnalytics(input.flatId)

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
  await cacheInvalidate(`month-rollover:${reading.month}`)
  await cacheInvalidate(`month-rollover:${getNextMonth(reading.month)}`)
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

export interface BlockDashboardStats {
  block: BlockId
  month: string
  flatCount: number
  completeCount: number
  totalConsumptionKL: number
  pendingFlatLabels: string[]
  flats: Array<{ flat: Flat; consumptionKL: number; hasReading: boolean }>
}

export async function getBlockDashboardStats(
  month: string,
  block: BlockId,
): Promise<BlockDashboardStats> {
  const [flats, summaries] = await Promise.all([getFlats(), getMonthlySummaries(month)])
  const blockFlats = flats.filter((f) => f.block === block)
  const summaryByFlat = Object.fromEntries(summaries.map((s) => [s.flatId, s]))

  const flatRows = blockFlats.map((flat) => {
    const summary = summaryByFlat[flat.id]
    return {
      flat,
      consumptionKL: summary?.consumptionKL ?? 0,
      hasReading: Boolean(summary && summary.readingCount > 0),
    }
  })

  const completeCount = flatRows.filter((r) => r.hasReading).length
  const totalConsumptionKL = flatRows.reduce((sum, r) => sum + r.consumptionKL, 0)

  return {
    block,
    month,
    flatCount: blockFlats.length,
    completeCount,
    totalConsumptionKL,
    pendingFlatLabels: flatRows.filter((r) => !r.hasReading).map((r) => r.flat.label),
    flats: flatRows.sort((a, b) => a.flat.label.localeCompare(b.flat.label)),
  }
}
