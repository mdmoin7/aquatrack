import type { FlatAnalytics } from '@/types'
import { estimateTankersRequired } from '@/lib/billing'
import { DEFAULT_TANKER_CAPACITY_LITERS } from '@/lib/tanker'
import { detectSpike, forecastNextMonth, generateAlertsForReading } from '@/lib/analytics'
import { cacheGet, cacheSet, CacheKeys } from '@/lib/cache'
import { dataStore } from '@/services/dataStore'
import { getFlatBills, getBillingConfig, getSocietyStats } from '@/services/billingService'
import { getFlats, getReadingHistory } from '@/services/readingsService'

export async function getFlatAnalytics(
  flatId: string,
  month: string,
): Promise<FlatAnalytics | null> {
  const cacheKey = CacheKeys.flatAnalytics(flatId, month)
  const cached = await cacheGet<FlatAnalytics>(cacheKey)
  if (cached) return cached

  const flats = await getFlats()
  const flat = flats.find((f) => f.id === flatId)
  if (!flat) return null

  const [history, stats, config, bills] = await Promise.all([
    getReadingHistory(flatId),
    getSocietyStats(month),
    getBillingConfig(month),
    getFlatBills(month),
  ])

  const currentBill = bills.find((b) => b.flatId === flatId)
  const currentReading = history.find((r) => r.month === month)
  const recentKL = history.slice(-3).map((r) => r.consumptionKL)
  const rolling3 = recentKL.length
    ? recentKL.reduce((a, b) => a + b, 0) / recentKL.length
    : 0

  const blockFlats = flats.filter((f) => f.block === flat.block)
  const blockAvg =
    blockFlats.length > 0
      ? (stats.blockConsumption[flat.block] ?? 0) / blockFlats.length
      : 0
  const societyAvg = flats.length > 0 ? stats.totalConsumptionKL / flats.length : 0

  const timeline = await Promise.all(
    history.slice(-12).map(async (r) => {
      const monthBills = await getFlatBills(r.month)
      const bill = monthBills.find((b) => b.flatId === flatId)
      return {
        month: r.month,
        consumptionKL: r.consumptionKL,
        bill: bill?.finalBill ?? 0,
      }
    }),
  )

  const spikes = history.slice(1).map((r, i) => {
    const prev = history[i]
    const result = detectSpike(r.consumptionKL, prev.consumptionKL)
    return result.detected
      ? { month: r.month, percentIncrease: result.percentIncrease }
      : null
  }).filter((s): s is { month: string; percentIncrease: number } => s !== null)

  const prevReading = history.filter((r) => r.month < month).at(-1)
  const anomalies = currentReading
    ? generateAlertsForReading(currentReading, flat, prevReading)
    : []

  const forecast = forecastNextMonth(history.map((r) => r.consumptionKL))
  const tankerCapacity = config?.tankerCapacityLiters ?? DEFAULT_TANKER_CAPACITY_LITERS

  const analytics: FlatAnalytics = {
    flat,
    month,
    currentConsumptionKL: currentReading?.consumptionKL ?? 0,
    rolling3MonthAvgKL: Math.round(rolling3 * 100) / 100,
    societyAvgKL: Math.round(societyAvg * 100) / 100,
    blockAvgKL: Math.round(blockAvg * 100) / 100,
    estimatedBill: currentBill?.finalBill ?? 0,
    estimatedTankers: estimateTankersRequired(forecast.predictedKL, tankerCapacity),
    efficiencyScore: currentBill?.efficiencyScore ?? 100,
    timeline,
    spikes,
    anomalies,
  }

  await cacheSet(cacheKey, analytics)
  return analytics
}

export async function getAlerts(month?: string) {
  return dataStore.getAlerts(month)
}

export async function acknowledgeAlert(id: string) {
  await dataStore.acknowledgeAlert(id)
}
