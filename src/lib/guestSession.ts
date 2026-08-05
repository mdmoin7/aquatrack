import type { User } from '@/types'

export const GUEST_SESSION_KEY = 'aquatrack-guest-user'

export function buildGuestUser(): User {
  const societyId = import.meta.env.VITE_SOCIETY_ID ?? 'default'
  return {
    id: 'guest',
    email: 'guest@aquatrack.local',
    displayName: 'Guest Viewer',
    role: 'guest',
    societyId,
  }
}

export function readGuestSession(): User | null {
  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_KEY)
    if (!raw) return null
    const user = JSON.parse(raw) as User
    return user.role === 'guest' ? user : null
  } catch {
    return null
  }
}

export function writeGuestSession(user: User): void {
  sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(user))
}

export function clearGuestSession(): void {
  sessionStorage.removeItem(GUEST_SESSION_KEY)
}
