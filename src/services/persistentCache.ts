const DB_NAME = 'aquatrack-cache'
const DB_VERSION = 1
const STORE_NAME = 'entries'

interface CacheEntry<T = unknown> {
  key: string
  value: T
  expiresAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open persistent cache'))
  })
  return dbPromise
}

export async function persistentCacheGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => {
      const entry = request.result as CacheEntry<T> | undefined
      if (!entry || entry.expiresAt <= Date.now()) {
        resolve(null)
        return
      }
      resolve(entry.value)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function persistentCacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ key, value, expiresAt: Date.now() + ttlMs } satisfies CacheEntry<T>)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function persistentCacheDelete(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const PersistentCacheTTL = {
  staticData: 24 * 60 * 60 * 1000,
  monthlyData: 10 * 60 * 1000,
}
