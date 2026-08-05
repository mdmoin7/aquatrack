import type { UserRole } from '@/types'

export function isGuestRole(role: UserRole | undefined): boolean {
  return role === 'guest'
}

export function canManageReadings(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'superadmin'
}

export function canAccessSocietyReadings(role: UserRole | undefined): boolean {
  return canManageReadings(role) || role === 'guest'
}

export function guestHomePath(role: UserRole | undefined): string {
  if (role === 'guest') return '/readings'
  if (role === 'resident') return '/resident'
  return '/'
}
