import type { MeterReading, UserRole, WaterMeter } from '@/types'
import { calculateConsumption, formatMonthLabel, getNextMonth, litersToKL } from '@/lib/billing'
import { cacheInvalidate, cacheInvalidatePrefix, CacheKeys } from '@/lib/cache'
import { canManageReadings } from '@/lib/roles'
import { sortReadingsChronologically } from '@/lib/readings'
import { dataStore } from '@/services/dataStore'

export const LEGACY_METER_SERIAL = 'LEGACY'

let ensureInflight: Promise<void> | null = null
const backfillSkippedFlats = new Set<string>()

function generateId(): string {
  return crypto.randomUUID()
}

export async function ensureLegacyMeters(): Promise<void> {
  if (!ensureInflight) {
    ensureInflight = backfillLegacyMeters().finally(() => {
      ensureInflight = null
    })
  }
  return ensureInflight
}

async function backfillLegacyMeters(): Promise<void> {
  const readings = await dataStore.getReadings()
  if (!readings.some((reading) => !reading.meterId)) return

  let meters: WaterMeter[]
  try {
    meters = await dataStore.getMeters()
  } catch {
    return
  }
  const activeByFlat = new Map(
    meters.filter((meter) => meter.status === 'active').map((meter) => [meter.flatId, meter]),
  )
  const unstampedByFlat = new Map<string, MeterReading[]>()
  for (const reading of readings) {
    if (reading.meterId) continue
    const list = unstampedByFlat.get(reading.flatId) ?? []
    list.push(reading)
    unstampedByFlat.set(reading.flatId, list)
  }

  const now = new Date().toISOString()
  for (const [flatId, rows] of unstampedByFlat) {
    if (backfillSkippedFlats.has(flatId)) continue
    try {
      let meter = activeByFlat.get(flatId)
      if (!meter) {
        const earliest = sortReadingsChronologically(rows)[0]
        meter = {
          id: generateId(),
          flatId,
          serialNumber: LEGACY_METER_SERIAL,
          status: 'active',
          installedAt: earliest.createdAt,
          startReading: earliest.openingReading,
          createdBy: 'system',
          createdAt: now,
        }
        await dataStore.upsertMeter(meter)
        activeByFlat.set(flatId, meter)
      }
      for (const reading of rows) {
        await dataStore.upsertReading({ ...reading, meterId: meter.id })
      }
    } catch (error) {
      backfillSkippedFlats.add(flatId)
      const message = error instanceof Error ? error.message : ''
      if (/permission|insufficient|unauth/i.test(message)) {
        for (const id of unstampedByFlat.keys()) backfillSkippedFlats.add(id)
        break
      }
    }
  }

  await cacheInvalidatePrefix('readings:')
  await cacheInvalidatePrefix('monthly-summaries:')
  await cacheInvalidatePrefix('month-rollover:')
}

export function activeMeterForFlat(meters: WaterMeter[], flatId: string): WaterMeter | undefined {
  return meters.find((meter) => meter.flatId === flatId && meter.status === 'active')
}

export async function getMeters(): Promise<WaterMeter[]> {
  try {
    return await dataStore.getMeters()
  } catch {
    return []
  }
}

export async function ensureActiveMeterForReading(
  flatId: string,
  startReading: number,
  installedAt: string,
  createdBy: string,
): Promise<WaterMeter> {
  const meters = await dataStore.getMeters()
  const active = activeMeterForFlat(meters, flatId)
  if (active) return active
  const meter: WaterMeter = {
    id: generateId(),
    flatId,
    serialNumber: LEGACY_METER_SERIAL,
    status: 'active',
    installedAt,
    startReading,
    createdBy,
    createdAt: installedAt,
  }
  await dataStore.upsertMeter(meter)
  return meter
}

export async function getActiveMeter(flatId: string): Promise<WaterMeter | null> {
  await ensureLegacyMeters()
  const meters = await getMeters()
  return activeMeterForFlat(meters, flatId) ?? null
}

export interface ReplaceMeterInput {
  flatId: string
  replacementDate: string
  finalReadingLiters: number
  newSerialNumber: string
  startReadingLiters: number
  reason: string
  enteredBy: string
  enteredByRole: UserRole
}

export async function replaceMeter(input: ReplaceMeterInput): Promise<WaterMeter> {
  if (!canManageReadings(input.enteredByRole)) {
    throw new Error('Only an admin can replace a meter.')
  }

  const replacementDate = input.replacementDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(replacementDate)) {
    throw new Error('Enter the replacement date.')
  }
  const month = replacementDate.slice(0, 7)
  const serial = input.newSerialNumber.trim()
  if (!serial) throw new Error('Enter the new meter serial number.')
  if (!Number.isFinite(input.finalReadingLiters) || input.finalReadingLiters < 0) {
    throw new Error('Enter the old meter’s final dial reading.')
  }
  if (!Number.isFinite(input.startReadingLiters) || input.startReadingLiters < 0) {
    throw new Error('Enter the new meter’s starting dial reading.')
  }

  await ensureLegacyMeters()
  const [meters, readings, flats, config] = await Promise.all([
    dataStore.getMeters(),
    dataStore.getReadings(),
    dataStore.getFlats(),
    dataStore.getBillingConfig(month),
  ])
  if (config?.locked) {
    throw new Error(`Billing for ${formatMonthLabel(month)} is locked. Readings cannot be modified.`)
  }

  const flat = flats.find((item) => item.id === input.flatId)
  if (!flat) throw new Error('Flat not found.')

  const activeMeters = meters.filter((meter) => meter.flatId === input.flatId && meter.status === 'active')
  if (activeMeters.length === 0) {
    throw new Error('This flat has no active meter. Enter an initial reading before replacing it.')
  }
  if (activeMeters.length > 1) {
    throw new Error('This flat has more than one active meter. Resolve that before replacing.')
  }
  const current = activeMeters[0]

  const serialTaken = meters.some(
    (meter) => meter.serialNumber.trim().toLowerCase() === serial.toLowerCase(),
  )
  if (serialTaken) throw new Error(`Serial ${serial} is already used by another meter.`)

  const meterReadings = sortReadingsChronologically(
    readings.filter((reading) => reading.meterId === current.id),
  )
  const latest = meterReadings[meterReadings.length - 1]
  if (latest && latest.month > month) {
    throw new Error(
      `This meter already has readings in ${formatMonthLabel(latest.month)}. Choose a replacement date in that month or later.`,
    )
  }

  const openingReading = latest?.closingReading ?? current.startReading
  if (input.finalReadingLiters < openingReading) {
    throw new Error(
      `Final reading (${input.finalReadingLiters} L) cannot be less than the last reading on this meter (${openingReading} L).`,
    )
  }

  const now = new Date().toISOString()
  const removedAt = `${replacementDate}T12:00:00.000Z`
  const newMeterId = generateId()
  const consumptionLiters = calculateConsumption(openingReading, input.finalReadingLiters)
  const finalCreatedAt =
    latest && latest.createdAt >= now
      ? new Date(Date.parse(latest.createdAt) + 1).toISOString()
      : now

  const finalReading: MeterReading = {
    id: generateId(),
    flatId: input.flatId,
    month,
    meterId: current.id,
    entryKind: 'replacement_final',
    openingReading,
    closingReading: input.finalReadingLiters,
    consumptionLiters,
    consumptionKL: litersToKL(consumptionLiters),
    enteredBy: input.enteredBy,
    enteredByRole: input.enteredByRole,
    createdAt: finalCreatedAt,
    updatedAt: now,
    auditTrail: [
      {
        action: 'create',
        userId: input.enteredBy,
        userName: `${input.enteredBy} (meter replacement final)`,
        timestamp: now,
      },
    ],
  }

  const removed: WaterMeter = {
    ...current,
    status: 'removed',
    removedAt,
    finalReading: input.finalReadingLiters,
    removalReason: input.reason.trim() || 'Fault',
    replacedByMeterId: newMeterId,
  }
  const installed: WaterMeter = {
    id: newMeterId,
    flatId: input.flatId,
    serialNumber: serial,
    status: 'active',
    installedAt: removedAt,
    startReading: input.startReadingLiters,
    replacesMeterId: current.id,
    createdBy: input.enteredBy,
    createdAt: now,
  }

  await dataStore.upsertMeter(removed)
  await dataStore.upsertReading(finalReading)
  await dataStore.upsertMeter(installed)
  await dataStore.upsertAlerts([
    {
      id: `meter-replaced-${newMeterId}`,
      flatId: flat.id,
      flatLabel: flat.label,
      type: 'meter_replaced',
      message: `${flat.label}: meter ${current.serialNumber} replaced by ${serial}. Final reading ${input.finalReadingLiters.toLocaleString()} L, new meter starts at ${input.startReadingLiters.toLocaleString()} L.`,
      severity: 'high',
      month,
      createdAt: now,
      acknowledged: false,
    },
  ])

  const nextMonth = getNextMonth(month)
  await cacheInvalidate(CacheKeys.readings(month))
  await cacheInvalidate(CacheKeys.readings('all'))
  await cacheInvalidate(`monthly-summaries:v2:${month}`)
  await cacheInvalidate(`month-rollover:${month}`)
  await cacheInvalidate(`month-rollover:${nextMonth}`)
  await cacheInvalidate(CacheKeys.dashboard(month))
  await cacheInvalidate(CacheKeys.alerts(month))
  await cacheInvalidatePrefix('analytics:')

  return installed
}
