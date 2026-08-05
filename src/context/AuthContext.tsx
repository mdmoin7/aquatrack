import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@/types'
import { isFirebaseConfigured } from '@/lib/firebase'
import { isSuperAdminEmail } from '@/lib/superAdmin'
import { setActiveSocietyId } from '@/lib/firestorePaths'
import { localStore } from '@/services/localStore'
import {
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  sendPasswordReset,
  subscribeToAuthState,
} from '@/services/authService'
import {
  bootstrapProfileForAuthUser,
  buildDefaultProfile,
  ensureSuperAdminRole,
  getProfile,
  saveProfile,
} from '@/services/userProfileService'
import {
  buildGuestUser,
  clearGuestSession,
  readGuestSession,
  writeGuestSession,
} from '@/lib/guestSession'
import type { User as FirebaseUser } from 'firebase/auth'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isDemo: boolean
  profileMissing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signInDemo: (role: 'admin' | 'resident' | 'meter_reader') => void
  signInAsGuest: () => void
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
  createProfile: (displayName?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function resolveUserProfile(
  fbUser: FirebaseUser,
): Promise<{ user: User; profileMissing: boolean }> {
  const existing = await getProfile(fbUser.uid)

  if (existing) {
    const user = await ensureSuperAdminRole(existing, fbUser.email)
    if (user.societyId) setActiveSocietyId(user.societyId)
    return { user, profileMissing: false }
  }

  if (isSuperAdminEmail(fbUser.email)) {
    const user = await bootstrapProfileForAuthUser(fbUser)
    if (user.societyId) setActiveSocietyId(user.societyId)
    return { user, profileMissing: false }
  }

  return { user: buildDefaultProfile(fbUser), profileMissing: true }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileMissing, setProfileMissing] = useState(false)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const isDemo = !isFirebaseConfigured

  const applyProfile = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      const guest = readGuestSession()
      if (guest) {
        if (guest.societyId) setActiveSocietyId(guest.societyId)
        setUser(guest)
        setProfileMissing(false)
        setFirebaseUser(null)
      } else {
        setUser(null)
        setProfileMissing(false)
        setFirebaseUser(null)
      }
      setLoading(false)
      return
    }

    clearGuestSession()
    setFirebaseUser(fbUser)
    const { user: resolved, profileMissing: missing } = await resolveUserProfile(fbUser)
    setUser(resolved)
    setProfileMissing(missing)
    setLoading(false)
  }, [])

  useEffect(() => {
    const guest = readGuestSession()
    if (guest) {
      if (guest.societyId) setActiveSocietyId(guest.societyId)
      setUser(guest)
      setProfileMissing(false)
      setLoading(false)
      if (isDemo) return
      return subscribeToAuthState((fbUser) => {
        if (fbUser) void applyProfile(fbUser)
      })
    }

    if (isDemo) {
      const saved = sessionStorage.getItem('aquatrack-demo-user')
      if (saved) setUser(JSON.parse(saved) as User)
      setLoading(false)
      return
    }

    return subscribeToAuthState((fbUser) => {
      void applyProfile(fbUser)
    })
  }, [isDemo, applyProfile])

  const signIn = async (email: string, password: string) => {
    await signInWithEmail(email, password)
  }

  const handleGoogleSignIn = async () => {
    await signInWithGoogle()
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    await signUpWithEmail(email, password, displayName)
  }

  const signInDemo = (role: 'admin' | 'resident' | 'meter_reader') => {
    const users = localStore.getUsers()
    const demoUser = users.find((u) => u.role === role) ?? users[0]
    if (demoUser) {
      setUser(demoUser)
      setProfileMissing(false)
      sessionStorage.setItem('aquatrack-demo-user', JSON.stringify(demoUser))
    }
  }

  const signInAsGuest = () => {
    const guestUser = buildGuestUser()
    if (guestUser.societyId) setActiveSocietyId(guestUser.societyId)
    setUser(guestUser)
    setProfileMissing(false)
    setFirebaseUser(null)
    writeGuestSession(guestUser)
  }

  const signOut = async () => {
    clearGuestSession()
    if (isDemo) {
      setUser(null)
      setProfileMissing(false)
      sessionStorage.removeItem('aquatrack-demo-user')
      return
    }
    await signOutUser()
    setUser(null)
    setProfileMissing(false)
    setFirebaseUser(null)
  }

  const resetPassword = async (email: string) => {
    await sendPasswordReset(email)
  }

  const refreshProfile = async () => {
    if (isDemo || !firebaseUser) return
    await applyProfile(firebaseUser)
  }

  const createProfile = async (displayName?: string) => {
    if (!firebaseUser) throw new Error('Not signed in')
    let profile = await bootstrapProfileForAuthUser(firebaseUser)
    if (displayName?.trim()) {
      profile = { ...profile, displayName: displayName.trim() }
      await saveProfile(profile)
    }
    if (profile.societyId) setActiveSocietyId(profile.societyId)
    setUser(profile)
    setProfileMissing(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemo,
        profileMissing,
        signIn,
        signInWithGoogle: handleGoogleSignIn,
        signUp,
        signInDemo,
        signInAsGuest,
        signOut,
        resetPassword,
        refreshProfile,
        createProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
