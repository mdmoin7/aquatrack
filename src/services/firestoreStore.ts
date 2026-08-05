import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import type {
  Alert,
  BillingConfig,
  Flat,
  MeterReading,
  TankerDelivery,
  TankerVendor,
  User,
} from '@/types'
import { Collections } from '@/lib/firestorePaths'
import { sanitizeForFirestore } from '@/lib/firestoreWrite'
import { getFirestoreDb } from '@/lib/firebase'

function db() {
  const firestore = getFirestoreDb()
  if (!firestore) throw new Error('Firestore not initialized')
  return firestore
}

function mapDoc<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T
}

async function writeDoc(
  ref: ReturnType<typeof doc>,
  data: Record<string, unknown>,
  merge = true,
): Promise<void> {
  try {
    const payload = sanitizeForFirestore(data)
    if (merge) {
      await setDoc(ref, payload, { merge: true })
    } else {
      await setDoc(ref, payload)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Firestore write failed'
    throw new Error(message)
  }
}

export const firestoreStore = {
  async getUserProfile(uid: string): Promise<User | null> {
    const snap = await getDoc(doc(db(), Collections.users(), uid))
    if (!snap.exists()) return null
    return mapDoc<User>(uid, snap.data())
  },

  async upsertUserProfile(user: User): Promise<void> {
    const { id, ...data } = user
    await writeDoc(doc(db(), Collections.users(), id), { ...data, id })
  },

  async getFlats(): Promise<Flat[]> {
    const snap = await getDocs(collection(db(), Collections.flats()))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Flat)
  },

  async setFlats(flats: Flat[]): Promise<void> {
    await Promise.all(
      flats.map((flat) => writeDoc(doc(db(), Collections.flat(flat.id)), { ...flat }, false)),
    )
  },

  async deleteFlat(id: string): Promise<void> {
    await deleteDoc(doc(db(), Collections.flat(id)))
  },

  async deleteBillingConfig(month: string): Promise<void> {
    await deleteDoc(doc(db(), Collections.billingConfig(month)))
  },

  async clearSocietyCollections(): Promise<void> {
    const [flats, readings, billingConfigs, alerts, deliveries, vendors] = await Promise.all([
      getDocs(collection(db(), Collections.flats())),
      getDocs(collection(db(), Collections.readings())),
      getDocs(collection(db(), Collections.billingConfigs())),
      getDocs(collection(db(), Collections.alerts())),
      getDocs(collection(db(), Collections.tankerDeliveries())),
      getDocs(collection(db(), Collections.tankerVendors())),
    ])

    await Promise.all([
      ...flats.docs.map((d) => deleteDoc(d.ref)),
      ...readings.docs.map((d) => deleteDoc(d.ref)),
      ...billingConfigs.docs.map((d) => deleteDoc(d.ref)),
      ...alerts.docs.map((d) => deleteDoc(d.ref)),
      ...deliveries.docs.map((d) => deleteDoc(d.ref)),
      ...vendors.docs.map((d) => deleteDoc(d.ref)),
    ])
  },

  async getReadings(month?: string): Promise<MeterReading[]> {
    const col = collection(db(), Collections.readings())
    const snap = month
      ? await getDocs(query(col, where('month', '==', month)))
      : await getDocs(col)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MeterReading)
  },

  async upsertReading(reading: MeterReading): Promise<void> {
    const { id, ...data } = reading
    await writeDoc(doc(db(), Collections.reading(id)), { ...data, id })
  },

  async deleteReading(id: string): Promise<void> {
    await deleteDoc(doc(db(), Collections.reading(id)))
  },

  async getBillingConfig(month: string): Promise<BillingConfig | null> {
    const snap = await getDoc(doc(db(), Collections.billingConfig(month)))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as BillingConfig
  },

  async getBillingConfigs(): Promise<BillingConfig[]> {
    const snap = await getDocs(collection(db(), Collections.billingConfigs()))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BillingConfig)
  },

  async upsertBillingConfig(config: BillingConfig): Promise<void> {
    const { id, month, ...data } = config
    await writeDoc(doc(db(), Collections.billingConfig(month)), { ...data, id, month })
  },

  async getAlerts(month?: string): Promise<Alert[]> {
    const col = collection(db(), Collections.alerts())
    const snap = month
      ? await getDocs(query(col, where('month', '==', month)))
      : await getDocs(col)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Alert)
  },

  async upsertAlerts(alerts: Alert[]): Promise<void> {
    await Promise.all(
      alerts.map((alert) => {
        const { id, ...data } = alert
        return writeDoc(doc(db(), Collections.alert(id)), { ...data, id })
      }),
    )
  },

  async acknowledgeAlert(id: string): Promise<void> {
    const ref = doc(db(), Collections.alert(id))
    const snap = await getDoc(ref)
    if (snap.exists()) {
      await setDoc(ref, { acknowledged: true }, { merge: true })
    }
  },

  async getTankerDeliveries(month?: string): Promise<TankerDelivery[]> {
    const col = collection(db(), Collections.tankerDeliveries())
    const snap = month
      ? await getDocs(query(col, where('month', '==', month)))
      : await getDocs(col)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TankerDelivery)
  },

  async upsertTankerDelivery(delivery: TankerDelivery): Promise<void> {
    const { id, ...data } = delivery
    await writeDoc(doc(db(), Collections.tankerDelivery(id)), { ...data, id })
  },

  async deleteTankerDelivery(id: string): Promise<void> {
    await deleteDoc(doc(db(), Collections.tankerDelivery(id)))
  },

  async getTankerVendors(): Promise<TankerVendor[]> {
    const snap = await getDocs(collection(db(), Collections.tankerVendors()))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TankerVendor)
  },

  async upsertTankerVendor(vendor: TankerVendor): Promise<void> {
    const { id, ...data } = vendor
    await writeDoc(doc(db(), Collections.tankerVendor(id)), { ...data, id })
  },

  async getUsers(societyId?: string): Promise<User[]> {
    const sid = societyId ?? import.meta.env.VITE_SOCIETY_ID ?? 'default'
    const snap = await getDocs(
      query(collection(db(), Collections.users()), where('societyId', '==', sid)),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User)
  },
}
