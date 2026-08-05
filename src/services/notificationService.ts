import type { Alert, AlertAudience, User } from '@/types'
import { cacheGet, cacheInvalidate, cacheSet, CacheKeys } from '@/lib/cache'
import {
  canManageReadings,
  getAssignedBlocks,
  isMeterReaderRole,
  isSuperAdminRole,
} from '@/lib/roles'
import { dataStore } from '@/services/dataStore'
import { getFlats } from '@/services/readingsService'

export type NotificationTab = 'active' | 'history'

function alertAudience(alert: Alert): AlertAudience {
  return alert.audience ?? 'flat'
}

export function isSuperAdminAlert(alert: Alert): boolean {
  return alertAudience(alert) === 'superadmin'
}

export async function getNotifications(month: string): Promise<Alert[]> {
  const cacheKey = CacheKeys.alerts(month)
  const cached = await cacheGet<Alert[]>(cacheKey)
  const alerts = cached ?? (await dataStore.getAlerts(month))
  if (!cached) await cacheSet(cacheKey, alerts)
  return alerts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getNotificationsForUser(
  user: User | null,
  month: string,
): Promise<Alert[]> {
  const all = await getNotifications(month)
  if (!user) return []

  if (isSuperAdminRole(user.role)) return all

  if (canManageReadings(user.role)) {
    return all.filter((a) => !isSuperAdminAlert(a))
  }

  if (user.role === 'resident' && user.flatId) {
    return all.filter((a) => a.flatId === user.flatId)
  }

  if (isMeterReaderRole(user.role)) {
    const flats = await getFlats()
    const blockByFlatId = Object.fromEntries(flats.map((f) => [f.id, f.block]))
    const blocks = new Set(getAssignedBlocks(user))
    return all.filter((a) => blocks.has(blockByFlatId[a.flatId]))
  }

  return []
}

export function getActiveNotifications(alerts: Alert[]): Alert[] {
  return alerts.filter((a) => !a.acknowledged)
}

export function getNotificationHistory(alerts: Alert[]): Alert[] {
  return alerts.filter((a) => a.acknowledged)
}

export function canAcknowledgeNotification(user: User | null, alert: Alert): boolean {
  if (!user) return false
  if (isSuperAdminAlert(alert)) return isSuperAdminRole(user.role)
  if (canManageReadings(user.role)) return true
  return user.role === 'resident' && user.flatId === alert.flatId
}

export function canAccessNotifications(role: User['role'] | undefined): boolean {
  return (
    canManageReadings(role) ||
    isSuperAdminRole(role) ||
    role === 'resident' ||
    isMeterReaderRole(role)
  )
}

export async function acknowledgeNotification(id: string, month: string): Promise<void> {
  await dataStore.acknowledgeAlert(id)
  await cacheInvalidate(CacheKeys.alerts(month))
}

export async function invalidateNotificationCache(month: string): Promise<void> {
  await cacheInvalidate(CacheKeys.alerts(month))
}
