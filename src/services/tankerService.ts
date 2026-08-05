import type { TankerDelivery, TankerOrderStatus, TankerProcurementSummary, TankerVendor } from '@/types'
import { aggregateDeliveries, calculateDeliveryTotals, DEFAULT_TANKER_CAPACITY_LITERS, DEFAULT_TANKER_COST_PER_TANKER } from '@/lib/tanker'
import { embedVehicleSnapshot } from '@/lib/vehicleSnapshot'
import { cacheGet, cacheInvalidate, cacheSet } from '@/lib/cache'
import { dataStore } from '@/services/dataStore'
import { getBillingConfig, saveBillingConfig } from '@/services/billingService'
import { getMonthlySummaries } from '@/services/readingsService'

const CACHE_PREFIX = 'tanker:'

export async function getVendors(): Promise<TankerVendor[]> {
  const vendors = await dataStore.getTankerVendors()
  return vendors.filter((v) => v.active)
}

export async function saveVendor(
  input: {
    name: string
    contactPerson?: string
    phone?: string
    defaultCapacityLiters?: number
    defaultCostPerTanker?: number
  },
  existingId?: string,
): Promise<TankerVendor> {
  const name = input.name.trim()
  if (!name) throw new Error('Vendor name is required')

  const vendor: TankerVendor = {
    id: existingId ?? crypto.randomUUID(),
    name,
    contactPerson: input.contactPerson?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    defaultCapacityLiters: input.defaultCapacityLiters ?? DEFAULT_TANKER_CAPACITY_LITERS,
    defaultCostPerTanker: input.defaultCostPerTanker ?? DEFAULT_TANKER_COST_PER_TANKER,
    active: true,
  }

  await dataStore.upsertTankerVendor(vendor)
  return vendor
}

export async function deleteVendor(id: string): Promise<void> {
  const vendors = await dataStore.getTankerVendors()
  if (!vendors.some((v) => v.id === id)) {
    throw new Error('Vendor not found.')
  }
  await dataStore.deleteTankerVendor(id)
}

export async function countVendorDeliveries(vendorId: string): Promise<number> {
  const deliveries = await dataStore.getTankerDeliveries()
  return deliveries.filter((d) => d.vendorId === vendorId).length
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
  options?: { vehicleSnapshot?: File | null },
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
  const id = existingId ?? crypto.randomUUID()

  let vehicleSnapshotUrl = existing?.vehicleSnapshotUrl
  if (options?.vehicleSnapshot) {
    vehicleSnapshotUrl = await embedVehicleSnapshot(options.vehicleSnapshot)
  }

  const delivery: TankerDelivery = {
    id,
    ...input,
    totalLiters,
    totalCost,
    ...(vehicleSnapshotUrl ? { vehicleSnapshotUrl } : {}),
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

export function canUpdateDelivery(delivery: TankerDelivery): boolean {
  return delivery.status === 'planned' || delivery.status === 'ordered'
}

const STATUS_PROGRESSION: Record<TankerOrderStatus, TankerOrderStatus[]> = {
  planned: ['planned', 'ordered', 'delivered', 'cancelled'],
  ordered: ['ordered', 'delivered', 'cancelled'],
  delivered: ['delivered'],
  cancelled: ['cancelled'],
}

export function getAllowedStatusUpdates(current: TankerOrderStatus): TankerOrderStatus[] {
  return STATUS_PROGRESSION[current] ?? [current]
}

export async function updatePendingDelivery(
  id: string,
  updates: {
    tankerCount: number
    status: TankerOrderStatus
    deliveryDate?: string
    invoiceNumber?: string
    notes?: string
  },
  options?: { vehicleSnapshot?: File | null },
): Promise<TankerDelivery> {
  const all = await dataStore.getTankerDeliveries()
  const existing = all.find((d) => d.id === id)
  if (!existing) throw new Error('Delivery not found.')
  if (!canUpdateDelivery(existing)) {
    throw new Error('Only planned or ordered deliveries can be updated.')
  }
  if (updates.tankerCount < 1) {
    throw new Error('Tanker count must be at least 1.')
  }

  const allowed = getAllowedStatusUpdates(existing.status)
  if (!allowed.includes(updates.status)) {
    throw new Error(`Cannot change status from ${existing.status} to ${updates.status}.`)
  }

  return saveDelivery(
    {
      month: existing.month,
      deliveryDate: updates.deliveryDate ?? existing.deliveryDate,
      vendorId: existing.vendorId,
      vendorName: existing.vendorName,
      tankerCount: updates.tankerCount,
      capacityLiters: existing.capacityLiters,
      costPerTanker: existing.costPerTanker,
      invoiceNumber: updates.invoiceNumber?.trim() || undefined,
      status: updates.status,
      notes: updates.notes?.trim() || undefined,
      orderedBy: existing.orderedBy,
    },
    options,
    id,
  )
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
