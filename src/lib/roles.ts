import type { BlockId, Flat, User, UserRole } from '@/types'
import { BLOCK_LABELS } from '@/types'

export const SOCIETY_BLOCKS = Object.keys(BLOCK_LABELS) as BlockId[]

export function isGuestRole(role: UserRole | undefined): boolean {
  return role === 'guest'
}

export function isMeterReaderRole(role: UserRole | undefined): boolean {
  return role === 'meter_reader'
}

export function canManageReadings(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'superadmin'
}

export function canEnterReadings(role: UserRole | undefined): boolean {
  return canManageReadings(role) || isMeterReaderRole(role)
}

export function canAccessSocietyReadings(role: UserRole | undefined): boolean {
  return canEnterReadings(role) || role === 'guest'
}

export function getAssignedBlocks(user: User | null | undefined): BlockId[] {
  if (!user || user.role !== 'meter_reader') return []
  return user.assignedBlocks?.length ? user.assignedBlocks : ['A']
}

/** Blocks available on the block dashboard (all society blocks for staff, assigned only for meter readers). */
export function getDashboardBlocks(user: User | null | undefined): BlockId[] {
  if (!user) return ['A']
  if (user.role === 'meter_reader') {
    return user.assignedBlocks?.length ? user.assignedBlocks : ['A']
  }
  return SOCIETY_BLOCKS
}

export function filterFlatsForUser(flats: Flat[], user: User | null | undefined): Flat[] {
  if (!user || user.role !== 'meter_reader') return flats
  const blocks = new Set(getAssignedBlocks(user))
  return flats.filter((f) => blocks.has(f.block))
}

export function userCanAccessFlat(user: User | null | undefined, flat: Flat): boolean {
  if (!user || user.role !== 'meter_reader') return true
  return getAssignedBlocks(user).includes(flat.block)
}

export function homePath(role: UserRole | undefined): string {
  if (role === 'guest') return '/readings'
  if (role === 'resident') return '/resident'
  if (role === 'meter_reader') return '/block-dashboard'
  return '/'
}

/** @deprecated Use homePath */
export function guestHomePath(role: UserRole | undefined): string {
  return homePath(role)
}
