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

const STORE_KEY = 'aquatrack-data'

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

const DEFAULT_DATA: AppData = {
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

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as AppData
  } catch {
    /* use default */
  }
  return structuredClone(DEFAULT_DATA)
}

function save(data: AppData): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(data))
}

export const localStore = {
  getFlats(): Flat[] {
    return load().flats
  },

  setFlats(flats: Flat[]): void {
    const data = load()
    data.flats = flats
    save(data)
  },

  getReadings(month?: string): MeterReading[] {
    const readings = load().readings
    return month ? readings.filter((r) => r.month === month) : readings
  },

  upsertReading(reading: MeterReading): void {
    const data = load()
    const idx = data.readings.findIndex((r) => r.id === reading.id)
    if (idx >= 0) data.readings[idx] = reading
    else data.readings.push(reading)
    save(data)
  },

  deleteReading(id: string): void {
    const data = load()
    data.readings = data.readings.filter((r) => r.id !== id)
    save(data)
  },

  getBillingConfig(month: string): BillingConfig | null {
    return load().billingConfigs.find((c) => c.month === month) ?? null
  },

  getBillingConfigs(): BillingConfig[] {
    return load().billingConfigs
  },

  upsertBillingConfig(config: BillingConfig): void {
    const data = load()
    const idx = data.billingConfigs.findIndex((c) => c.month === config.month)
    if (idx >= 0) data.billingConfigs[idx] = config
    else data.billingConfigs.push(config)
    save(data)
  },

  getFlatBills(month: string): StoredFlatBill[] {
    const bills = load().flatBills ?? []
    return bills.filter((b) => b.month === month)
  },

  saveFlatBills(month: string, bills: StoredFlatBill[]): void {
    const data = load()
    if (!data.flatBills) data.flatBills = []
    data.flatBills = data.flatBills.filter((b) => b.month !== month).concat(bills)
    save(data)
  },

  getAlerts(month?: string): Alert[] {
    const alerts = load().alerts
    return month ? alerts.filter((a) => a.month === month) : alerts
  },

  upsertAlerts(newAlerts: Alert[]): void {
    const data = load()
    for (const alert of newAlerts) {
      const idx = data.alerts.findIndex((a) => a.id === alert.id)
      if (idx >= 0) data.alerts[idx] = alert
      else data.alerts.push(alert)
    }
    save(data)
  },

  acknowledgeAlert(id: string): void {
    const data = load()
    const alert = data.alerts.find((a) => a.id === id)
    if (alert) alert.acknowledged = true
    save(data)
  },

  getUsers(): User[] {
    return load().users
  },

  getTankerDeliveries(month?: string): TankerDelivery[] {
    const deliveries = load().tankerDeliveries ?? []
    return month ? deliveries.filter((d) => d.month === month) : deliveries
  },

  upsertTankerDelivery(delivery: TankerDelivery): void {
    const data = load()
    if (!data.tankerDeliveries) data.tankerDeliveries = []
    const idx = data.tankerDeliveries.findIndex((d) => d.id === delivery.id)
    if (idx >= 0) data.tankerDeliveries[idx] = delivery
    else data.tankerDeliveries.push(delivery)
    save(data)
  },

  deleteTankerDelivery(id: string): void {
    const data = load()
    data.tankerDeliveries = (data.tankerDeliveries ?? []).filter((d) => d.id !== id)
    save(data)
  },

  getTankerVendors(): TankerVendor[] {
    return load().tankerVendors ?? []
  },

  upsertTankerVendor(vendor: TankerVendor): void {
    const data = load()
    if (!data.tankerVendors) data.tankerVendors = []
    const idx = data.tankerVendors.findIndex((v) => v.id === vendor.id)
    if (idx >= 0) data.tankerVendors[idx] = vendor
    else data.tankerVendors.push(vendor)
    save(data)
  },

  deleteTankerVendor(id: string): void {
    const data = load()
    data.tankerVendors = (data.tankerVendors ?? []).filter((v) => v.id !== id)
    save(data)
  },

  getExpenses(month?: string): SocietyExpense[] {
    const expenses = load().expenses ?? []
    return month ? expenses.filter((expense) => expense.month === month) : expenses
  },

  upsertExpense(expense: SocietyExpense): void {
    const data = load()
    if (!data.expenses) data.expenses = []
    const idx = data.expenses.findIndex((item) => item.id === expense.id)
    if (idx >= 0) data.expenses[idx] = expense
    else data.expenses.push(expense)
    save(data)
  },

  deleteExpense(id: string): void {
    const data = load()
    data.expenses = (data.expenses ?? []).filter((expense) => expense.id !== id)
    save(data)
  },

  getExpenseProvision(month: string): MonthlyExpenseProvision | null {
    return (load().expenseProvisions ?? []).find((provision) => provision.billingMonth === month) ?? null
  },

  upsertExpenseProvision(provision: MonthlyExpenseProvision): void {
    const data = load()
    if (!data.expenseProvisions) data.expenseProvisions = []
    const idx = data.expenseProvisions.findIndex((item) => item.billingMonth === provision.billingMonth)
    if (idx >= 0) data.expenseProvisions[idx] = provision
    else data.expenseProvisions.push(provision)
    save(data)
  },

  deleteExpenseProvision(month: string): void {
    const data = load()
    data.expenseProvisions = (data.expenseProvisions ?? []).filter((item) => item.billingMonth !== month)
    save(data)
  },

  getFundCollections(month?: string): FundCollection[] {
    const collections = load().fundCollections ?? []
    return month ? collections.filter((item) => item.billingMonth === month) : collections
  },

  upsertFundCollection(collection: FundCollection): void {
    const data = load()
    if (!data.fundCollections) data.fundCollections = []
    const idx = data.fundCollections.findIndex((item) => item.id === collection.id)
    if (idx >= 0) data.fundCollections[idx] = collection
    else data.fundCollections.push(collection)
    save(data)
  },

  deleteFundCollection(id: string): void {
    const data = load()
    data.fundCollections = (data.fundCollections ?? []).filter((item) => item.id !== id)
    save(data)
  },

  replaceAll(data: AppData): void {
    save({
      flats: data.flats,
      readings: data.readings,
      billingConfigs: data.billingConfigs,
      flatBills: data.flatBills ?? [],
      alerts: data.alerts ?? [],
      users: data.users,
      tankerDeliveries: data.tankerDeliveries ?? [],
      tankerVendors: data.tankerVendors ?? [],
      expenses: data.expenses ?? [],
      expenseProvisions: data.expenseProvisions ?? [],
      fundCollections: data.fundCollections ?? [],
    })
  },

  seed(data: Partial<AppData>): void {
    const current = load()
    save({ ...current, ...data })
  },

  reset(): void {
    localStorage.removeItem(STORE_KEY)
  },
}
