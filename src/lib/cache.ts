import type { CacheConfig, CacheEntry } from '@/types'

const DB_NAME = 'aquatrack-cache'
const STORE_NAME = 'cache'
// Version 2 repairs cache databases created by older builds where the cache
// object store may not have been created successfully.
const DB_VERSION = 2

const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 5 * 60 * 1000,
  useIndexedDB: true,
}

let memoryCache = new Map<string, CacheEntry>()
let config = { ...DEFAULT_CONFIG }
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
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

    request.onblocked = () => {
      // A previous tab may still have the database open. The caller will use
      // the in-memory cache fallback if the upgrade cannot complete.
    }
  })

  return dbPromise
}

function getStore(db: IDBDatabase): IDBObjectStore | null {
  if (!db.objectStoreNames.contains(STORE_NAME)) return null
  return db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
}

async function idbGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = null
      reject(new Error(`IndexedDB object store '${STORE_NAME}' is missing`))
      return
    }
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve((req.result as CacheEntry<T>) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet<T>(entry: CacheEntry<T>): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = null
      reject(new Error(`IndexedDB object store '${STORE_NAME}' is missing`))
      return
    }
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = null
      reject(new Error(`IndexedDB object store '${STORE_NAME}' is missing`))
      return
    }
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbClear(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = null
      reject(new Error(`IndexedDB object store '${STORE_NAME}' is missing`))
      return
    }
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAll(): Promise<CacheEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = null
      reject(new Error(`IndexedDB object store '${STORE_NAME}' is missing`))
      return
    }
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as CacheEntry[])
    req.onerror = () => reject(req.error)
  })
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.expiresAt
}

export function configureCache(partial: Partial<CacheConfig>): void {
  config = { ...config, ...partial }
}

export function getCacheConfig(): CacheConfig {
  return { ...config }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined
  if (mem && !isExpired(mem)) return mem.data
  if (mem && isExpired(mem)) memoryCache.delete(key)

  if (config.useIndexedDB) {
    try {
      const entry = await idbGet<T>(key)
      if (entry && !isExpired(entry)) {
        memoryCache.set(key, entry)
        return entry.data
      }
      if (entry) await idbDelete(key)
    } catch {
      /* fallback to memory only */
    }
  }
  return null
}

export async function cacheSet<T>(key: string, data: T, ttlMs?: number): Promise<void> {
  const entry: CacheEntry<T> = {
    key,
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + (ttlMs ?? config.ttlMs),
  }
  memoryCache.set(key, entry as CacheEntry)
  if (config.useIndexedDB) {
    try {
      await idbSet(entry)
    } catch {
      /* memory cache still works */
    }
  }
}

export async function cacheInvalidate(key: string): Promise<void> {
  memoryCache.delete(key)
  if (config.useIndexedDB) {
    try {
      await idbDelete(key)
    } catch {
      /* noop */
    }
  }
}

export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }
  if (config.useIndexedDB) {
    try {
      const all = await idbGetAll()
      await Promise.all(
        all.filter((e) => e.key.startsWith(prefix)).map((e) => idbDelete(e.key)),
      )
    } catch {
      /* noop */
    }
  }
}

export async function cacheClear(): Promise<void> {
  memoryCache.clear()
  if (config.useIndexedDB) {
    try {
      await idbClear()
    } catch {
      /* noop */
    }
  }
}

export async function cacheInspect(): Promise<CacheEntry[]> {
  const entries = new Map<string, CacheEntry>()
  for (const [key, entry] of memoryCache) entries.set(key, entry)
  if (config.useIndexedDB) {
    try {
      const idbEntries = await idbGetAll()
      for (const entry of idbEntries) {
        if (!entries.has(entry.key)) entries.set(entry.key, entry)
      }
    } catch {
      /* noop */
    }
  }
  return Array.from(entries.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export const CacheKeys = {
  readings: (month: string) => `readings:${month}`,
  billingConfig: (month: string) => `billing:${month}`,
  flatBills: (month: string) => `flatBills:${month}`,
  dashboard: (month: string) => `dashboard:${month}`,
  flatAnalytics: (flatId: string, month: string) => `analytics:${flatId}:${month}`,
  alerts: (month: string) => `alerts:${month}`,
  flats: () => 'flats:all',
} as const
