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
import { isFirebaseConfigured } from '@/lib/firebase'
import { firestoreStore } from '@/services/firestoreStore'
import { indexedDbStore } from '@/services/indexedDbStore'

function isCloudBackend(): boolean {
  return isFirebaseConfigured
}

/** Unified data access — IndexedDB in local/demo mode, Firestore when Firebase is configured. */
export const dataStore = {
  async getFlats(): Promise<Flat[]> {
    return isCloudBackend() ? firestoreStore.getFlats() : indexedDbStore.getFlats()
  },
  async setFlats(flats: Flat[]): Promise<void> {
    if (isCloudBackend()) await firestoreStore.setFlats(flats)
    else await indexedDbStore.setFlats(flats)
  },
  async clearSocietyData(): Promise<void> {
    if (isCloudBackend()) await firestoreStore.clearSocietyCollections()
    else await indexedDbStore.clearAll()
  },
  async getReadings(month?: string): Promise<MeterReading[]> {
    return isCloudBackend() ? firestoreStore.getReadings(month) : indexedDbStore.getReadings(month)
  },
  async upsertReading(reading: MeterReading): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertReading(reading)
    else await indexedDbStore.upsertReading(reading)
  },
  async deleteReading(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteReading(id)
    else await indexedDbStore.deleteReading(id)
  },
  async getBillingConfig(month: string): Promise<BillingConfig | null> {
    return isCloudBackend() ? firestoreStore.getBillingConfig(month) : indexedDbStore.getBillingConfig(month)
  },
  async getBillingConfigs(): Promise<BillingConfig[]> {
    return isCloudBackend() ? firestoreStore.getBillingConfigs() : indexedDbStore.getBillingConfigs()
  },
  async upsertBillingConfig(config: BillingConfig): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertBillingConfig(config)
    else await indexedDbStore.upsertBillingConfig(config)
  },
  async getFlatBills(month: string): Promise<StoredFlatBill[]> {
    return isCloudBackend() ? firestoreStore.getFlatBills(month) : indexedDbStore.getFlatBills(month)
  },
  async saveFlatBills(month: string, bills: StoredFlatBill[]): Promise<void> {
    if (isCloudBackend()) await firestoreStore.saveFlatBills(month, bills)
    else await indexedDbStore.saveFlatBills(month, bills)
  },
  async getAlerts(month?: string): Promise<Alert[]> {
    return isCloudBackend() ? firestoreStore.getAlerts(month) : indexedDbStore.getAlerts(month)
  },
  async upsertAlerts(alerts: Alert[]): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertAlerts(alerts)
    else await indexedDbStore.upsertAlerts(alerts)
  },
  async acknowledgeAlert(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.acknowledgeAlert(id)
    else await indexedDbStore.acknowledgeAlert(id)
  },
  async getTankerDeliveries(month?: string): Promise<TankerDelivery[]> {
    return isCloudBackend() ? firestoreStore.getTankerDeliveries(month) : indexedDbStore.getTankerDeliveries(month)
  },
  async upsertTankerDelivery(delivery: TankerDelivery): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertTankerDelivery(delivery)
    else await indexedDbStore.upsertTankerDelivery(delivery)
  },
  async deleteTankerDelivery(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteTankerDelivery(id)
    else await indexedDbStore.deleteTankerDelivery(id)
  },
  async getTankerVendors(): Promise<TankerVendor[]> {
    return isCloudBackend() ? firestoreStore.getTankerVendors() : indexedDbStore.getTankerVendors()
  },
  async upsertTankerVendor(vendor: TankerVendor): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertTankerVendor(vendor)
    else await indexedDbStore.upsertTankerVendor(vendor)
  },
  async deleteTankerVendor(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteTankerVendor(id)
    else await indexedDbStore.deleteTankerVendor(id)
  },
  async getExpenses(month?: string): Promise<SocietyExpense[]> {
    return isCloudBackend() ? firestoreStore.getExpenses(month) : indexedDbStore.getExpenses(month)
  },
  async upsertExpense(expense: SocietyExpense): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertExpense(expense)
    else await indexedDbStore.upsertExpense(expense)
  },
  async deleteExpense(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteExpense(id)
    else await indexedDbStore.deleteExpense(id)
  },
  async getExpenseProvision(month: string): Promise<MonthlyExpenseProvision | null> {
    return isCloudBackend() ? firestoreStore.getExpenseProvision(month) : indexedDbStore.getExpenseProvision(month)
  },
  async upsertExpenseProvision(provision: MonthlyExpenseProvision): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertExpenseProvision(provision)
    else await indexedDbStore.upsertExpenseProvision(provision)
  },
  async deleteExpenseProvision(month: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteExpenseProvision(month)
    else await indexedDbStore.deleteExpenseProvision(month)
  },
  async getFundCollections(month?: string): Promise<FundCollection[]> {
    return isCloudBackend() ? firestoreStore.getFundCollections(month) : indexedDbStore.getFundCollections(month)
  },
  async upsertFundCollection(fundCollection: FundCollection): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertFundCollection(fundCollection)
    else await indexedDbStore.upsertFundCollection(fundCollection)
  },
  async deleteFundCollection(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteFundCollection(id)
    else await indexedDbStore.deleteFundCollection(id)
  },
  async getUsers(): Promise<User[]> {
    return isCloudBackend() ? firestoreStore.getUsers() : indexedDbStore.getUsers()
  },
  async getUserProfile(uid: string): Promise<User | null> {
    return isCloudBackend() ? firestoreStore.getUserProfile(uid) : null
  },
  async upsertUserProfile(user: User): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertUserProfile(user)
    else await indexedDbStore.upsertUserProfile(user)
  },
  isCloud: isCloudBackend,
}
