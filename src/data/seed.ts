import type { BillingConfig, Flat, MeterReading, User } from '@/types'
import { cacheClear } from '@/lib/cache'
import { societyDataNeedsJuly2026Load } from '@/lib/societyData'
import { dataStore } from '@/services/dataStore'
import { localStore } from '@/services/localStore'
import { isFirebaseConfigured } from '@/lib/firebase'
import { getActiveSocietyId } from '@/lib/firestorePaths'
import {
  getJuly2026ConsumptionRows,
  getJuly2026Flats,
  getJuly2026Readings,
  getJuly2026TotalKL,
  JULY_2026_MONTH,
} from '@/data/july2026Seed'
import {
  DEFAULT_TANKER_CAPACITY_LITERS,
  DEFAULT_TANKER_COST_PER_TANKER,
} from '@/lib/tanker'

/** Bump when seed data changes — triggers wipe of stale localStorage on next load. */
export const SEED_VERSION = '2026-07-consumption-v2'
const SEED_VERSION_KEY = 'aquatrack-seed-version'

export interface SeedPayload {
  flats: Flat[]
  readings: MeterReading[]
  billingConfigs: BillingConfig[]
  users: User[]
}

function buildJulyBillingConfig(): BillingConfig {
  const totalKL = getJuly2026TotalKL()
  const totalLiters = Math.round(totalKL * 1000)
  return {
    id: `config-${JULY_2026_MONTH}`,
    month: JULY_2026_MONTH,
    tankerCapacityLiters: DEFAULT_TANKER_CAPACITY_LITERS,
    tankerCost: DEFAULT_TANKER_COST_PER_TANKER,
    tankerCount: Math.ceil(totalLiters / DEFAULT_TANKER_CAPACITY_LITERS),
    maintenanceSurcharge: 5000,
    locked: false,
  }
}

function buildOfflineAuthUsers(): User[] {
  return [
    {
      id: 'admin',
      email: 'admin@aquatrack.local',
      displayName: 'Society Admin',
      role: 'admin',
      societyId: getActiveSocietyId(),
    },
    {
      id: 'resident-a001',
      email: 'resident@aquatrack.local',
      displayName: 'Flat A001 Resident',
      role: 'resident',
      flatId: 'A001',
      societyId: getActiveSocietyId(),
    },
    {
      id: 'meter-a',
      email: 'meter@aquatrack.local',
      displayName: 'Block A Meter Reader',
      role: 'meter_reader',
      assignedBlocks: ['A'],
      societyId: getActiveSocietyId(),
    },
  ]
}

export function buildSeedPayload(): SeedPayload {
  return {
    flats: getJuly2026Flats(),
    readings: getJuly2026Readings(),
    billingConfigs: [buildJulyBillingConfig()],
    users: buildOfflineAuthUsers(),
  }
}

export function getSocietyFlatCodes(): string[] {
  return getJuly2026ConsumptionRows().map((r) => r.flatCode)
}

async function applySeedPayload(payload: SeedPayload): Promise<void> {
  await dataStore.setFlats(payload.flats)
  await Promise.all(payload.readings.map((r) => dataStore.upsertReading(r)))
  await Promise.all(payload.billingConfigs.map((c) => dataStore.upsertBillingConfig(c)))
}

/** Load July 2026 consumption into localStorage; replaces any prior sample data. */
export async function ensureLocalSeed(): Promise<void> {
  if (isFirebaseConfigured) return

  const flats = localStore.getFlats()
  const storedVersion = localStorage.getItem(SEED_VERSION_KEY)
  const needsReseed =
    storedVersion !== SEED_VERSION || societyDataNeedsJuly2026Load(flats)

  if (!needsReseed) return

  localStore.reset()
  await cacheClear()

  const payload = buildSeedPayload()
  localStore.replaceAll({
    flats: payload.flats,
    readings: payload.readings,
    billingConfigs: payload.billingConfigs,
    flatBills: [],
    alerts: [],
    users: payload.users,
    tankerDeliveries: [],
    tankerVendors: [],
    expenses: [],
    expenseProvisions: [],
    fundCollections: [],
  })

  localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION)
}

/** Upload July 2026 data to Firestore. Pass replace=true to wipe legacy sample flats/readings first. */
export async function loadJuly2026Society(options?: { replace?: boolean }): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }

  const existing = await dataStore.getFlats()
  const replace = options?.replace ?? societyDataNeedsJuly2026Load(existing)

  if (existing.length > 0 && !replace) {
    throw new Error('Society data already exists. Use replace to reload July 2026 data.')
  }

  if (existing.length > 0) {
    await dataStore.clearSocietyData()
  }

  await cacheClear()
  await applySeedPayload(buildSeedPayload())
}

/** @deprecated Use loadJuly2026Society */
export async function seedCloudSociety(): Promise<void> {
  await loadJuly2026Society({ replace: true })
}

export function isDemoSeeded(): boolean {
  return localStore.getFlats().length > 0
}
