import type { BillingConfig, FlatBill, SocietyStats } from '@/types'
import {
  calculateEffectiveRate,
  calculateEfficiencyScore,
  calculateFlatBill,
  calculateTotalWaterCost,
  getPreviousMonths,
} from '@/lib/billing'
import { cacheGet, cacheInvalidate, cacheSet, CacheKeys } from '@/lib/cache'
import { dataStore } from '@/services/dataStore'
import { getFlats, getMonthlySummaries, groupReadingsByBlock } from '@/services/readingsService'
import { summaryToBillingReading } from '@/lib/readings'

export async function getBillingConfig(month: string): Promise<BillingConfig | null> {
  const cached = await cacheGet<BillingConfig>(CacheKeys.billingConfig(month))
  if (cached) return cached
  const config = await dataStore.getBillingConfig(month)
  if (config) await cacheSet(CacheKeys.billingConfig(month), config)
  return config
}

export async function saveBillingConfig(
  config: Omit<BillingConfig, 'id' | 'locked' | 'lockedAt' | 'lockedBy'>,
): Promise<BillingConfig> {
  const existing = await dataStore.getBillingConfig(config.month)
  if (existing?.locked) {
    throw new Error('This billing month is locked and cannot be edited.')
  }

  const saved: BillingConfig = {
    id: existing?.id ?? `config-${config.month}`,
    ...config,
    locked: existing?.locked ?? false,
    ...(existing?.lockedAt ? { lockedAt: existing.lockedAt } : {}),
    ...(existing?.lockedBy ? { lockedBy: existing.lockedBy } : {}),
  }

  await dataStore.upsertBillingConfig(saved)
  await cacheInvalidate(CacheKeys.billingConfig(config.month))
  await cacheInvalidate(CacheKeys.dashboard(config.month))
  return saved
}

export async function lockBillingMonth(month: string, userId: string): Promise<BillingConfig> {
  const existing = await dataStore.getBillingConfig(month)
  if (!existing) throw new Error('Billing configuration not found for this month.')
  if (existing.locked) throw new Error('This month is already locked.')

  const locked: BillingConfig = {
    ...existing,
    locked: true,
    lockedAt: new Date().toISOString(),
    lockedBy: userId,
  }

  await dataStore.upsertBillingConfig(locked)
  await cacheInvalidate(CacheKeys.billingConfig(month))
  return locked
}

export async function computeFlatBills(month: string): Promise<FlatBill[]> {
  const [flats, summaries, config] = await Promise.all([
    getFlats(),
    getMonthlySummaries(month),
    getBillingConfig(month),
  ])

  if (!config) return []

  const totalKL = summaries.reduce((sum, s) => sum + s.consumptionKL, 0)
  const effectiveRate = calculateEffectiveRate(config, totalKL)
  const blockTotals = groupReadingsByBlock(summaries, flats)
  const blockCounts: Record<string, number> = {}
  for (const flat of flats) {
    blockCounts[flat.block] = (blockCounts[flat.block] ?? 0) + 1
  }

  return summaries
    .map((summary) => {
      const flat = flats.find((f) => f.id === summary.flatId)
      if (!flat) return null
      const reading = summaryToBillingReading(summary)
      const bill = calculateFlatBill(reading, flat, config, effectiveRate, totalKL)
      const blockAvg =
        blockCounts[flat.block] > 0
          ? (blockTotals[flat.block] ?? 0) / blockCounts[flat.block]
          : 0
      const societyAvg = flats.length > 0 ? totalKL / flats.length : 0
      bill.efficiencyScore = calculateEfficiencyScore(
        summary.consumptionKL,
        blockAvg,
        societyAvg,
      )
      return bill
    })
    .filter((b): b is FlatBill => b !== null)
    .sort((a, b) => a.flat.label.localeCompare(b.flat.label))
}

export async function getSocietyStats(month: string): Promise<SocietyStats> {
  const cached = await cacheGet<SocietyStats>(CacheKeys.dashboard(month))
  if (cached) return cached

  const [flats, summaries, config, bills] = await Promise.all([
    getFlats(),
    getMonthlySummaries(month),
    getBillingConfig(month),
    computeFlatBills(month),
  ])

  const totalConsumptionKL = summaries.reduce((sum, s) => sum + s.consumptionKL, 0)
  const totalWaterCost = config ? calculateTotalWaterCost(config) : 0
  const effectiveRate = config ? calculateEffectiveRate(config, totalConsumptionKL) : 0

  const topConsumers = bills
    .slice()
    .sort((a, b) => b.consumptionKL - a.consumptionKL)
    .slice(0, 5)
    .map((b) => ({ flat: b.flat, consumptionKL: b.consumptionKL }))

  const daysInMonth = 30
  const dailyPerDay = totalConsumptionKL > 0 ? totalConsumptionKL / daysInMonth : 0
  const dailyTrend = Array.from({ length: daysInMonth }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, '0')}`,
    consumptionKL: Math.round(dailyPerDay * 100) / 100,
  }))

  const stats: SocietyStats = {
    month,
    totalConsumptionKL,
    totalConsumptionLiters: totalConsumptionKL * 1000,
    totalWaterCost,
    effectiveRatePerKL: effectiveRate,
    blockConsumption: groupReadingsByBlock(summaries, flats),
    topConsumers,
    dailyTrend,
    tankerCount: config?.tankerCount ?? 0,
    flatCount: flats.length,
  }

  await cacheSet(CacheKeys.dashboard(month), stats)
  return stats
}

export async function getFlatBillHistory(flatId: string): Promise<FlatBill[]> {
  const months = getPreviousMonths(12)
  const results: FlatBill[] = []
  for (const month of months) {
    const bills = await computeFlatBills(month)
    const bill = bills.find((b) => b.flatId === flatId)
    if (bill) results.push(bill)
  }
  return results
}
