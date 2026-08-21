import type { BillingConfig, Flat, FlatBill, MeterReading, SlabRate, SlabChargeBreakdown } from '@/types'

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

export function calculateEffectiveRate(config: BillingConfig, totalSocietyConsumptionKL: number): number {
  if (totalSocietyConsumptionKL <= 0) return 0
  const totalCost = calculateTotalWaterCost(config)
  return Math.round((totalCost / totalSocietyConsumptionKL) * 100) / 100
}

export function calculateWaterCharge(consumptionKL: number, effectiveRate: number): number {
  return Math.round(consumptionKL * effectiveRate * 100) / 100
}

export function calculateSlabWaterCharge(consumptionKL: number, slabs: SlabRate[]): { charge: number; breakdown: SlabChargeBreakdown[] } {
  const breakdown: SlabChargeBreakdown[] = []
  let remaining = Math.max(0, consumptionKL)
  let totalCharge = 0
  let previousLimit = 0
  const sortedSlabs = [...slabs].filter((slab) => slab.limitKL > previousLimit && slab.ratePerKL >= 0).sort((a, b) => a.limitKL - b.limitKL)

  sortedSlabs.forEach((slab, index) => {
    if (remaining <= 0) {
      breakdown.push({ slabIndex: index + 1, limitKL: slab.limitKL, ratePerKL: slab.ratePerKL, consumptionInSlabKL: 0, charge: 0 })
      return
    }
    const isLast = index === sortedSlabs.length - 1
    const slabWidth = isLast ? Infinity : Math.max(0, slab.limitKL - previousLimit)
    const consumedInSlab = Math.min(remaining, slabWidth)
    const charge = Math.round(consumedInSlab * slab.ratePerKL * 100) / 100
    breakdown.push({ slabIndex: index + 1, limitKL: slab.limitKL, ratePerKL: slab.ratePerKL, consumptionInSlabKL: Math.round(consumedInSlab * 1000) / 1000, charge })
    totalCharge += charge
    remaining -= consumedInSlab
    previousLimit = slab.limitKL
  })

  return { charge: Math.round(totalCharge * 100) / 100, breakdown }
}

export function calculateMaintenanceShare(config: BillingConfig, flatConsumptionKL: number, totalConsumptionKL: number): number {
  if (totalConsumptionKL <= 0) return 0
  return Math.round((flatConsumptionKL / totalConsumptionKL) * config.maintenanceSurcharge * 100) / 100
}

export function calculateFlatBill(reading: MeterReading, flat: Flat, config: BillingConfig, effectiveRate: number, totalSocietyConsumptionKL: number): FlatBill {
  const maintenanceShare = calculateMaintenanceShare(config, reading.consumptionKL, totalSocietyConsumptionKL)
  let waterCharge = 0
  let slabBreakdown: SlabChargeBreakdown[] | undefined
  let flatEffectiveRate = effectiveRate

  if (config.billingMode === 'slab' && config.slabs?.length) {
    const slabResult = calculateSlabWaterCharge(reading.consumptionKL, config.slabs)
    waterCharge = slabResult.charge
    slabBreakdown = slabResult.breakdown
    flatEffectiveRate = reading.consumptionKL > 0 ? Math.round((waterCharge / reading.consumptionKL) * 100) / 100 : 0
  } else {
    waterCharge = calculateWaterCharge(reading.consumptionKL, effectiveRate)
  }

  return {
    flatId: flat.id, flat, month: reading.month, openingReading: reading.openingReading, closingReading: reading.closingReading,
    consumptionLiters: reading.consumptionLiters, consumptionKL: reading.consumptionKL, effectiveRatePerKL: flatEffectiveRate,
    maintenanceShare, waterCharge, finalBill: Math.round((waterCharge + maintenanceShare) * 100) / 100,
    efficiencyScore: 0, lastUpdated: reading.updatedAt, enteredBy: reading.enteredBy, slabBreakdown,
  }
}

export function calculateEfficiencyScore(flatConsumptionKL: number, blockAvgKL: number, societyAvgKL: number): number {
  const reference = blockAvgKL > 0 ? blockAvgKL : societyAvgKL
  if (reference <= 0 || flatConsumptionKL <= 0) return 100
  const ratio = flatConsumptionKL / reference
  return Math.max(0, Math.min(100, Math.round(100 - (ratio - 1) * 50)))
}

export function estimateTankersRequired(totalConsumptionKL: number, tankerCapacityLiters: number): number {
  if (tankerCapacityLiters <= 0) return 0
  return Math.ceil((totalConsumptionKL * LITERS_PER_KL) / tankerCapacityLiters)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
}
export function formatKL(value: number): string { return `${value.toFixed(2)} kL` }
export function getCurrentMonth(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}` }
export function formatMonthLabel(month: string): string { const [year,m]=month.split('-'); return new Date(Number(year),Number(m)-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) }
export function getPreviousMonths(count: number, fromMonth?: string): string[] { const base=fromMonth??getCurrentMonth(); const [year,month]=base.split('-').map(Number); const months:string[]=[]; let y=year,m=month; for(let i=0;i<count;i++){months.unshift(`${y}-${String(m).padStart(2,'0')}`);m-=1;if(m===0){m=12;y-=1}} return months }
export function getPreviousMonth(month: string): string { const [year,m]=month.split('-').map(Number); return m===1?`${year-1}-12`:`${year}-${String(m-1).padStart(2,'0')}` }
export function getNextMonth(month: string): string { const [year,m]=month.split('-').map(Number); return m===12?`${year+1}-01`:`${year}-${String(m+1).padStart(2,'0')}` }
