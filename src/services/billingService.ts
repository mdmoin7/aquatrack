import type { BillingConfig, FlatBill, SocietyStats, StoredFlatBill } from '@/types'
import { canGenerateFlatBills, type BillGenerationCheck } from '@/lib/billGeneration'
import { calculateEffectiveRate, calculateEfficiencyScore, calculateFlatBill, calculateTotalWaterCost, getPreviousMonths } from '@/lib/billing'
import { cacheGet, cacheInvalidate, cacheSet, CacheKeys } from '@/lib/cache'
import { summaryToBillingReading } from '@/lib/readings'
import { isFirebaseConfigured } from '@/lib/firebase'
import { persistentCacheDelete, persistentCacheGet, persistentCacheSet, PersistentCacheTTL } from '@/services/persistentCache'
import { dataStore } from '@/services/dataStore'
import { getFlats, getMonthlySummaries, getMonthRolloverStatus, groupReadingsByBlock } from '@/services/readingsService'

function storedToFlatBill(stored: StoredFlatBill): FlatBill {
  const { id: _id, generatedAt: _at, generatedBy: _by, ...bill } = stored
  return bill
}

function toStoredFlatBill(bill: FlatBill, userId: string, generatedAt: string): StoredFlatBill {
  return { id: `${bill.month}__${bill.flatId}`, ...bill, generatedAt, generatedBy: userId }
}

const persistentBillingConfigKey = (month: string) => `billing-config:${month}`
const persistentFlatBillsKey = (month: string) => `flat-bills:${month}`

export async function getBillingConfig(month: string): Promise<BillingConfig | null> {
  const cached = await cacheGet<BillingConfig>(CacheKeys.billingConfig(month))
  if (cached) return cached

  if (isFirebaseConfigured) {
    const persistent = await persistentCacheGet<BillingConfig>(persistentBillingConfigKey(month))
    if (persistent) {
      await cacheSet(CacheKeys.billingConfig(month), persistent)
      return persistent
    }
  }

  const config = await dataStore.getBillingConfig(month)
  if (config) {
    await cacheSet(CacheKeys.billingConfig(month), config)
    if (isFirebaseConfigured) await persistentCacheSet(persistentBillingConfigKey(month), config, PersistentCacheTTL.monthlyData)
  }
  return config
}

export async function saveBillingConfig(config: Omit<BillingConfig, 'id' | 'locked' | 'lockedAt' | 'lockedBy' | 'billsGeneratedAt' | 'billsGeneratedBy'>): Promise<BillingConfig> {
  const existing = await dataStore.getBillingConfig(config.month)
  if (existing?.locked) throw new Error('This billing month is locked and cannot be edited.')
  const saved: BillingConfig = {
    id: existing?.id ?? `config-${config.month}`,
    ...config,
    locked: existing?.locked ?? false,
    ...(existing?.lockedAt ? { lockedAt: existing.lockedAt } : {}),
    ...(existing?.lockedBy ? { lockedBy: existing.lockedBy } : {}),
    ...(existing?.billsGeneratedAt ? { billsGeneratedAt: existing.billsGeneratedAt } : {}),
    ...(existing?.billsGeneratedBy ? { billsGeneratedBy: existing.billsGeneratedBy } : {}),
  }
  await dataStore.upsertBillingConfig(saved)
  await cacheInvalidate(CacheKeys.billingConfig(config.month))
  await persistentCacheDelete(persistentBillingConfigKey(config.month))
  await cacheInvalidate(CacheKeys.dashboard(config.month))
  return saved
}

export async function lockBillingMonth(month: string, userId: string): Promise<BillingConfig> {
  const existing = await dataStore.getBillingConfig(month)
  if (!existing) throw new Error('Billing configuration not found for this month.')
  if (existing.locked) throw new Error('This month is already locked.')
  const locked: BillingConfig = { ...existing, locked: true, lockedAt: new Date().toISOString(), lockedBy: userId }
  await dataStore.upsertBillingConfig(locked)
  await cacheInvalidate(CacheKeys.billingConfig(month))
  await persistentCacheDelete(persistentBillingConfigKey(month))
  return locked
}

export async function validateBillGeneration(month: string): Promise<BillGenerationCheck> {
  const [rollover, config] = await Promise.all([getMonthRolloverStatus(month), getBillingConfig(month)])
  return canGenerateFlatBills(rollover, config)
}

export async function computeFlatBills(month: string): Promise<FlatBill[]> {
  const [flats, summaries, config] = await Promise.all([getFlats(), getMonthlySummaries(month), getBillingConfig(month)])
  if (!config) return []
  const totalKL = summaries.reduce((sum, s) => sum + s.consumptionKL, 0)
  const effectiveRate = calculateEffectiveRate(config, totalKL)
  const blockTotals = groupReadingsByBlock(summaries, flats)
  const blockCounts: Record<string, number> = {}
  for (const flat of flats) blockCounts[flat.block] = (blockCounts[flat.block] ?? 0) + 1
  return summaries.map((summary) => {
    const flat = flats.find((f) => f.id === summary.flatId)
    if (!flat) return null
    const reading = summaryToBillingReading(summary)
    const bill = calculateFlatBill(reading, flat, config, effectiveRate, totalKL)
    const blockAvg = blockCounts[flat.block] > 0 ? (blockTotals[flat.block] ?? 0) / blockCounts[flat.block] : 0
    const societyAvg = flats.length > 0 ? totalKL / flats.length : 0
    bill.efficiencyScore = calculateEfficiencyScore(summary.consumptionKL, blockAvg, societyAvg)
    return bill
  }).filter((b): b is FlatBill => b !== null).sort((a, b) => a.flat.label.localeCompare(b.flat.label))
}

export async function getFlatBills(month: string): Promise<FlatBill[]> {
  const config = await getBillingConfig(month)
  if (config?.locked) {
    const cached = await cacheGet<FlatBill[]>(CacheKeys.flatBills(month))
    if (cached) return cached

    if (isFirebaseConfigured) {
      const persistent = await persistentCacheGet<FlatBill[]>(persistentFlatBillsKey(month))
      if (persistent) {
        await cacheSet(CacheKeys.flatBills(month), persistent)
        return persistent
      }
    }

    const stored = await dataStore.getFlatBills(month)
    if (stored.length > 0) {
      const bills = stored.map(storedToFlatBill)
      await cacheSet(CacheKeys.flatBills(month), bills)
      if (isFirebaseConfigured) await persistentCacheSet(persistentFlatBillsKey(month), bills, PersistentCacheTTL.staticData)
      return bills
    }
  }
  return computeFlatBills(month)
}

export async function generateAndLockFlatBills(month: string, userId: string): Promise<{ bills: FlatBill[]; config: BillingConfig }> {
  const validation = await validateBillGeneration(month)
  if (!validation.ok) throw new Error(validation.errors.join(' '))
  const bills = await computeFlatBills(month)
  if (bills.length === 0) throw new Error('No bills to generate. Ensure flats have readings for this month.')
  const generatedAt = new Date().toISOString()
  await dataStore.saveFlatBills(month, bills.map((bill) => toStoredFlatBill(bill, userId, generatedAt)))
  const existing = await dataStore.getBillingConfig(month)
  if (!existing) throw new Error('Billing configuration not found for this month.')
  const locked: BillingConfig = { ...existing, locked: true, lockedAt: generatedAt, lockedBy: userId, billsGeneratedAt: generatedAt, billsGeneratedBy: userId }
  await dataStore.upsertBillingConfig(locked)
  await cacheInvalidate(CacheKeys.billingConfig(month))
  await persistentCacheDelete(persistentBillingConfigKey(month))
  await cacheInvalidate(CacheKeys.flatBills(month))
  await persistentCacheDelete(persistentFlatBillsKey(month))
  await cacheInvalidate(CacheKeys.dashboard(month))
  await cacheSet(CacheKeys.flatBills(month), bills)
  if (isFirebaseConfigured) await persistentCacheSet(persistentFlatBillsKey(month), bills, PersistentCacheTTL.staticData)
  return { bills, config: locked }
}

export async function getSocietyStats(month: string): Promise<SocietyStats> {
  const cached = await cacheGet<SocietyStats>(CacheKeys.dashboard(month))
  if (cached) return cached
  const [flats, summaries, config, bills] = await Promise.all([getFlats(), getMonthlySummaries(month), getBillingConfig(month), getFlatBills(month)])
  const totalConsumptionKL = summaries.reduce((sum, s) => sum + s.consumptionKL, 0)
  const totalWaterCost = config ? calculateTotalWaterCost(config) : 0
  const effectiveRate = config ? calculateEffectiveRate(config, totalConsumptionKL) : 0
  const topConsumers = bills.slice().sort((a, b) => b.consumptionKL - a.consumptionKL).slice(0, 5).map((b) => ({ flat: b.flat, consumptionKL: b.consumptionKL }))
  const daysInMonth = 30
  const dailyPerDay = totalConsumptionKL > 0 ? totalConsumptionKL / daysInMonth : 0
  const dailyTrend = Array.from({ length: daysInMonth }, (_, i) => ({ date: `${month}-${String(i + 1).padStart(2, '0')}`, consumptionKL: Math.round(dailyPerDay * 100) / 100 }))
  const stats: SocietyStats = { month, totalConsumptionKL, totalConsumptionLiters: totalConsumptionKL * 1000, totalWaterCost, effectiveRatePerKL: effectiveRate, blockConsumption: groupReadingsByBlock(summaries, flats), topConsumers, dailyTrend, tankerCount: config?.tankerCount ?? 0, flatCount: flats.length }
  await cacheSet(CacheKeys.dashboard(month), stats)
  return stats
}

export async function getFlatBillHistory(flatId: string): Promise<FlatBill[]> {
  const months = getPreviousMonths(12)
  const results: FlatBill[] = []
  for (const month of months) {
    const bills = await getFlatBills(month)
    const bill = bills.find((b) => b.flatId === flatId)
    if (bill) results.push(bill)
  }
  return results
}
