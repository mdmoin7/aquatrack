import type { MeterReading, UserRole } from '@/types'

const DB_NAME = 'aquatrack-offline'
const STORE_NAME = 'pending-readings'
const DB_VERSION = 1

export interface PendingReadingInput {
  flatId: string
  month: string
  closingReading: number
  initialOpeningReading?: number
  enteredBy: string
  enteredByRole: UserRole
}

export interface PendingReading {
  queueId: string
  input: PendingReadingInput
  existingId?: string
  createdAt: string
  lastError?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'queueId' })
      }
    }
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function listPendingReadings(): Promise<PendingReading[]> {
  try {
    const items = await withStore('readonly', (s) => s.getAll())
    return (items as PendingReading[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } catch {
    return []
  }
}

export async function enqueuePendingReading(
  input: PendingReadingInput,
  existingId?: string,
): Promise<PendingReading> {
  const entry: PendingReading = {
    queueId: `pending-${crypto.randomUUID()}`,
    input,
    existingId,
    createdAt: new Date().toISOString(),
  }
  await withStore('readwrite', (s) => s.put(entry))
  return entry
}

export async function removePendingReading(queueId: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(queueId))
}

export async function updatePendingError(queueId: string, lastError: string): Promise<void> {
  const items = await listPendingReadings()
  const item = items.find((p) => p.queueId === queueId)
  if (!item) return
  await withStore('readwrite', (s) => s.put({ ...item, lastError }))
}

export function pendingToMeterReading(pending: PendingReading): MeterReading {
  const opening = pending.input.initialOpeningReading ?? 0
  const closing = pending.input.closingReading
  const consumptionLiters = Math.max(0, closing - opening)
  return {
    id: pending.existingId ?? pending.queueId,
    flatId: pending.input.flatId,
    month: pending.input.month,
    openingReading: opening,
    closingReading: closing,
    consumptionLiters,
    consumptionKL: consumptionLiters / 1000,
    enteredBy: pending.input.enteredBy,
    enteredByRole: pending.input.enteredByRole,
    createdAt: pending.createdAt,
    updatedAt: pending.createdAt,
    auditTrail: [
      {
        action: pending.existingId ? 'update' : 'create',
        userId: pending.input.enteredBy,
        userName: pending.input.enteredBy,
        timestamp: pending.createdAt,
      },
    ],
  }
}

export async function getPendingCount(): Promise<number> {
  const items = await listPendingReadings()
  return items.length
}
