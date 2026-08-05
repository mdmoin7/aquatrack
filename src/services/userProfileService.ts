import type { BlockId, User, UserRole } from '@/types'
import { getActiveSocietyId } from '@/lib/firestorePaths'
import { isSuperAdminEmail } from '@/lib/superAdmin'
import { dataStore } from '@/services/dataStore'
import type { User as FirebaseUser } from 'firebase/auth'

export function resolveBootstrapRole(fbUser: FirebaseUser): UserRole {
  return isSuperAdminEmail(fbUser.email) ? 'superadmin' : 'admin'
}

export function buildDefaultProfile(fbUser: FirebaseUser, role?: UserRole): User {
  const resolvedRole = role ?? resolveBootstrapRole(fbUser)
  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    displayName: fbUser.displayName ?? fbUser.email ?? 'User',
    role: resolvedRole,
    societyId: getActiveSocietyId(),
  }
}

export async function getProfile(uid: string): Promise<User | null> {
  return dataStore.getUserProfile(uid)
}

export async function saveProfile(profile: User): Promise<void> {
  await dataStore.upsertUserProfile(profile)
}

export async function createSuperAdminProfile(
  fbUser: FirebaseUser,
  displayName?: string,
): Promise<User> {
  const profile: User = {
    ...buildDefaultProfile(fbUser, 'superadmin'),
    displayName: displayName?.trim() || fbUser.displayName || fbUser.email || 'Super Admin',
  }
  await saveProfile(profile)
  return profile
}

export async function createAdminProfile(fbUser: FirebaseUser, displayName?: string): Promise<User> {
  const profile: User = {
    ...buildDefaultProfile(fbUser, 'admin'),
    displayName: displayName?.trim() || fbUser.displayName || fbUser.email || 'Admin',
  }
  await saveProfile(profile)
  return profile
}

export async function ensureSuperAdminRole(profile: User, email: string | null): Promise<User> {
  if (!isSuperAdminEmail(email) || profile.role === 'superadmin') return profile
  const upgraded: User = { ...profile, role: 'superadmin' }
  await saveProfile(upgraded)
  return upgraded
}

export async function bootstrapProfileForAuthUser(fbUser: FirebaseUser): Promise<User> {
  if (isSuperAdminEmail(fbUser.email)) {
    return createSuperAdminProfile(fbUser)
  }
  return createAdminProfile(fbUser)
}

export async function createUserProfile(input: {
  id: string
  email: string
  displayName: string
  role: UserRole
  flatId?: string
  societyId?: string
  assignedBlocks?: BlockId[]
}): Promise<User> {
  const profile: User = {
    id: input.id,
    email: input.email.trim(),
    displayName: input.displayName.trim(),
    role: input.role,
    societyId: input.societyId ?? getActiveSocietyId(),
    ...(input.flatId ? { flatId: input.flatId } : {}),
    ...(input.assignedBlocks?.length ? { assignedBlocks: input.assignedBlocks } : {}),
  }
  await saveProfile(profile)
  return profile
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<User, 'displayName' | 'role' | 'flatId' | 'societyId' | 'assignedBlocks'>>,
): Promise<User> {
  const existing = await getProfile(uid)
  if (!existing) throw new Error('User profile not found')
  const updated: User = { ...existing, ...updates, id: uid }
  await saveProfile(updated)
  return updated
}

export async function listSocietyUsers(societyId?: string): Promise<User[]> {
  const sid = societyId ?? getActiveSocietyId()
  const users = await dataStore.getUsers()
  return users.filter((u) => u.societyId === sid)
}

export async function societyHasAdmin(societyId?: string): Promise<boolean> {
  const users = await listSocietyUsers(societyId)
  return users.some((u) => u.role === 'admin' || u.role === 'superadmin')
}
