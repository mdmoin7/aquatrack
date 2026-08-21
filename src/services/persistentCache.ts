const DB_NAME = 'aquatrack-cache'
const DB_VERSION = 3
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
      // The same database is used by src/lib/cache.ts. Both stores must exist
      // in the final schema so either cache implementation can safely coexist.
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }

    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error('Unable to open persistent cache'))
    }
  })

  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = null
      reject(new Error(`IndexedDB object store '${STORE_NAME}' is missing`))
      return
    }

    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    operation(store, resolve, reject)
    tx.onerror = () => reject(tx.error)
  })
}

export async function persistentCacheGet<T>(key: string): Promise<T | null> {
  return withStore<T | null>('readonly', (store, resolve, reject) => {
    const request = store.get(key)
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
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put({
      key,
      value,
      expiresAt: Date.now() + ttlMs,
    } satisfies CacheEntry<T>)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function persistentCacheDelete(key: string): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function persistentCacheDeletePrefix(prefix: string): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const key = String(cursor.key)
      if (key.startsWith(prefix)) cursor.delete()
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}

export const PersistentCacheTTL = {
  staticData: 24 * 60 * 60 * 1000,
  monthlyData: 10 * 60 * 1000,
}
