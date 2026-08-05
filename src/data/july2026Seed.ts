import type { BlockId, Flat, MeterReading } from '@/types'
import { calculateConsumption, litersToKL } from '@/lib/billing'
import consumptionCsv from './consumption-2026-07.csv?raw'

export const JULY_2026_MONTH = '2026-07'

export interface ConsumptionCsvRow {
  flatCode: string
  opening: number
  closing: number
  delta: number
  totalKL: number
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/,/g, '').trim()
  if (!cleaned) return 0
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : 0
}

function parseFlatBlock(flatCode: string): BlockId {
  if (flatCode === 'Common' || flatCode === 'Pool') return 'COMMON'
  const block = flatCode[0]
  if (block === 'A' || block === 'B' || block === 'C') return block
  return 'COMMON'
}

function parseFlatUnit(flatCode: string): string {
  if (flatCode === 'Common' || flatCode === 'Pool') return flatCode
  return flatCode.slice(1)
}

export function parseConsumptionCsv(text: string): ConsumptionCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const rows: ConsumptionCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const [flatCode, opening, closing, delta, totalKL] = lines[i].split(',')
    if (!flatCode?.trim()) continue
    rows.push({
      flatCode: flatCode.trim(),
      opening: parseNumber(opening),
      closing: parseNumber(closing),
      delta: parseNumber(delta),
      totalKL: parseNumber(totalKL),
    })
  }
  return rows
}

export function buildFlatsFromConsumptionRows(rows: ConsumptionCsvRow[]): Flat[] {
  return rows.map((row) => ({
    id: row.flatCode,
    block: parseFlatBlock(row.flatCode),
    unit: parseFlatUnit(row.flatCode),
    label: row.flatCode,
  }))
}

export function buildReadingsFromConsumptionRows(
  rows: ConsumptionCsvRow[],
  month: string = JULY_2026_MONTH,
): MeterReading[] {
  const timestamp = `${month}-31T10:00:00.000Z`

  return rows
    .filter((row) => row.opening > 0 || row.closing > 0)
    .map((row) => {
      const consumptionLiters = calculateConsumption(row.opening, row.closing)
      return {
        id: `${row.flatCode}-${month}`,
        flatId: row.flatCode,
        month,
        openingReading: row.opening,
        closingReading: row.closing,
        consumptionLiters,
        consumptionKL: litersToKL(consumptionLiters),
        enteredBy: 'CSV Import',
        enteredByRole: 'admin' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
        auditTrail: [
          {
            action: 'create' as const,
            userId: 'seed',
            userName: 'July 2026 Consumption Import',
            timestamp,
          },
        ],
      }
    })
}

export function getJuly2026ConsumptionRows(): ConsumptionCsvRow[] {
  return parseConsumptionCsv(consumptionCsv)
}

export function getJuly2026Flats(): Flat[] {
  return buildFlatsFromConsumptionRows(getJuly2026ConsumptionRows())
}

export function getJuly2026Readings(): MeterReading[] {
  return buildReadingsFromConsumptionRows(getJuly2026ConsumptionRows())
}

export function getJuly2026TotalKL(): number {
  return getJuly2026Readings().reduce((sum, r) => sum + r.consumptionKL, 0)
}
