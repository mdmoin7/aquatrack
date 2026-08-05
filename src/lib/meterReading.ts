/** Physical meters show dial units; multiply by this to get billable liters. */
export const METER_DISPLAY_TO_LITERS = 10

export function meterDisplayToLiters(display: number): number {
  return display * METER_DISPLAY_TO_LITERS
}

export function litersToMeterDisplay(liters: number): number {
  return liters / METER_DISPLAY_TO_LITERS
}

export function parseMeterDisplayInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}
