import { useCallback, useEffect, useState } from 'react'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import {
  acknowledgeNotification,
  getActiveNotifications,
  getNotificationsForUser,
} from '@/services/notificationService'
import type { Alert } from '@/types'

export function useNotifications() {
  const { user } = useAuth()
  const { selectedMonth, refreshKey } = useAppContext()
  const [notifications, setNotifications] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    const items = await getNotificationsForUser(user, selectedMonth)
    setNotifications(items)
    setLoading(false)
  }, [user, selectedMonth, refreshKey])

  useEffect(() => {
    void load()
  }, [load])

  const active = getActiveNotifications(notifications)

  const acknowledge = useCallback(
    async (id: string) => {
      await acknowledgeNotification(id, selectedMonth)
      await load()
    },
    [selectedMonth, load],
  )

  return {
    notifications,
    active,
    unreadCount: active.length,
    loading,
    acknowledge,
    refresh: load,
  }
}
