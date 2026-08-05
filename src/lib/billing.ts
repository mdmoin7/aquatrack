import type { BillingConfig, Flat, FlatBill, MeterReading } from '@/types'

const LITERS_PER_KL = 1000

export function litersToKL(liters: number): number {
  return Math.round((liters / LITERS_PER_KL) * 1000) / 1000
}

export function calculateConsumption(opening: number, closing: number): number {
  if (closing < opening) return 0
  return closing - opening
}

export function calculateTotalWaterCost(config: BillingConfig): number {
  return config.tankerCount * config.tankerCost + config.maintenanceSurcharge
}

export function calculateEffectiveRate(
  config: BillingConfig,
  totalSocietyConsumptionKL: number,
): number {
  if (totalSocietyConsumptionKL <= 0) return 0
  const totalCost = calculateTotalWaterCost(config)
  return Math.round((totalCost / totalSocietyConsumptionKL) * 100) / 100
}

export function calculateWaterCharge(consumptionKL: number, effectiveRate: number): number {
  return Math.round(consumptionKL * effectiveRate * 100) / 100
}

export function calculateMaintenanceShare(
  config: BillingConfig,
  flatConsumptionKL: number,
  totalConsumptionKL: number,
): number {
  if (totalConsumptionKL <= 0) return 0
  return Math.round((flatConsumptionKL / totalConsumptionKL) * config.maintenanceSurcharge * 100) / 100
}

export function calculateFlatBill(
  reading: MeterReading,
  flat: Flat,
  config: BillingConfig,
  effectiveRate: number,
  totalSocietyConsumptionKL: number,
): FlatBill {
  const maintenanceShare = calculateMaintenanceShare(
    config,
    reading.consumptionKL,
    totalSocietyConsumptionKL,
  )
  const waterCharge = calculateWaterCharge(reading.consumptionKL, effectiveRate)
  const finalBill = Math.round((waterCharge + maintenanceShare) * 100) / 100

  return {
    flatId: flat.id,
    flat,
    month: reading.month,
    openingReading: reading.openingReading,
    closingReading: reading.closingReading,
    consumptionLiters: reading.consumptionLiters,
    consumptionKL: reading.consumptionKL,
    effectiveRatePerKL: effectiveRate,
    maintenanceShare,
    waterCharge,
    finalBill,
    efficiencyScore: 0,
    lastUpdated: reading.updatedAt,
    enteredBy: reading.enteredBy,
  }
}

export function calculateEfficiencyScore(
  flatConsumptionKL: number,
  blockAvgKL: number,
  societyAvgKL: number,
): number {
  const reference = blockAvgKL > 0 ? blockAvgKL : societyAvgKL
  if (reference <= 0 || flatConsumptionKL <= 0) return 100
  const ratio = flatConsumptionKL / reference
  const score = Math.max(0, Math.min(100, Math.round(100 - (ratio - 1) * 50)))
  return score
}

export function estimateTankersRequired(
  totalConsumptionKL: number,
  tankerCapacityLiters: number,
): number {
  if (tankerCapacityLiters <= 0) return 0
  const totalLiters = totalConsumptionKL * LITERS_PER_KL
  return Math.ceil(totalLiters / tankerCapacityLiters)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatKL(value: number): string {
  return `${value.toFixed(2)} kL`
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function getPreviousMonths(count: number, fromMonth?: string): string[] {
  const base = fromMonth ?? getCurrentMonth()
  const [year, month] = base.split('-').map(Number)
  const months: string[] = []
  let y = year
  let m = month
  for (let i = 0; i < count; i++) {
    months.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return months
}

export function getPreviousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (m === 1) return `${year - 1}-12`
  return `${year}-${String(m - 1).padStart(2, '0')}`
}

export function getNextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (m === 12) return `${year + 1}-01`
  return `${year}-${String(m + 1).padStart(2, '0')}`
}
