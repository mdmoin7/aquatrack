import type { TankerDelivery, TankerProcurementSummary } from '@/types'
import { estimateTankersRequired } from '@/lib/billing'

export const DEFAULT_TANKER_CAPACITY_LITERS = 12000
export const DEFAULT_TANKER_COST_PER_TANKER = 1400

export function calculateDeliveryTotals(delivery: Pick<TankerDelivery, 'tankerCount' | 'capacityLiters' | 'costPerTanker'>) {
  const totalLiters = delivery.tankerCount * delivery.capacityLiters
  const totalCost = delivery.tankerCount * delivery.costPerTanker
  return { totalLiters, totalCost }
}

export function aggregateDeliveries(
  month: string,
  deliveries: TankerDelivery[],
  requiredLiters: number,
  defaultCapacityLiters = DEFAULT_TANKER_CAPACITY_LITERS,
): TankerProcurementSummary {
  const monthDeliveries = deliveries.filter(
    (d) => d.month === month && d.status !== 'cancelled',
  )
  const delivered = monthDeliveries.filter((d) => d.status === 'delivered')
  const planned = monthDeliveries.filter((d) => d.status === 'planned' || d.status === 'ordered')

  const totalTankers = delivered.reduce((s, d) => s + d.tankerCount, 0)
  const totalLiters = delivered.reduce((s, d) => s + d.totalLiters, 0)
  const totalCost = delivered.reduce((s, d) => s + d.totalCost, 0)
  const capacityLiters =
    delivered[delivered.length - 1]?.capacityLiters ??
    monthDeliveries[monthDeliveries.length - 1]?.capacityLiters ??
    defaultCapacityLiters

  const requiredTankers = estimateTankersRequired(requiredLiters / 1000, capacityLiters)
  const procurementGapLiters = Math.max(0, requiredLiters - totalLiters - planned.reduce((s, d) => s + d.totalLiters, 0))
  const procurementGapTankers = estimateTankersRequired(procurementGapLiters / 1000, capacityLiters)

  return {
    month,
    totalTankers,
    totalLiters,
    totalCost,
    avgCostPerTanker: totalTankers > 0 ? Math.round((totalCost / totalTankers) * 100) / 100 : 0,
    capacityLiters,
    deliveryCount: monthDeliveries.length,
    deliveredCount: delivered.length,
    plannedCount: planned.length,
    requiredLiters,
    requiredTankers,
    procurementGapLiters,
    procurementGapTankers,
    coveragePercent:
      requiredLiters > 0
        ? Math.min(100, Math.round((totalLiters / requiredLiters) * 100))
        : totalLiters > 0
          ? 100
          : 0,
  }
}

export function formatLiters(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} kL`
  return `${value.toLocaleString()} L`
}
