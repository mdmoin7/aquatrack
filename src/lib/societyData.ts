import type { Flat } from '@/types'
import { getJuly2026ConsumptionRows } from '@/data/july2026Seed'

const LEGACY_FLAT_PATTERN = /^[ABC]-\d/

function getOfficialFlatIds(): string[] {
  return getJuly2026ConsumptionRows().map((r) => r.flatCode)
}

export function isOfficialFlatId(flatId: string): boolean {
  return getOfficialFlatIds().includes(flatId)
}

/** True when flats are from the old random sample (e.g. A-1B) or don't match July 2026 CSV. */
export function isLegacySocietyFlats(flats: Flat[]): boolean {
  if (flats.length === 0) return false

  const official = new Set(getOfficialFlatIds())
  if (flats.length !== official.size) return true

  return flats.some(
    (f) => !official.has(f.id) || LEGACY_FLAT_PATTERN.test(f.id) || LEGACY_FLAT_PATTERN.test(f.label),
  )
}

export function societyDataNeedsJuly2026Load(flats: Flat[]): boolean {
  return flats.length === 0 || isLegacySocietyFlats(flats)
}
