import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { getCurrentMonth } from '@/lib/billing'

interface AppContextValue {
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  refreshKey: number
  refresh: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <AppContext.Provider value={{ selectedMonth, setSelectedMonth, refreshKey, refresh }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
