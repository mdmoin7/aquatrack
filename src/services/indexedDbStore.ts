import type {
  Alert,
  BillingConfig,
  Flat,
  MeterReading,
  StoredFlatBill,
  TankerDelivery,
  TankerVendor,
  SocietyExpense,
  MonthlyExpenseProvision,
  FundCollection,
  User,
} from '@/types'

const DB_NAME = 'aquatrack-local'
const DB_VERSION = 1
const LEGACY_KEY = 'aquatrack-data'

const STORES = [
  'flats',
  'readings',
  'billingConfigs',
  'flatBills',
  'alerts',
  'users',
  'tankerDeliveries',
  'tankerVendors',
  'expenses',
  'expenseProvisions',
  'fundCollections',
] as const

type StoreName = (typeof STORES)[number]

interface AppData {
  flats: Flat[]
  readings: MeterReading[]
  billingConfigs: BillingConfig[]
  flatBills: StoredFlatBill[]
  alerts: Alert[]
  users: User[]
  tankerDeliveries: TankerDelivery[]
  tankerVendors: TankerVendor[]
  expenses: SocietyExpense[]
  expenseProvisions: MonthlyExpenseProvision[]
  fundCollections: FundCollection[]
}

const EMPTY_DATA: AppData = {
  flats: [],
  readings: [],
  billingConfigs: [],
  flatBills: [],
  alerts: [],
  users: [],
  tankerDeliveries: [],
  tankerVendors: [],
  expenses: [],
  expenseProvisions: [],
  fundCollections: [],
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local database'))
  })
  return dbPromise
}

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function put<T extends { id: string }>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function remove(storeName: StoreName, id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clear(storeName: StoreName): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function migrateLegacyData(): Promise<void> {
  const markerStore = 'flats'
  const existing = await getAll<Flat>(markerStore)
  if (existing.length > 0) return

  let legacy: Partial<AppData> | null = null
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw) legacy = JSON.parse(raw) as Partial<AppData>
  } catch {
    legacy = null
  }

  if (!legacy) return

  const data: AppData = {
    ...EMPTY_DATA,
    ...legacy,
    flatBills: legacy.flatBills ?? [],
    alerts: legacy.alerts ?? [],
    users: legacy.users ?? [],
    tankerDeliveries: legacy.tankerDeliveries ?? [],
    tankerVendors: legacy.tankerVendors ?? [],
    expenses: legacy.expenses ?? [],
    expenseProvisions: legacy.expenseProvisions ?? [],
    fundCollections: legacy.fundCollections ?? [],
  }

  for (const store of STORES) {
    const records = data[store]
    for (const record of records as Array<{ id: string }>) {
      await put(store, record)
    }
  }
}

async function ready(): Promise<void> {
  await openDb()
  await migrateLegacyData()
}

export const indexedDbStore = {
  async getFlats(): Promise<Flat[]> {
    await ready()
    return getAll<Flat>('flats')
  },
  async setFlats(flats: Flat[]): Promise<void> {
    await ready(); await clear('flats'); await Promise.all(flats.map((item) => put('flats', item)))
  },
  async getReadings(month?: string): Promise<MeterReading[]> {
    await ready(); const items = await getAll<MeterReading>('readings'); return month ? items.filter((item) => item.month === month) : items
  },
  async upsertReading(item: MeterReading): Promise<void> { await ready(); await put('readings', item) },
  async deleteReading(id: string): Promise<void> { await ready(); await remove('readings', id) },
  async getBillingConfig(month: string): Promise<BillingConfig | null> {
    await ready(); const items = await getAll<BillingConfig>('billingConfigs'); return items.find((item) => item.month === month) ?? null
  },
  async getBillingConfigs(): Promise<BillingConfig[]> { await ready(); return getAll<BillingConfig>('billingConfigs') },
  async upsertBillingConfig(item: BillingConfig): Promise<void> { await ready(); await put('billingConfigs', item) },
  async getFlatBills(month: string): Promise<StoredFlatBill[]> {
    await ready(); const items = await getAll<StoredFlatBill>('flatBills'); return items.filter((item) => item.month === month)
  },
  async saveFlatBills(month: string, bills: StoredFlatBill[]): Promise<void> {
    await ready(); const existing = await getAll<StoredFlatBill>('flatBills'); const keep = existing.filter((item) => item.month !== month); await clear('flatBills'); await Promise.all([...keep, ...bills].map((item) => put('flatBills', item)))
  },
  async getAlerts(month?: string): Promise<Alert[]> {
    await ready(); const items = await getAll<Alert>('alerts'); return month ? items.filter((item) => item.month === month) : items
  },
  async upsertAlerts(items: Alert[]): Promise<void> { await ready(); await Promise.all(items.map((item) => put('alerts', item))) },
  async acknowledgeAlert(id: string): Promise<void> {
    await ready(); const items = await getAll<Alert>('alerts'); const item = items.find((alert) => alert.id === id); if (item) await put('alerts', { ...item, acknowledged: true })
  },
  async getUsers(): Promise<User[]> { await ready(); return getAll<User>('users') },
  async getTankerDeliveries(month?: string): Promise<TankerDelivery[]> {
    await ready(); const items = await getAll<TankerDelivery>('tankerDeliveries'); return month ? items.filter((item) => item.month === month) : items
  },
  async upsertTankerDelivery(item: TankerDelivery): Promise<void> { await ready(); await put('tankerDeliveries', item) },
  async deleteTankerDelivery(id: string): Promise<void> { await ready(); await remove('tankerDeliveries', id) },
  async getTankerVendors(): Promise<TankerVendor[]> { await ready(); return getAll<TankerVendor>('tankerVendors') },
  async upsertTankerVendor(item: TankerVendor): Promise<void> { await ready(); await put('tankerVendors', item) },
  async deleteTankerVendor(id: string): Promise<void> { await ready(); await remove('tankerVendors', id) },
  async getExpenses(month?: string): Promise<SocietyExpense[]> {
    await ready(); const items = await getAll<SocietyExpense>('expenses'); return month ? items.filter((item) => item.month === month) : items
  },
  async upsertExpense(item: SocietyExpense): Promise<void> { await ready(); await put('expenses', item) },
  async deleteExpense(id: string): Promise<void> { await ready(); await remove('expenses', id) },
  async getExpenseProvision(month: string): Promise<MonthlyExpenseProvision | null> {
    await ready(); const items = await getAll<MonthlyExpenseProvision>('expenseProvisions'); return items.find((item) => item.billingMonth === month) ?? null
  },
  async upsertExpenseProvision(item: MonthlyExpenseProvision): Promise<void> { await ready(); await put('expenseProvisions', item) },
  async deleteExpenseProvision(month: string): Promise<void> {
    await ready(); const items = await getAll<MonthlyExpenseProvision>('expenseProvisions'); const item = items.find((provision) => provision.billingMonth === month); if (item) await remove('expenseProvisions', item.id)
  },
  async getFundCollections(month?: string): Promise<FundCollection[]> {
    await ready(); const items = await getAll<FundCollection>('fundCollections'); return month ? items.filter((item) => item.billingMonth === month) : items
  },
  async upsertFundCollection(item: FundCollection): Promise<void> { await ready(); await put('fundCollections', item) },
  async deleteFundCollection(id: string): Promise<void> { await ready(); await remove('fundCollections', id) },
  async upsertUserProfile(user: User): Promise<void> { await ready(); await put('users', user) },
  async clearAll(): Promise<void> { await ready(); await Promise.all(STORES.map((store) => clear(store))) },
}
