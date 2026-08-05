import type { TankerDelivery, TankerOrderStatus, TankerProcurementSummary, TankerVendor } from '@/types'
import { aggregateDeliveries, calculateDeliveryTotals, DEFAULT_TANKER_CAPACITY_LITERS } from '@/lib/tanker'
import { cacheGet, cacheInvalidate, cacheSet } from '@/lib/cache'
import { dataStore } from '@/services/dataStore'
import { getBillingConfig, saveBillingConfig } from '@/services/billingService'
import { getMonthlySummaries } from '@/services/readingsService'

const CACHE_PREFIX = 'tanker:'

export async function getVendors(): Promise<TankerVendor[]> {
  const vendors = await dataStore.getTankerVendors()
  return vendors.filter((v) => v.active)
}

export async function getDeliveries(month: string): Promise<TankerDelivery[]> {
  const cacheKey = `${CACHE_PREFIX}deliveries:${month}`
  const cached = await cacheGet<TankerDelivery[]>(cacheKey)
  if (cached) return cached
  const deliveries = (await dataStore.getTankerDeliveries(month)).sort((a, b) =>
    b.deliveryDate.localeCompare(a.deliveryDate),
  )
  await cacheSet(cacheKey, deliveries)
  return deliveries
}

export async function getProcurementSummary(month: string): Promise<TankerProcurementSummary> {
  const cacheKey = `${CACHE_PREFIX}summary:${month}`
  const cached = await cacheGet<TankerProcurementSummary>(cacheKey)
  if (cached) return cached

  const [deliveries, summaries, config] = await Promise.all([
    getDeliveries(month),
    getMonthlySummaries(month),
    getBillingConfig(month),
  ])

  const requiredLiters = summaries.reduce((s, r) => s + r.consumptionLiters, 0)
  const summary = aggregateDeliveries(
    month,
    deliveries,
    requiredLiters,
    config?.tankerCapacityLiters ?? DEFAULT_TANKER_CAPACITY_LITERS,
  )
  await cacheSet(cacheKey, summary)
  return summary
}

export async function saveDelivery(
  input: {
    month: string
    deliveryDate: string
    vendorId: string
    vendorName: string
    tankerCount: number
    capacityLiters: number
    costPerTanker: number
    invoiceNumber?: string
    status: TankerOrderStatus
    notes?: string
    orderedBy: string
  },
  existingId?: string,
): Promise<TankerDelivery> {
  const config = await dataStore.getBillingConfig(input.month)
  if (config?.locked) {
    throw new Error('Billing for this month is locked. Procurement cannot be modified.')
  }

  const { totalLiters, totalCost } = calculateDeliveryTotals(input)
  const now = new Date().toISOString()
  const all = await dataStore.getTankerDeliveries()
  const existing = existingId ? all.find((d) => d.id === existingId) : undefined

  const delivery: TankerDelivery = {
    id: existingId ?? crypto.randomUUID(),
    ...input,
    totalLiters,
    totalCost,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await dataStore.upsertTankerDelivery(delivery)
  await invalidateTankerCache(input.month)

  if (delivery.status === 'delivered') {
    await syncProcurementToBilling(input.month)
  }

  return delivery
}

export async function deleteDelivery(id: string): Promise<void> {
  const all = await dataStore.getTankerDeliveries()
  const delivery = all.find((d) => d.id === id)
  if (!delivery) throw new Error('Delivery not found.')

  const config = await dataStore.getBillingConfig(delivery.month)
  if (config?.locked) throw new Error('Billing for this month is locked.')

  await dataStore.deleteTankerDelivery(id)
  await invalidateTankerCache(delivery.month)
  await syncProcurementToBilling(delivery.month)
}

export async function syncProcurementToBilling(month: string): Promise<void> {
  const config = await dataStore.getBillingConfig(month)
  if (config?.locked) return

  const summary = await getProcurementSummary(month)
  if (summary.totalTankers === 0) return

  await saveBillingConfig({
    month,
    tankerCapacityLiters: summary.capacityLiters,
    tankerCost: summary.avgCostPerTanker,
    tankerCount: summary.totalTankers,
    maintenanceSurcharge: config?.maintenanceSurcharge ?? 5000,
  })
}

async function invalidateTankerCache(month: string): Promise<void> {
  await cacheInvalidate(`${CACHE_PREFIX}deliveries:${month}`)
  await cacheInvalidate(`${CACHE_PREFIX}summary:${month}`)
  await cacheInvalidate(`dashboard:${month}`)
  await cacheInvalidate(`billing:${month}`)
}
