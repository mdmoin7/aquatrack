import type {
  Alert,
  BillingConfig,
  Flat,
  MeterReading,
  StoredFlatBill,
  TankerDelivery,
  TankerVendor,
  User,
} from '@/types'
import { isFirebaseConfigured } from '@/lib/firebase'
import { firestoreStore } from '@/services/firestoreStore'
import { localStore } from '@/services/localStore'

function isCloudBackend(): boolean {
  return isFirebaseConfigured
}

/** Unified data access — localStorage in demo mode, Firestore when Firebase is configured. */
export const dataStore = {
  async getFlats(): Promise<Flat[]> {
    return isCloudBackend() ? firestoreStore.getFlats() : localStore.getFlats()
  },

  async setFlats(flats: Flat[]): Promise<void> {
    if (isCloudBackend()) await firestoreStore.setFlats(flats)
    else localStore.setFlats(flats)
  },

  async clearSocietyData(): Promise<void> {
    if (isCloudBackend()) await firestoreStore.clearSocietyCollections()
    else localStore.reset()
  },

  async getReadings(month?: string): Promise<MeterReading[]> {
    return isCloudBackend() ? firestoreStore.getReadings(month) : localStore.getReadings(month)
  },

  async upsertReading(reading: MeterReading): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertReading(reading)
    else localStore.upsertReading(reading)
  },

  async deleteReading(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteReading(id)
    else localStore.deleteReading(id)
  },

  async getBillingConfig(month: string): Promise<BillingConfig | null> {
    return isCloudBackend()
      ? firestoreStore.getBillingConfig(month)
      : localStore.getBillingConfig(month)
  },

  async getBillingConfigs(): Promise<BillingConfig[]> {
    return isCloudBackend() ? firestoreStore.getBillingConfigs() : localStore.getBillingConfigs()
  },

  async upsertBillingConfig(config: BillingConfig): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertBillingConfig(config)
    else localStore.upsertBillingConfig(config)
  },

  async getFlatBills(month: string): Promise<StoredFlatBill[]> {
    return isCloudBackend() ? firestoreStore.getFlatBills(month) : localStore.getFlatBills(month)
  },

  async saveFlatBills(month: string, bills: StoredFlatBill[]): Promise<void> {
    if (isCloudBackend()) await firestoreStore.saveFlatBills(month, bills)
    else localStore.saveFlatBills(month, bills)
  },

  async getAlerts(month?: string): Promise<Alert[]> {
    return isCloudBackend() ? firestoreStore.getAlerts(month) : localStore.getAlerts(month)
  },

  async upsertAlerts(alerts: Alert[]): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertAlerts(alerts)
    else localStore.upsertAlerts(alerts)
  },

  async acknowledgeAlert(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.acknowledgeAlert(id)
    else localStore.acknowledgeAlert(id)
  },

  async getTankerDeliveries(month?: string): Promise<TankerDelivery[]> {
    return isCloudBackend()
      ? firestoreStore.getTankerDeliveries(month)
      : localStore.getTankerDeliveries(month)
  },

  async upsertTankerDelivery(delivery: TankerDelivery): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertTankerDelivery(delivery)
    else localStore.upsertTankerDelivery(delivery)
  },

  async deleteTankerDelivery(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteTankerDelivery(id)
    else localStore.deleteTankerDelivery(id)
  },

  async getTankerVendors(): Promise<TankerVendor[]> {
    return isCloudBackend() ? firestoreStore.getTankerVendors() : localStore.getTankerVendors()
  },

  async upsertTankerVendor(vendor: TankerVendor): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertTankerVendor(vendor)
    else localStore.upsertTankerVendor(vendor)
  },

  async deleteTankerVendor(id: string): Promise<void> {
    if (isCloudBackend()) await firestoreStore.deleteTankerVendor(id)
    else localStore.deleteTankerVendor(id)
  },

  async getUsers(): Promise<User[]> {
    return isCloudBackend() ? firestoreStore.getUsers() : localStore.getUsers()
  },

  async getUserProfile(uid: string): Promise<User | null> {
    return isCloudBackend() ? firestoreStore.getUserProfile(uid) : null
  },

  async upsertUserProfile(user: User): Promise<void> {
    if (isCloudBackend()) await firestoreStore.upsertUserProfile(user)
  },

  isCloud: isCloudBackend,
}
