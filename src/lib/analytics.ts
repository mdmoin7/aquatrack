import type { Alert, AlertType, Flat, MeterReading } from '@/types'

const SPIKE_THRESHOLD = 0.5
const DROP_THRESHOLD = 0.4

export function detectSpike(
  currentKL: number,
  previousKL: number,
): { detected: boolean; percentIncrease: number } {
  if (previousKL <= 0) return { detected: false, percentIncrease: 0 }
  const increase = (currentKL - previousKL) / previousKL
  return {
    detected: increase >= SPIKE_THRESHOLD,
    percentIncrease: Math.round(increase * 100),
  }
}

export function detectSuddenDrop(
  currentKL: number,
  previousKL: number,
): boolean {
  if (previousKL <= 0) return false
  const drop = (previousKL - currentKL) / previousKL
  return drop >= DROP_THRESHOLD
}

export function detectMeterReset(
  opening: number,
  closing: number,
  previousClosing?: number,
): boolean {
  if (closing < opening) return true
  if (previousClosing !== undefined && opening < previousClosing * 0.5) return true
  return false
}

export function generateAlertsForReading(
  reading: MeterReading,
  flat: Flat,
  previousReading?: MeterReading,
): Alert[] {
  const alerts: Alert[] = []
  const base = {
    flatId: flat.id,
    flatLabel: flat.label,
    month: reading.month,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  }

  if (detectMeterReset(reading.openingReading, reading.closingReading, previousReading?.closingReading)) {
    alerts.push({
      ...base,
      id: `${reading.id}-reset`,
      type: 'meter_reset' as AlertType,
      message: `Possible meter reset detected for ${flat.label}`,
      severity: 'high',
    })
  }

  if (previousReading) {
    const spike = detectSpike(reading.consumptionKL, previousReading.consumptionKL)
    if (spike.detected) {
      alerts.push({
        ...base,
        id: `${reading.id}-spike`,
        type: 'consumption_spike',
        message: `${flat.label}: consumption up ${spike.percentIncrease}% vs last month`,
        severity: spike.percentIncrease > 80 ? 'high' : 'medium',
      })
    }

    if (detectSuddenDrop(reading.consumptionKL, previousReading.consumptionKL)) {
      alerts.push({
        ...base,
        id: `${reading.id}-drop`,
        type: 'sudden_drop',
        message: `${flat.label}: sudden consumption drop detected`,
        severity: 'medium',
      })
    }

    if (reading.consumptionKL > previousReading.consumptionKL * 2.5) {
      alerts.push({
        ...base,
        id: `${reading.id}-leak`,
        type: 'leakage_suspicion',
        message: `${flat.label}: possible leakage — consumption more than 2.5× previous month`,
        severity: 'high',
      })
    }
  }

  return alerts
}

export function buildBlockHeatmapData(
  flats: Flat[],
  readings: MeterReading[],
  blockAvgs: Record<string, number>,
): Array<{ flat: Flat; intensity: number; consumptionKL: number }> {
  return flats.map((flat) => {
    const reading = readings.find((r) => r.flatId === flat.id)
    const consumptionKL = reading?.consumptionKL ?? 0
    const blockAvg = blockAvgs[flat.block] ?? 1
    const ratio = blockAvg > 0 ? consumptionKL / blockAvg : 0
    const intensity = Math.min(1, ratio / 2)
    return { flat, intensity, consumptionKL }
  })
}

export function forecastNextMonth(
  historicalKL: number[],
): { predictedKL: number; tankersNeeded: number; confidence: 'low' | 'medium' | 'high' } {
  if (historicalKL.length === 0) {
    return { predictedKL: 0, tankersNeeded: 0, confidence: 'low' }
  }
  const weights = historicalKL.map((_, i) => i + 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const weighted = historicalKL.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight
  const trend =
    historicalKL.length >= 2
      ? historicalKL[historicalKL.length - 1] - historicalKL[historicalKL.length - 2]
      : 0
  const predictedKL = Math.max(0, Math.round((weighted + trend * 0.3) * 100) / 100)
  return {
    predictedKL,
    tankersNeeded: Math.ceil(predictedKL),
    confidence: historicalKL.length >= 6 ? 'high' : historicalKL.length >= 3 ? 'medium' : 'low',
  }
}
