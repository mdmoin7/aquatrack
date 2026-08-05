import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { CacheConfig, CacheEntry } from '@/types'
import {
  cacheClear,
  cacheInspect,
  cacheInvalidate,
  configureCache,
  getCacheConfig,
} from '@/lib/cache'

interface CacheContextValue {
  config: CacheConfig
  entries: CacheEntry[]
  updateConfig: (partial: Partial<CacheConfig>) => void
  invalidate: (key: string) => Promise<void>
  clearAll: () => Promise<void>
  reload: () => Promise<void>
}

const CacheContext = createContext<CacheContextValue | null>(null)

export function CacheProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CacheConfig>(getCacheConfig())
  const [entries, setEntries] = useState<CacheEntry[]>([])

  const reload = useCallback(async () => {
    setEntries(await cacheInspect())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateConfig = (partial: Partial<CacheConfig>) => {
    configureCache(partial)
    setConfig(getCacheConfig())
  }

  const invalidate = async (key: string) => {
    await cacheInvalidate(key)
    await reload()
  }

  const clearAll = async () => {
    await cacheClear()
    await reload()
  }

  return (
    <CacheContext.Provider
      value={{ config, entries, updateConfig, invalidate, clearAll, reload }}
    >
      {children}
    </CacheContext.Provider>
  )
}

export function useCacheContext(): CacheContextValue {
  const ctx = useContext(CacheContext)
  if (!ctx) throw new Error('useCacheContext must be used within CacheProvider')
  return ctx
}
